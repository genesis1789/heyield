/**
 * Demo status machine for the voice-concierge flow.
 *
 * The primary user surface is a voice call. The FSM tracks where the caller
 * is in the journey the dashboard observes:
 *
 *   idle
 *    └─ CALL_STARTED → call_active
 *         ├─ RECOMMENDATION_READY → recommended
 *         │    ├─ USER_DECLINED        → cancelled (terminal)
 *         │    └─ USER_CONFIRMED       → awaiting_checkout
 *         │         ├─ PAYMENT_RECEIVED → payment_received
 *         │         │    └─ CRYPTO_IN_FLIGHT → routing_to_yield
 *         │         │         └─ INVESTED  → invested (terminal)
 *         │         ├─ CANCELLED        → cancelled (terminal)
 *         │         └─ FAIL             → failed   (terminal)
 *         └─ FAIL → failed (terminal)
 *    └─ RESET → idle
 */
export const DEMO_STATUSES = [
  "idle",
  "call_active",
  "recommended",
  "awaiting_checkout",
  "payment_received",
  "routing_to_yield",
  "invested",
  "cancelled",
  "failed",
] as const;

export type DemoStatus = (typeof DEMO_STATUSES)[number];

/**
 * Four-step investment timeline shown once the user has confirmed.
 * Mirrors the Aave-style narrative borrowed from the hackaton ramp flow.
 */
export const TIMELINE_STATUSES = [
  "awaiting_checkout",
  "payment_received",
  "routing_to_yield",
  "invested",
] as const satisfies readonly DemoStatus[];
export type TimelineStatus = (typeof TIMELINE_STATUSES)[number];

export type DemoEvent =
  | { type: "CALL_STARTED" }
  | { type: "RECOMMENDATION_READY" }
  | { type: "USER_CONFIRMED" }
  | { type: "USER_DECLINED" }
  | { type: "PAYMENT_RECEIVED" }
  | { type: "CRYPTO_IN_FLIGHT" }
  | { type: "INVESTED" }
  | { type: "CANCELLED" }
  | { type: "FAIL"; reason: string }
  | { type: "RESET" };

export interface DemoState {
  status: DemoStatus;
  error?: string;
}
