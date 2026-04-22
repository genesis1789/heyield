import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersistentMockIntentFactoryAdapter } from "@/lib/providers/intentFactory/mock";
import { LifiEarnAdapter } from "@/lib/providers/earn/lifi";
import { LifiPricingAdapter } from "@/lib/providers/pricing/lifiQuote";
import {
  SimulatorFundingAdapter,
  type SimulatorConfig,
} from "@/lib/providers/funding/simulator";
import { SEED_OPPORTUNITY } from "@/lib/seed/opportunities";
import { VapiTelephonyAdapter } from "@/lib/providers/telephony/vapi";
import { writeJsonFile } from "@/lib/server/jsonStore";

/**
 * Tests for the adapter surface after the funding-rail rework. Every real
 * adapter MUST fall back gracefully rather than throw.
 */

const originalFetch = globalThis.fetch;

function mockFetch(impl: typeof fetch) {
  globalThis.fetch = impl as unknown as typeof fetch;
}

function resetPersistentDemoStores() {
  writeJsonFile("mock-intents.json", { counter: 0, intents: {} });
}

let simSeq = 0;
function simulatorConfig(overrides: Partial<SimulatorConfig> = {}): SimulatorConfig {
  return {
    appBaseUrl: "http://localhost:3000",
    destWalletAddress: "0x0000000000000000000000000000000000000000",
    stepMs: 0,
    forceFailure: false,
    skipDelays: true,
    protocolLabel: "Aave v3",
    txExplorerUrlTemplate: "https://sepolia.etherscan.io/tx/{hash}",
    // Unique file per adapter instance so parallel vitest workers don't
    // clobber each other's state.
    storeFile: `funding-sessions.adapter-test-${process.pid}-${++simSeq}.json`,
    ...overrides,
  };
}

