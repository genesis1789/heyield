import { describe, expect, it } from "vitest";
import { initialState, isTerminal, transition } from "@/lib/state/machine";
import type { DemoEvent } from "@/lib/state/types";

const HAPPY_SEQUENCE: DemoEvent[] = [
  { type: "CALL_STARTED" },
  { type: "RECOMMENDATION_READY" },
  { type: "USER_CONFIRMED" },
  { type: "PAYMENT_RECEIVED" },
  { type: "CRYPTO_IN_FLIGHT" },
  { type: "INVESTED" },
];

describe("state machine", () => {
  it("starts in idle", () => {
    expect(initialState()).toEqual({ status: "idle" });
  });

  it("walks the happy path: idle → call_active → recommended → awaiting_checkout → payment_received → routing_to_yield → invested", () => {
    let s = initialState();
    const visited: string[] = [s.status];
    for (const ev of HAPPY_SEQUENCE) {
      s = transition(s, ev);
      visited.push(s.status);
    }
    expect(s.status).toBe("invested");
    expect(isTerminal(s)).toBe(true);
    expect(visited).toEqual([
      "idle",
      "call_active",
      "recommended",
      "awaiting_checkout",
      "payment_received",
      "routing_to_yield",
      "invested",
    ]);
  });

  it("verbal decline at the recommended step lands on cancelled", () => {
    let s = initialState();
    s = transition(s, { type: "CALL_STARTED" });
    s = transition(s, { type: "RECOMMENDATION_READY" });
    s = transition(s, { type: "USER_DECLINED" });
    expect(s.status).toBe("cancelled");
    expect(isTerminal(s)).toBe(true);
  });

  it("cancel during awaiting_checkout lands on cancelled", () => {
    let s = initialState();
    s = transition(s, { type: "CALL_STARTED" });
    s = transition(s, { type: "RECOMMENDATION_READY" });
    s = transition(s, { type: "USER_CONFIRMED" });
    s = transition(s, { type: "CANCELLED" });
    expect(s.status).toBe("cancelled");
  });

  it("ignores invalid events (no-op)", () => {
    const s = initialState();
    const next = transition(s, { type: "USER_CONFIRMED" });
    expect(next.status).toBe("idle");
  });

  it("can fail from any non-terminal state", () => {
    let s = initialState();
    s = transition(s, { type: "CALL_STARTED" });
    s = transition(s, { type: "FAIL", reason: "mic dropped" });
    expect(s.status).toBe("failed");
    expect(s.error).toBe("mic dropped");
  });

  it("cannot transition out of terminal states except via RESET", () => {
    let s = initialState();
    for (const ev of HAPPY_SEQUENCE) s = transition(s, ev);
    const again = transition(s, { type: "CALL_STARTED" });
    expect(again.status).toBe("invested");
    const reset = transition(s, { type: "RESET" });
    expect(reset.status).toBe("idle");
  });

  it("FAIL after terminal is a no-op", () => {
    let s = initialState();
    for (const ev of HAPPY_SEQUENCE) s = transition(s, ev);
    const after = transition(s, { type: "FAIL", reason: "late" });
    expect(after.status).toBe("invested");
  });

  it("supports skipping the in-flight step straight to invested", () => {
    let s = initialState();
    s = transition(s, { type: "CALL_STARTED" });
    s = transition(s, { type: "RECOMMENDATION_READY" });
    s = transition(s, { type: "USER_CONFIRMED" });
    s = transition(s, { type: "PAYMENT_RECEIVED" });
    s = transition(s, { type: "INVESTED" });
    expect(s.status).toBe("invested");
  });
});
