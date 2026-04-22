/**
 * Funding-rail adapter contracts.
 *
 * This replaces the earlier "approval channel" model. A funding session
 * represents the complete path from "user said yes" to "money is invested
 * in the Earn product" — matching what the `hackaton/revolut` ramp module
 * demonstrated with a real Revolut Merchant sandbox plus an optional
 * on-chain proof of delivery.
 *
 * Providers:
 *   - `simulator`        — in-process mock with a hosted sandbox checkout page
 *   - `merchant`         — real Revolut Merchant sandbox checkout (fiat only)
 *   - `merchant-onchain` — Merchant sandbox + real Sepolia EURC transfer
 *
 * The adapter never throws on transient failures; the UI always has a
 * session snapshot it can render something from.
 */

import type { FiatCurrency } from "@/lib/providers/types";

export type FundingProviderKind = "simulator" | "merchant" | "merchant-onchain";

/** Canonical lifecycle states shown to the audience on the dashboard. */
export type FundingStatus =
  | "awaiting_checkout"   // checkout link exists; user has not paid yet
  | "payment_received"    // Revolut captured the fiat
  | "routing_to_yield"    // funds in transit to the yield destination
  | "invested"            // terminal: money is in the yield product
  | "failed"              // terminal: something broke
  | "cancelled";          // terminal: user cancelled on the payment step

export const TERMINAL_FUNDING_STATUSES: readonly FundingStatus[] = [
  "invested",
  "failed",
  "cancelled",
];

export function isFundingTerminal(s: FundingStatus): boolean {
  return (TERMINAL_FUNDING_STATUSES as readonly string[]).includes(s);
}

export interface CreateFundingSessionRequest {
  intentId: string;
  amountFiat: number;
  fiatCurrency: FiatCurrency;
  /** Human-friendly product name, used for receipts + audience copy. */
  productName: string;
  /** Yield protocol narrative label. Default "Aave v3". */
  protocolLabel?: string;
}

/**
 * A funding session is everything the UI needs to render the handoff,
 * the in-flight timeline, and the "now earning" finale.
 */
export interface FundingSession {
  sessionId: string;
  intentId: string;
  amountFiat: number;
  fiatCurrency: FiatCurrency;
  productName: string;
  protocolLabel: string;

  /** Absolute URL the user visits to complete the Revolut payment. */
  checkoutUrl: string;

  status: FundingStatus;

  /**
   * Tag that tells the dashboard which mode the session is running in.
   * Used to label the real-vs-simulated badge and to decide whether the
   * "open Revolut" button opens a sandbox widget or a real hosted page.
   */
  mode: FundingProviderKind;

  /**
   * True when the underlying rail is fully simulated (no real Revolut
   * sandbox traffic). Equivalent to `mode === "simulator"`.
   */
  simulated: boolean;

  /** Destination wallet the funds will eventually reach. */
  destWalletAddress?: string;

  /** Populated once an on-chain transfer has confirmed. */
  txHash?: string;
  txExplorerUrl?: string;

  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FundingAdapter {
  readonly kind: FundingProviderKind;
  readonly simulated: boolean;

  /** Create a new funding session and a checkout URL the user can visit. */
  createSession(req: CreateFundingSessionRequest): Promise<FundingSession>;

  /** Read the current state of a session. Must not throw on unknown id. */
  getSession(sessionId: string): Promise<FundingSession | null>;

  /** Advance a session (simulator + dashboard fast-forward). Optional. */
  advance?: (
    sessionId: string,
    event: FundingAdvanceEvent,
  ) => Promise<FundingSession | null>;
}

export type FundingAdvanceEvent =
  | { type: "confirm_payment" } // user hit Pay in the sandbox widget
  | { type: "cancel" };         // user backed out of the checkout