describe("LifiEarnAdapter (hybrid-real)", () => {
  beforeEach(() => {
    mockFetch(vi.fn());
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns seed opportunities when no API key is configured", async () => {
    const adapter = new LifiEarnAdapter("");
    const opps = await adapter.listOpportunities();
    expect(opps).toHaveLength(1);
    expect(opps[0].id).toBe(SEED_OPPORTUNITY.id);
    expect(opps[0].apyBps).toBe(SEED_OPPORTUNITY.apyBps);
  });

  it("overlays live APY onto the seed when the real API returns a matching Aave vault", async () => {
    mockFetch(
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                address: "0xvault",
                chainId: 8453,
                name: "Aave v3 USDC",
                protocol: { name: "Aave v3" },
                underlyingTokens: [{ symbol: "USDC" }],
                analytics: { apy: { total: 0.073 } },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const adapter = new LifiEarnAdapter("test-key");
    const opps = await adapter.listOpportunities();
    expect(opps).toHaveLength(1);
    expect(opps[0].apyBps).toBe(730);
    expect(opps[0].id).toBe(SEED_OPPORTUNITY.id);
    expect(opps[0].riskBand).toBe(SEED_OPPORTUNITY.riskBand);
    expect(opps[0].feesBps).toBe(SEED_OPPORTUNITY.feesBps);
  });

  it("falls back to seed on HTTP error", async () => {
    mockFetch(vi.fn(async () => new Response("nope", { status: 500 })));
    const adapter = new LifiEarnAdapter("test-key");
    const opps = await adapter.listOpportunities();
    expect(opps[0].apyBps).toBe(SEED_OPPORTUNITY.apyBps);
  });

  it("getOpportunity matches by id via listOpportunities", async () => {
    const adapter = new LifiEarnAdapter("");
    const match = await adapter.getOpportunity(SEED_OPPORTUNITY.id);
    expect(match?.id).toBe(SEED_OPPORTUNITY.id);
    const miss = await adapter.getOpportunity("does-not-exist");
    expect(miss).toBeNull();
  });
});

describe("LifiPricingAdapter", () => {
  beforeEach(() => {
    mockFetch(vi.fn());
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sums gas + fee costs from a quote response", async () => {
    mockFetch(
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            estimate: {
              gasCosts: [{ amountUSD: "0.03" }, { amountUSD: "0.01" }],
              feeCosts: [{ amountUSD: "0.25" }],
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const adapter = new LifiPricingAdapter();
    const est = await adapter.estimateDepositCost();
    expect(est.source).toBe("lifi");
    expect(est.gasUsd).toBeCloseTo(0.04, 6);
    expect(est.feeUsd).toBeCloseTo(0.25, 6);
  });

  it("falls back to a fixed deterministic estimate on HTTP failure", async () => {
    mockFetch(vi.fn(async () => new Response("boom", { status: 502 })));
    const est = await new LifiPricingAdapter().estimateDepositCost();
    expect(est.source).toBe("fallback");
    expect(est.gasUsd).toBeGreaterThan(0);
  });
});

describe("VapiTelephonyAdapter", () => {
  it("reports unsupported when keys are missing", () => {
    expect(new VapiTelephonyAdapter("", "asst").isSupported()).toBe(false);
    expect(new VapiTelephonyAdapter("pk", "").isSupported()).toBe(false);
  });

  it("start throws when not configured", async () => {
    const adapter = new VapiTelephonyAdapter("", "");
    await expect(adapter.start(() => {})).rejects.toThrow(/not configured/i);
  });
});

describe("persistent mock stores", () => {
  beforeEach(() => {
    resetPersistentDemoStores();
  });
  afterEach(() => {
    resetPersistentDemoStores();
  });

  it("shares intents across adapter instances", async () => {
    const creator = new PersistentMockIntentFactoryAdapter();
    const reader = new PersistentMockIntentFactoryAdapter();

    const intent = await creator.createIntent({
      opportunityId: "opp_1",
      amountFiat: 1000,
      fiatCurrency: "EUR",
      userRef: "test",
    });

    await expect(reader.getIntent(intent.id)).resolves.toMatchObject({
      id: intent.id,
      opportunityId: "opp_1",
    });
  });
});

describe("SimulatorFundingAdapter", () => {
  beforeEach(() => {
    resetPersistentDemoStores();
  });
  afterEach(() => {
    resetPersistentDemoStores();
  });

  it("creates a session with a local checkout URL and deterministic id", async () => {
    const adapter = new SimulatorFundingAdapter(simulatorConfig());
    const session = await adapter.createSession({
      intentId: "intent_demo_001",
      amountFiat: 1000,
      fiatCurrency: "EUR",
      productName: "Aave v3 USDC",
    });
    expect(session.sessionId).toBe("fund_sim_001");
    expect(session.checkoutUrl).toBe(
      "http://localhost:3000/checkout/fund_sim_001",
    );
    expect(session.status).toBe("awaiting_checkout");
    expect(session.simulated).toBe(true);
  });

  it("advances to invested after confirm_payment with zero-delay steps", async () => {
    const adapter = new SimulatorFundingAdapter(simulatorConfig({ stepMs: 0 }));
    const session = await adapter.createSession({
      intentId: "intent_demo_001",
      amountFiat: 1000,
      fiatCurrency: "EUR",
      productName: "Aave v3 USDC",
    });
    const paid = await adapter.advance!(session.sessionId, {
      type: "confirm_payment",
    });
    expect(paid?.status).toBe("payment_received");

    const settled = await adapter.getSession(session.sessionId);
    expect(settled?.status).toBe("invested");
    expect(settled?.txHash).toBeTruthy();
    expect(settled?.txExplorerUrl).toContain(settled?.txHash ?? "");
  });

  it("force-failure flips the session on the first confirm_payment tap", async () => {
    const adapter = new SimulatorFundingAdapter(
      simulatorConfig({ forceFailure: true }),
    );
    const session = await adapter.createSession({
      intentId: "intent_demo_001",
      amountFiat: 1000,
      fiatCurrency: "EUR",
      productName: "Aave v3 USDC",
    });
    const result = await adapter.advance!(session.sessionId, {
      type: "confirm_payment",
    });
    expect(result?.status).toBe("failed");
    expect(result?.errorMessage).toMatch(/declined/i);
  });

  it("cancel during awaiting_checkout moves to cancelled", async () => {
    const adapter = new SimulatorFundingAdapter(simulatorConfig());
    const session = await adapter.createSession({
      intentId: "intent_demo_001",
      amountFiat: 1000,
      fiatCurrency: "EUR",
      productName: "Aave v3 USDC",
    });
    const cancelled = await adapter.advance!(session.sessionId, {
      type: "cancel",
    });
    expect(cancelled?.status).toBe("cancelled");
  });

  it("getSession returns null for unknown ids", async () => {
    const adapter = new SimulatorFundingAdapter(simulatorConfig());
    await expect(adapter.getSession("nope")).resolves.toBeNull();
  });
});
