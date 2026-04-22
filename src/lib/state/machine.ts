import type { DemoEvent, DemoState, DemoStatus } from "./types";

export const initialState = (): DemoState => ({ status: "idle" });

const TRANSITIONS: Partial<Record<DemoStatus, Partial<Record<DemoEvent["type"], DemoStatus>>>> = {
  idle: { CALL_STARTED: "call_active" },
  call_active: { RECOMMENDATION_READY: "recommended" },
  recommended: {
    USER_CONFIRMED: "approval_pending",
    USER_DECLINED: "declined",
  },
  approval_pending: {
    APPROVAL_APPROVED: "completed",
    APPROVAL_DECLINED: "declined",
  },
};

const TERMINAL: DemoStatus[] = ["completed", "declined", "failed"];

export function transition(state: DemoState, event: DemoEvent): DemoState {
  if (event.type === "RESET") return initialState();

  if (event.type === "FAIL") {
    if (TERMINAL.includes(state.status)) return state;
    return { status: "failed", error: event.reason };
  }

  const next = TRANSITIONS[state.status]?.[event.type];
  if (!next) return state;
  return { status: next };
}

export function isTerminal(state: DemoState): boolean {
  return TERMINAL.includes(state.status);
}
