import { describe, expect, it } from "vitest";
import { pickStageScreen, type StageSession } from "@/components/stage/types";

function session(partial: Partial<StageSession> = {}): StageSession {
  return {
    callStatus: "idle",
    recommendation: null,
    funding: null,
    updatedAt: 0,
    ...partial,
  };
}

function funding(
  overrides: Partial<NonNullable<StageSession["funding"]>> = {},
): NonNullable<StageSession["funding"]> {
  return {
    sessionId: "fund_test_001",
    intentId: "intent_test_001",
    status: "awaiting_checkout",
    mode: "simulator",
    simulated: true,
    checkoutUrl: "https://example.test/checkout/fund_test_001",
    amountFiat: 1000,
    fiatCurrency: "EUR",
    productName: "Aave v3 USDC",
    protocolLabel: "Aave v3",
    ...overrides,
  };
}

describe("pickStageScreen", () => {
  it("shows the waiting screen when idle and no session", () => {
    expect(pickStageScreen(session())).toBe("waiting");
  });

  it("shows the ringing screen when the call is not yet in-progress", () => {
    expect(pickStageScreen(session({ callStatus: "queued" }))).toBe("ringing");
    expect(pickStageScreen(session({ callStatus: "ringing" }))).toBe(
      "ringing",
    );
  });

  it("shows listening once the call is in-progress but no recommendation yet", () => {
    expect(
      pickStageScreen(session({ callStatus: "in-progress" })),
    ).toBe("listening");
  });

  it("shows the recommendation screen when one has been emitted", () => {
    expect(
      pickStageScreen(
        session({
          callStatus: "in-progress",
          recommendation: {
            intentId: "i",
            productName: "Aave v3 USDC",
            chain: "Base",
            apyPct: 5.2,
            feesPct: 0.1,
            riskSentence: "Smart-contract risk",
            amountFiat: 1000,
            fiatCurrency: "EUR",
            estimatedAnnualReturnFiat: 52,
          },
        }),
      ),
    ).toBe("recommendation");
  });

  it("shows the handoff once funding.awaiting_checkout kicks in", () => {
    expect(
      pickStageScreen(
        session({ callStatus: "in-progress", funding: funding() }),
      ),
    ).toBe("handoff");
  });

  it("shows investing during payment_received / routing_to_yield", () => {
    expect(
      pickStageScreen(
        session({ funding: funding({ status: "payment_received" }) }),
      ),
    ).toBe("investing");
    expect(
      pickStageScreen(
        session({ funding: funding({ status: "routing_to_yield" }) }),
      ),
    ).toBe("investing");
  });

  it("shows the invested finale", () => {
    expect(
      pickStageScreen(session({ funding: funding({ status: "invested" }) })),
    ).toBe("invested");
  });

  it("shows the ended state on cancelled / failed funding", () => {
    expect(
      pickStageScreen(session({ funding: funding({ status: "cancelled" }) })),
    ).toBe("ended");
    expect(
      pickStageScreen(session({ funding: funding({ status: "failed" }) })),
    ).toBe("ended");
  });

  it("shows the ended state when the call ended without funding", () => {
    expect(pickStageScreen(session({ callStatus: "ended" }))).toBe("ended");
  });

  it("funding takes precedence over recommendation", () => {
    expect(
      pickStageScreen(
        session({
          recommendation: {
            intentId: "i",
            productName: "Aave v3 USDC",
            chain: "Base",
            apyPct: 5.2,
            feesPct: 0.1,
            riskSentence: "Smart-contract risk",
            amountFiat: 1000,
            fiatCurrency: "EUR",
            estimatedAnnualReturnFiat: 52,
          },
          funding: funding({ status: "payment_received" }),
        }),
      ),
    ).toBe("investing");
  });
});
