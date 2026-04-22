import { readJsonFile, writeJsonFile } from "@/lib/server/jsonStore";
import type {
  CreateFundingSessionRequest,
  FundingAdapter,
  FundingAdvanceEvent,
  FundingSession,
} from "./types";

/**
 * Simulator funding provider.
 *
 * Produces a checkout URL that points at our own Next route
 * (`/checkout/[sessionId]`), which mimics a Revolut hosted payment page.
 * When the user taps Pay there, the dashboard advances the lifecycle:
 *   awaiting_checkout
 *     → payment_received
 *     → routing_to_yield
 *     → invested
 *
 * All state is file-backed (shared with the real sandbox provider) so that
 * any API route can read/write it regardless of which Next context served
 * the request. Progression timers are encoded as timestamps rather than
 * `setTimeout` callbacks so they survive dev-server reloads and allow
 * demos to see the right state on any poll tick.
 */

export interface SimulatorConfig {
  /** Absolute app origin, e.g. "http://localhost:3000" */
  appBaseUrl: string;
  /** Stubbed destination wallet shown in the UI. */
  destWalletAddress: string;
  /** Milliseconds between visible state hops. Tune for demo cadence. */
  stepMs: number;
  /**
   * When true, payments auto-fail with a user-declined error the moment
   * the session is created. Used for the operator "force failure" toggle.
   */
  forceFailure: boolean;
  /**
   * When true, the simulator collapses the two intermediate steps into an
   * almost-immediate transition. Handy for operators debugging the flow
   * but NOT used on stage; the default cadence is more convincing.
   */
  skipDelays: boolean;
  protocolLabel: string;
  txExplorerUrlTemplate: string;
  /** Optional override so parallel test files don't race on one file. */
  storeFile?: string;
}

interface PendingTransition {
  /** When (epoch ms) the session should visually enter this status. */
  at: number;
  status: FundingSession["status"];
  /** Optional fields to apply atomically with the transition. */
  patch?: Partial<FundingSession>;
}

interface StoredSession {
  session: FundingSession;
  queue: PendingTransition[];
}

interface StoreSnapshot {
  counter: number;
  sessions: Record<string, StoredSession>;
}

const EMPTY_STORE: StoreSnapshot = { counter: 0, sessions: {} };
const DEFAULT_STORE_FILE = "funding-sessions.json";

function fakeHash(sessionId: string, at: number): `0x${string}` {
  // Deterministic-looking 32-byte hex. Purely cosmetic — labeled as simulated.
  const seed = `${sessionId}-${at}`;
  let h = "";
  for (let i = 0; i < 64; i++) {
    const c = (seed.charCodeAt(i % seed.length) * (i + 17)) & 0xff;
    h += c.toString(16).padStart(2, "0");
  }
  return `0x${h.slice(0, 64)}` as `0x${string}`;
}

export class SimulatorFundingAdapter implements FundingAdapter {
  readonly kind = "simulator" as const;
  readonly simulated = true;

  private readonly storeFile: string;

  constructor(private readonly cfg: SimulatorConfig) {
    this.storeFile = cfg.storeFile ?? DEFAULT_STORE_FILE;
  }

  private read(): StoreSnapshot {
    return readJsonFile(this.storeFile, EMPTY_STORE);
  }

  private write(s: StoreSnapshot): void {
    writeJsonFile(this.storeFile, s);
  }

  /**
   * Rebuild the session snapshot after any queued transitions whose `at`
   * timestamp has passed. This is called inside every read so that the
   * dashboard poll sees a naturally-animating timeline without needing
   * its own scheduler.
   */
  private advanceQueue(stored: StoredSession, now: number): StoredSession {
    if (!stored.queue.length) return stored;
    let session = stored.session;
    let queue = stored.queue;
    while (queue.length && queue[0].at <= now) {
      const next = queue[0];
      queue = queue.slice(1);
      session = {
        ...session,
        ...next.patch,
        status: next.status,
        updatedAt: now,
      };
    }
    return { session, queue };
  }

