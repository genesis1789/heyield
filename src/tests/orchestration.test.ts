import { describe, expect, it } from "vitest";
import { buildTestProviders } from "@/lib/providers";
import { initialState, transition } from "@/lib/state/machine";
import type { DemoState } from "@/lib/state/types";

/**
 * End-to-end happy path using mock adapters. Exercises the same transitions
 * the dashboard drives: CALL_STARTED → RECOMMENDATION_READY → USER_CONFIRMED
 * → APPROVAL_APPROVED → completed. The concierge agent layer is simulated
 * via direct adapter calls so the test is hermetic.
 */
describe("happy-path orchestration with mocks", () => {
  it("drives from call start to completed with a tapped approval", async () => {
    const { providers } = buildTestProviders();
    const visited: DemoState["status"][] = [];
    let state = initialState();
    const step = (ev: Parameters<typeof transition>[1]) => {
      state = transition(state, ev);
      visited.push(state.status);
    };

    step({ type: "CALL_STARTED" });

    // Agent runs `recommend` tool → picks opportunity + creates intent.
    const [opp] = await providers.earn.listOpportunities();
    expect(opp.name).toBe("Aave v3 USDC");
    const intent = await providers.intentFactory.createIntent({
      opportunityId: opp.id,
      amountFiat: 1000,
      fiatCurrency: "EUR",
      userRef: "orch-test",
    });
    expect(intent.id).toMatch(/^intent_demo_/);
    step({ type: "RECOMMENDATION_READY" });

    // Caller says yes → agent runs `createApproval`.
    step({ type: "USER_CONFIRMED" });
    const approval = await providers.revolut.requestApproval({
      intentId: intent.id,
      amountFiat: intent.expectedUsdcAmount,
      fiatCurrency: "EUR",
    });
    expect(approval.approvalId).toMatch(/^approval_demo_/);
    expect(approval.status).toBe("pending");

    // User taps Approve on the mock push.
    const tapped =
      "recordTap" in providers.revolut
        ? (providers.revolut as { recordTap: (id: string, d: "approve" | "decline") => unknown }).recordTap(
            approval.approvalId,
            "approve",
          )
        : null;
    expect(tapped).not.toBeNull();

    const settled = await providers.revolut.getApprovalStatus(approval.approvalId);
    expect(settled.status).toBe("approved");
    step({ type: "APPROVAL_APPROVED" });

    expect(state.status).toBe("completed");
    expect(visited).toEqual([
      "call_active",
      "recommended",
      "approval_pending",
      "completed",
    ]);
  });

  it("demoable decline: forceFailure auto-declines the approval on first poll", async () => {
    const { providers, mockConfig } = buildTestProviders({ forceFailure: true });

    const [opp] = await providers.earn.listOpportunities();
    const intent = await providers.intentFactory.createIntent({
      opportunityId: opp.id,
      amountFiat: 1000,
      fiatCurrency: "EUR",
      userRef: "orch-test",
    });
    const approval = await providers.revolut.requestApproval({
      intentId: intent.id,
      amountFiat: intent.expectedUsdcAmount,
      fiatCurrency: "EUR",
    });

    expect(mockConfig.forceFailure).toBe(true);
    const result = await providers.revolut.getApprovalStatus(approval.approvalId);
    expect(result.status).toBe("declined");
    expect(result.errorMessage).toMatch(/declined/i);

    let state = initialState();
    state = transition(state, { type: "CALL_STARTED" });
    state = transition(state, { type: "RECOMMENDATION_READY" });
    state = transition(state, { type: "USER_CONFIRMED" });
    state = transition(state, { type: "APPROVAL_DECLINED" });
    expect(state.status).toBe("declined");
  });

  it("verbal decline at the recommended step lands on declined without an approval", async () => {
    const { providers } = buildTestProviders();
    const [opp] = await providers.earn.listOpportunities();
    await providers.intentFactory.createIntent({
      opportunityId: opp.id,
      amountFiat: 500,
      fiatCurrency: "EUR",
      userRef: "orch-test",
    });

    let state = initialState();
    state = transition(state, { type: "CALL_STARTED" });
    state = transition(state, { type: "RECOMMENDATION_READY" });
    state = transition(state, { type: "USER_DECLINED" });
    expect(state.status).toBe("declined");
  });
});
