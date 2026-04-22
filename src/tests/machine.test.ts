import { describe, expect, it } from "vitest";
import { initialState, isTerminal, transition } from "@/lib/state/machine";
import type { DemoEvent } from "@/lib/state/types";

const HAPPY_SEQUENCE: DemoEvent[] = [
  { type: "CALL_STARTED" },
  { type: "RECOMMENDATION_READY" },
  { type: "USER_CONFIRMED" },
  { type: "APPROVAL_APPROVED" },
];

describe("state machine", () => {
  it("starts in idle", () => {
    expect(initialState()).toEqual({ status: "idle" });
  });

  it("walks the happy path: idle → call_active → recommended → approval_pending → completed", () => {
    let s = initialState();
    const visited: string[] = [s.status];
    for (const ev of HAPPY_SEQUENCE) {
      s = transition(s, ev);
      visited.push(s.status);
    }
    expect(s.status).toBe("completed");
    expect(isTerminal(s)).toBe(true);
    expect(visited).toEqual([
      "idle",
      "call_active",
      "recommended",
      "approval_pending",
      "completed",
    ]);
  });

  it("verbal decline at the recommended step lands on declined", () => {
    let s = initialState();
    s = transition(s, { type: "CALL_STARTED" });
    s = transition(s, { type: "RECOMMENDATION_READY" });
    s = transition(s, { type: "USER_DECLINED" });
    expect(s.status).toBe("declined");
    expect(isTerminal(s)).toBe(true);
  });

  it("phone-tap decline during approval_pending lands on declined", () => {
    let s = initialState();
    for (const ev of HAPPY_SEQUENCE.slice(0, 3)) s = transition(s, ev);
    s = transition(s, { type: "APPROVAL_DECLINED" });
    expect(s.status).toBe("declined");
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
    expect(again.status).toBe("completed");
    const reset = transition(s, { type: "RESET" });
    expect(reset.status).toBe("idle");
  });

  it("FAIL after terminal is a no-op", () => {
    let s = initialState();
    for (const ev of HAPPY_SEQUENCE) s = transition(s, ev);
    const after = transition(s, { type: "FAIL", reason: "late" });
    expect(after.status).toBe("completed");
  });
});
