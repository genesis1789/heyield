/**
 * Demo status machine for the voice-concierge flow.
 *
 * The primary user surface is a voice call. The FSM tracks where the caller
 * is in the journey the dashboard observes:
 *
 *   idle
 *    └─ CALL_STARTED → call_active
 *         ├─ RECOMMENDATION_READY → recommended
 *         │    ├─ USER_DECLINED    → declined (terminal)
 *         │    └─ USER_CONFIRMED   → approval_pending
 *         │         ├─ APPROVAL_APPROVED → completed (terminal)
 *         │         └─ APPROVAL_DECLINED → declined (terminal)
 *         └─ FAIL → failed (terminal)
 *    └─ RESET → idle
 */
export const DEMO_STATUSES = [
  "idle",
  "call_active",
  "recommended",
  "approval_pending",
  "completed",
  "declined",
  "failed",
] as const;

export type DemoStatus = (typeof DEMO_STATUSES)[number];

/** Three-step timeline shown once a recommendation has been made. */
export const TIMELINE_STATUSES = [
  "recommended",
  "approval_pending",
  "completed",
] as const satisfies readonly DemoStatus[];
export type TimelineStatus = (typeof TIMELINE_STATUSES)[number];

export type DemoEvent =
  | { type: "CALL_STARTED" }
  | { type: "RECOMMENDATION_READY" }
  | { type: "USER_CONFIRMED" }
  | { type: "USER_DECLINED" }
  | { type: "APPROVAL_APPROVED" }
  | { type: "APPROVAL_DECLINED" }
  | { type: "FAIL"; reason: string }
  | { type: "RESET" };

export interface DemoState {
  status: DemoStatus;
  error?: string;
}
