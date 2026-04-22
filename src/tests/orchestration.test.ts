import { describe, expect, it } from "vitest";
import { buildTestProviders } from "@/lib/providers";
import { initialState, transition } from "@/lib/state/machine";
import type { DemoState } from "@/lib/state/types";

/**
 * End-to-end happy path using simulator adapters. Exercises the same
 * transitions the dashboard drives: CALL_STARTED → RECOMMENDATION_READY
 * → USER_CONFIRMED → PAYMENT_RECEIVED → CRYPTO_IN_FLIGHT → INVESTED.
 * The concierge agent layer is simulated via direct adapter calls.
 *
 * Each `buildTestProviders()` call gets a unique file-store so parallel
 * vitest workers never race on the same funding-sessions file.
 */
describe("happy-path orchestration with simulator funding", () => {
  it("drives from call start to invested with a Revolut sandbox tap", async () => {
    const { providers } = buildTestProviders();
    const visited: DemoState["status"][] = [];
    let state = initialState();
    const step = (ev: Parameters<typeof transition>[1]) => {
      state = transition(state, ev);
      visited.push(state.status);
    };

    step({ type: "CALL_STARTED" });

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

    step({ type: "USER_CONFIRMED" });
    const session = await providers.funding.createSession({
      intentId: intent.id,
      amountFiat: 1000,
      fiatCurrency: "EUR",
      productName: opp.name,
    });
    expect(session.sessionId).toMatch(/^fund_sim_/);
    expect(session.status).toBe("awaiting_checkout");
    expect(session.checkoutUrl).toContain(`/checkout/${session.sessionId}`);

    // Sandbox "Pay" click → advance_payment.
    const paid = await providers.funding.advance!(session.sessionId, {
      type: "confirm_payment",
    });
    expect(paid?.status).toBe("payment_received");
    step({ type: "PAYMENT_RECEIVED" });

    // Simulator uses timestamp-based progression. With stepMs=0 the next
    // poll should land us squarely on invested.
    const settled = await providers.funding.getSession(session.sessionId);
    expect(settled?.status).toBe("invested");
    expect(settled?.txHash).toMatch(/^0x[0-9a-f]+$/);
    step({ type: "INVESTED" });

    expect(state.status).toBe("invested");
    expect(visited).toEqual([
      "call_active",
      "recommended",
      "awaiting_checkout",
      "payment_received",
      "invested",
    ]);
  });

  it("demoable failure: force-failure flips the sandbox tap to failed", async () => {
    const { providers } = buildTestProviders({ forceFailure: true });

    const [opp] = await providers.earn.listOpportunities();
    const intent = await providers.intentFactory.createIntent({
      opportunityId: opp.id,
      amountFiat: 1000,
      fiatCurrency: "EUR",
      userRef: "orch-test",
    });
    const session = await providers.funding.createSession({
      intentId: intent.id,
      amountFiat: 1000,
      fiatCurrency: "EUR",
      productName: opp.name,
    });

    const result = await providers.funding.advance!(session.sessionId, {
      type: "confirm_payment",
    });
    expect(result?.status).toBe("failed");
    expect(result?.errorMessage).toMatch(/declined/i);

    let state = initialState();
    state = transition(state, { type: "CALL_STARTED" });
    state = transition(state, { type: "RECOMMENDATION_READY" });
    state = transition(state, { type: "USER_CONFIRMED" });
    state = transition(state, { type: "FAIL", reason: result?.errorMessage ?? "" });
    expect(state.status).toBe("failed");
  });

  it("verbal decline at the recommended step lands on cancelled without a funding session", async () => {
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
    expect(state.status).toBe("cancelled");
  });
});