  async createSession(req: CreateFundingSessionRequest): Promise<FundingSession> {
    const snapshot = this.read();
    const counter = snapshot.counter + 1;
    const sessionId = `fund_sim_${String(counter).padStart(3, "0")}`;
    const now = Date.now();
    const checkoutUrl = `${this.cfg.appBaseUrl.replace(/\/$/, "")}/checkout/${sessionId}`;

    const session: FundingSession = {
      sessionId,
      intentId: req.intentId,
      amountFiat: req.amountFiat,
      fiatCurrency: req.fiatCurrency,
      productName: req.productName,
      protocolLabel: req.protocolLabel ?? this.cfg.protocolLabel,
      checkoutUrl,
      status: "awaiting_checkout",
      mode: "simulator",
      simulated: true,
      destWalletAddress: this.cfg.destWalletAddress,
      createdAt: now,
      updatedAt: now,
    };

    this.write({
      counter,
      sessions: {
        ...snapshot.sessions,
        [sessionId]: { session, queue: [] },
      },
    });
    return session;
  }

  async getSession(sessionId: string): Promise<FundingSession | null> {
    const snapshot = this.read();
    const stored = snapshot.sessions[sessionId];
    if (!stored) return null;
    const advanced = this.advanceQueue(stored, Date.now());
    if (advanced !== stored) {
      this.write({
        ...snapshot,
        sessions: { ...snapshot.sessions, [sessionId]: advanced },
      });
    }
    return advanced.session;
  }

  async advance(
    sessionId: string,
    event: FundingAdvanceEvent,
  ): Promise<FundingSession | null> {
    const snapshot = this.read();
    const stored = snapshot.sessions[sessionId];
    if (!stored) return null;

    const now = Date.now();
    const current = this.advanceQueue(stored, now).session;

    if (event.type === "cancel") {
      if (current.status === "invested" || current.status === "failed") {
        return current;
      }
      const cancelled: FundingSession = {
        ...current,
        status: "cancelled",
        errorMessage: "User cancelled the Revolut payment.",
        updatedAt: now,
      };
      this.write({
        ...snapshot,
        sessions: {
          ...snapshot.sessions,
          [sessionId]: { session: cancelled, queue: [] },
        },
      });
      return cancelled;
    }

    // confirm_payment
    if (current.status !== "awaiting_checkout") {
      return current;
    }

    if (this.cfg.forceFailure) {
      const failed: FundingSession = {
        ...current,
        status: "failed",
        errorMessage:
          "Revolut declined this payment (demo force-failure toggle is on).",
        updatedAt: now,
      };
      this.write({
        ...snapshot,
        sessions: {
          ...snapshot.sessions,
          [sessionId]: { session: failed, queue: [] },
        },
      });
      return failed;
    }

    // `skipDelays` or an explicit 0 means "advance immediately on the next
    // poll". Otherwise use the configured step cadence.
    const step = this.cfg.skipDelays ? 0 : Math.max(0, this.cfg.stepMs);
    // Immediately move off awaiting_checkout; it reads strange if the UI
    // still says "awaiting" for a full step after the user clicked Pay.
    const paymentReceived: FundingSession = {
      ...current,
      status: "payment_received",
      updatedAt: now,
    };

    const hash = fakeHash(sessionId, now);
    const queue: PendingTransition[] = [
      {
        at: now + step,
        status: "routing_to_yield",
      },
      {
        at: now + step * 2,
        status: "invested",
        patch: {
          txHash: hash,
          txExplorerUrl: this.cfg.txExplorerUrlTemplate.replace("{hash}", hash),
        },
      },
    ];

    this.write({
      ...snapshot,
      sessions: {
        ...snapshot.sessions,
        [sessionId]: { session: paymentReceived, queue },
      },
    });
    return paymentReceived;
  }
}
