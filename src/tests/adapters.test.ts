import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PersistentMockIntentFactoryAdapter,
} from "@/lib/providers/intentFactory/mock";
import { LifiEarnAdapter } from "@/lib/providers/earn/lifi";
import { LifiPricingAdapter } from "@/lib/providers/pricing/lifiQuote";
import {
  type MockRevolutConfigRef,
  PersistentMockRevolutAdapter,
} from "@/lib/providers/revolut/mock";
import { SEED_OPPORTUNITY } from "@/lib/seed/opportunities";
import { VapiTelephonyAdapter } from "@/lib/providers/telephony/vapi";
import { RealRevolutAdapter } from "@/lib/providers/revolut/real";
import { writeJsonFile } from "@/lib/server/jsonStore";

/**
 * Tests for the adapter changes introduced by the provider-upgrade audit.
 * Every real adapter MUST fall back gracefully rather than throw, except
 * where the stub is intentionally unimplemented (RealRevolutAdapter).
 */

const originalFetch = globalThis.fetch;

function mockFetch(impl: typeof fetch) {
  globalThis.fetch = impl as unknown as typeof fetch;
}

function resetPersistentDemoStores() {
  writeJsonFile("mock-intents.json", { counter: 0, intents: {} });
  writeJsonFile("mock-approvals.json", { counter: 0, approvals: {} });
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
                analytics: { apy: { total: 0.073 } }, // 7.30%
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
    // identity, risk, and fees stay from the seed
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

  it("falls back to seed when response shape is unexpected", async () => {
    mockFetch(
      vi.fn(async () => new Response(JSON.stringify({ wrong: "shape" }), { status: 200 })),
    );
    const adapter = new LifiEarnAdapter("test-key");
    const opps = await adapter.listOpportunities();
    expect(opps[0].apyBps).toBe(SEED_OPPORTUNITY.apyBps);
  });

  it("falls back to seed when no Aave USDC vault is returned", async () => {
    mockFetch(
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                address: "0xother",
                chainId: 1,
                name: "Compound USDT",
                protocol: { name: "Compound" },
                underlyingTokens: [{ symbol: "USDT" }],
                analytics: { apy: { total: 0.1 } },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const adapter = new LifiEarnAdapter("test-key");
    const opps = await adapter.listOpportunities();
    expect(opps[0].apyBps).toBe(SEED_OPPORTUNITY.apyBps);
  });

  it("tolerates analytics.apy.total already expressed as a percentage", async () => {
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
                analytics: { apy: { total: 5.2 } }, // already "5.2 %"
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const adapter = new LifiEarnAdapter("test-key");
    const opps = await adapter.listOpportunities();
    expect(opps[0].apyBps).toBe(520);
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

  it("falls back on malformed JSON", async () => {
    mockFetch(vi.fn(async () => new Response("not-json", { status: 200 })));
    const est = await new LifiPricingAdapter().estimateDepositCost();
    expect(est.source).toBe("fallback");
  });
});

describe("VapiTelephonyAdapter", () => {
  it("reports unsupported when keys are missing", () => {
    expect(new VapiTelephonyAdapter("", "asst").isSupported()).toBe(false);
    expect(new VapiTelephonyAdapter("pk", "").isSupported()).toBe(false);
  });

  it("reports supported only when window + keys both exist", () => {
    // jsdom provides a window in Vitest's default environment; this suite
    // pins the check to what the adapter actually inspects.
    const wasWindow = "window" in globalThis;
    if (!wasWindow) (globalThis as unknown as { window: object }).window = {};
    const adapter = new VapiTelephonyAdapter("pk", "asst");
    expect(adapter.isSupported()).toBe(true);
    if (!wasWindow) delete (globalThis as unknown as { window?: object }).window;
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

  it("shares approval taps across adapter instances", async () => {
    const config: MockRevolutConfigRef = {
      forceFailure: false,
      skipDelays: false,
      confirmAfterMs: 1500,
    };
    const creator = new PersistentMockRevolutAdapter(config);
    const tapper = new PersistentMockRevolutAdapter(config);
    const poller = new PersistentMockRevolutAdapter(config);

    const approval = await creator.requestApproval({
      intentId: "intent_demo_001",
      amountFiat: 1000,
      fiatCurrency: "EUR",
    });
    expect(approval.status).toBe("pending");

    expect(tapper.recordTap(approval.approvalId, "approve")).toMatchObject({
      approvalId: approval.approvalId,
      status: "approved",
    });

    await expect(poller.getApprovalStatus(approval.approvalId)).resolves.toMatchObject({
      approvalId: approval.approvalId,
      status: "approved",
    });
  });
});

describe("RealRevolutAdapter (intentional stub)", () => {
  it("requestApproval throws with a message pointing to the documented boundary", async () => {
    const adapter = new RealRevolutAdapter("key");
    await expect(
      adapter.requestApproval({
        intentId: "x",
        amountFiat: 1,
        fiatCurrency: "EUR",
      }),
    ).rejects.toThrow(/Revolut|mock/i);
  });
});
