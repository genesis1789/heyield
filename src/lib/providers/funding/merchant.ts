import { readJsonFile, writeJsonFile } from "@/lib/server/jsonStore";
import type {
  CreateFundingSessionRequest,
  FundingAdapter,
  FundingAdvanceEvent,
  FundingSession,
  FundingStatus,
} from "./types";
import {
  createMerchantClient,
  fiatToMinor,
  hostnameIsPublic,
  type MerchantClient,
  type MerchantOrderState,
} from "./revolutMerchantClient";
import { transferEurcOnSepolia } from "./onchain";

/**
 * Revolut Merchant funding provider.
 *
 * Creates a real Revolut Merchant sandbox order and exposes the hosted
 * `checkout_url`. On each poll we pull the Merchant state and map it into
 * our funding lifecycle; when the order completes we optionally broadcast
 * a Sepolia EURC transfer so the audience sees an actual transaction.
 *
 * Two envelope shapes are supported via `onchain`:
 *   - omitted           → fiat-only: payment_received → invested
 *   - provided + valid  → fiat + real on-chain: payment_received →
 *                         routing_to_yield → invested (with tx hash)
 */

export interface MerchantFundingConfig {
  merchantSecretKey: string;
  merchantBaseUrl: string;
  merchantApiVersion: string;
  /**
   * App origin we control. Used to build the Revolut `redirect_url` so
   * the user's browser comes back to the dashboard after paying.
   * Must resolve to a non-localhost hostname for Revolut to accept it.
   */
  publicBaseUrl?: string;
  protocolLabel: string;
  destWalletAddress: string;
  onchain?: {
    sourcePrivateKey: `0x${string}`;
    rpcUrl: string;
    /** Token amount broadcast per session; display amount stays 1:1 with fiat. */
    onchainAmountEurc: number;
    txExplorerUrlTemplate: string;
  };
}

type OnchainPhase = "idle" | "sending" | "confirmed" | "failed";

interface StoredSession {
  session: FundingSession;
  merchantOrderId: string;
  lastMerchantState?: MerchantOrderState;
  onchainPhase: OnchainPhase;
}

interface StoreSnapshot {
  counter: number;
  sessions: Record<string, StoredSession>;
}

const EMPTY_STORE: StoreSnapshot = { counter: 0, sessions: {} };
const STORE_FILE = "funding-sessions.json";

function mapMerchantState(
  s: MerchantOrderState,
  phase: OnchainPhase,
  hasOnchain: boolean,
): FundingStatus {
  switch (s) {
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "pending":
    case "processing":
      return "awaiting_checkout";
    case "authorised":
      return "payment_received";
    case "completed":
      if (!hasOnchain) return "invested";
      if (phase === "idle" || phase === "sending") return "routing_to_yield";
      if (phase === "confirmed") return "invested";
      return "failed";
  }
}

export class MerchantFundingAdapter implements FundingAdapter {
  readonly kind: FundingAdapter["kind"];
  readonly simulated = false;

  private readonly merchant: MerchantClient;

  constructor(private readonly cfg: MerchantFundingConfig) {
    this.kind = cfg.onchain ? "merchant-onchain" : "merchant";
    this.merchant = createMerchantClient({
      secretKey: cfg.merchantSecretKey,
      baseUrl: cfg.merchantBaseUrl,
      apiVersion: cfg.merchantApiVersion,
    });
  }

  private read(): StoreSnapshot {
    return readJsonFile(STORE_FILE, EMPTY_STORE);
  }

  private write(s: StoreSnapshot): void {
    writeJsonFile(STORE_FILE, s);
  }

  async createSession(req: CreateFundingSessionRequest): Promise<FundingSession> {
    const snapshot = this.read();
    const counter = snapshot.counter + 1;
    const sessionId = `fund_rvlt_${String(counter).padStart(3, "0")}`;

    // Redirect into the phone-facing stage view so the audience sees the
    // Aave-style status page animate in immediately after Revolut's success
    // screen. `hostnameIsPublic` guards against localhost redirects, which
    // Revolut refuses.
    const redirectUrl = hostnameIsPublic(this.cfg.publicBaseUrl)
      ? `${this.cfg.publicBaseUrl!.replace(/\/$/, "")}/stage/${sessionId}`
      : undefined;

    const order = await this.merchant.createOrder({
      amountMinor: fiatToMinor(req.amountFiat),
      currency: req.fiatCurrency,
      description: `Deposit ${req.amountFiat} ${req.fiatCurrency} → ${req.productName}`,
      metadata: {
        voiceconciergeSessionId: sessionId,
        intentId: req.intentId,
      },
      redirectUrl,
    });

    const now = Date.now();
    const session: FundingSession = {
      sessionId,
      intentId: req.intentId,
      amountFiat: req.amountFiat,
      fiatCurrency: req.fiatCurrency,
      productName: req.productName,
      protocolLabel: req.protocolLabel ?? this.cfg.protocolLabel,
      checkoutUrl: order.checkout_url,
      status: "awaiting_checkout",
      mode: this.kind,
      simulated: false,
      destWalletAddress: this.cfg.destWalletAddress,
      createdAt: now,
      updatedAt: now,
    };

    this.write({
      counter,
      sessions: {
        ...snapshot.sessions,
        [sessionId]: {
          session,
          merchantOrderId: order.id,
          lastMerchantState: order.state,
          onchainPhase: "idle",
        },
      },
    });
    return session;
  }

  async getSession(sessionId: string): Promise<FundingSession | null> {
    const snapshot = this.read();
    const stored = snapshot.sessions[sessionId];
    if (!stored) return null;

    let current = stored;

    // Only hit Revolut while we're still waiting for payment-side progress.
    const needsPoll =
      current.onchainPhase !== "confirmed" &&
      current.session.status !== "failed" &&
      current.session.status !== "cancelled";

    if (needsPoll) {
      try {
        const order = await this.merchant.getOrder(current.merchantOrderId);
        current = {
          ...current,
          lastMerchantState: order.state,
          session: {
            ...current.session,
            status: mapMerchantState(
              order.state,
              current.onchainPhase,
              Boolean(this.cfg.onchain),
            ),
            updatedAt: Date.now(),
          },
        };
        this.writeOne(snapshot, sessionId, current);

        if (
          order.state === "completed" &&
          current.onchainPhase === "idle" &&
          this.cfg.onchain
        ) {
          // Kick off on-chain delivery asynchronously. Subsequent polls
          // surface the routing_to_yield → invested transitions.
          current = {
            ...current,
            onchainPhase: "sending",
            session: {
              ...current.session,
              status: "routing_to_yield",
              updatedAt: Date.now(),
            },
          };
          this.writeOne(snapshot, sessionId, current);
          this.kickOnchain(sessionId, current).catch((err) => {
            console.error("[funding.merchant] on-chain delivery failed:", err);
          });
        }
      } catch (err) {
        console.error("[funding.merchant] poll error:", err);
      }
    }

    return current.session;
  }

  async advance(
    sessionId: string,
    event: FundingAdvanceEvent,
  ): Promise<FundingSession | null> {
    if (event.type !== "cancel") return this.getSession(sessionId);
    const snapshot = this.read();
    const stored = snapshot.sessions[sessionId];
    if (!stored) return null;
    if (
      stored.session.status === "invested" ||
      stored.session.status === "failed"
    ) {
      return stored.session;
    }
    const cancelled: FundingSession = {
      ...stored.session,
      status: "cancelled",
      errorMessage: "User cancelled the Revolut payment.",
      updatedAt: Date.now(),
    };
    this.writeOne(snapshot, sessionId, { ...stored, session: cancelled });
    return cancelled;
  }

  private writeOne(
    snapshot: StoreSnapshot,
    sessionId: string,
    next: StoredSession,
  ) {
    this.write({
      ...snapshot,
      sessions: { ...snapshot.sessions, [sessionId]: next },
    });
  }

  private async kickOnchain(sessionId: string, stored: StoredSession) {
    if (!this.cfg.onchain) return;
    if (!stored.session.destWalletAddress) return;
    try {
      const result = await transferEurcOnSepolia(
        {
          sourcePrivateKey: this.cfg.onchain.sourcePrivateKey,
          rpcUrl: this.cfg.onchain.rpcUrl,
        },
        {
          to: stored.session.destWalletAddress as `0x${string}`,
          amountEurc: this.cfg.onchain.onchainAmountEurc,
        },
      );
      const snapshot = this.read();
      const cur = snapshot.sessions[sessionId];
      if (!cur) return;
      this.writeOne(snapshot, sessionId, {
        ...cur,
        onchainPhase: "confirmed",
        session: {
          ...cur.session,
          status: "invested",
          txHash: result.hash,
          txExplorerUrl: result.explorerUrl,
          updatedAt: Date.now(),
        },
      });
    } catch (err) {
      const snapshot = this.read();
      const cur = snapshot.sessions[sessionId];
      if (!cur) return;
      this.writeOne(snapshot, sessionId, {
        ...cur,
        onchainPhase: "failed",
        session: {
          ...cur.session,
          status: "failed",
          errorMessage:
            err instanceof Error ? err.message : "on-chain transfer failed",
          updatedAt: Date.now(),
        },
      });
    }
  }
}
