import { z } from "zod";
import type { EarnAdapter, EarnOpportunity } from "@/lib/providers/types";
import { SEED_OPPORTUNITY, SEED_OPPORTUNITIES } from "@/lib/seed/opportunities";

/**
 * Real LI.FI Earn adapter — HYBRID.
 *
 * Fetches live vault list + APY from the public LI.FI Earn Data API, then
 * overlays the seed opportunity's risk copy and fee estimate onto the live
 * APY (the Earn API does NOT return a protocol-fee field or risk copy).
 * Any fetch/parse failure falls through to the seed opportunity so the demo
 * never breaks.
 *
 * Endpoint: GET https://earn.li.fi/v1/earn/vaults
 * Auth:     x-lifi-api-key header  (https://docs.li.fi/earn/guides/api-integration)
 * Rate:     50 req/min per key — no sandbox documented.
 *
 * Response shape verified from docs (NormalizedVault):
 *   { data: [{ address, chainId, name, protocol: { name }, underlyingTokens: [{ symbol }],
 *              analytics: { apy: { total } } }], nextCursor, total }
 *
 * ASSUMPTION: `analytics.apy.total` is a decimal fraction (e.g. 0.052 for 5.2%).
 *   Docs describe it as "APY" without units. Guarded below: if value > 1 we
 *   treat it as already-percent and divide by 100 before converting to bps.
 */

const VaultSchema = z.object({
  address: z.string(),
  chainId: z.number(),
  name: z.string(),
  protocol: z.object({ name: z.string() }).partial().passthrough(),
  underlyingTokens: z
    .array(z.object({ symbol: z.string() }).partial().passthrough())
    .default([]),
  analytics: z
    .object({
      apy: z
        .object({
          total: z.number().optional(),
        })
        .partial()
        .passthrough()
        .optional(),
    })
    .partial()
    .passthrough()
    .optional(),
});

const ResponseSchema = z.object({
  data: z.array(VaultSchema.passthrough()),
});

const BASE_URL = "https://earn.li.fi/v1/earn/vaults";
const BASE_CHAIN_ID = 8453;
const FETCH_TIMEOUT_MS = 4000;

function toBps(apyTotal: number | undefined): number | null {
  if (apyTotal === undefined || !Number.isFinite(apyTotal) || apyTotal < 0) return null;
  // ASSUMPTION: docs don't fix units. Branch on magnitude to be safe.
  const pct = apyTotal > 1 ? apyTotal : apyTotal * 100;
  return Math.round(pct * 100); // pct * 100 = bps
}

export class LifiEarnAdapter implements EarnAdapter {
  constructor(private readonly apiKey: string) {}

  private async fetchVaults(): Promise<z.infer<typeof VaultSchema>[] | null> {
    if (!this.apiKey) return null;
    const url = `${BASE_URL}?chainId=${BASE_CHAIN_ID}&asset=USDC&limit=50`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "x-lifi-api-key": this.apiKey, accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const parsed = ResponseSchema.safeParse(await res.json());
      if (!parsed.success) return null;
      return parsed.data.data;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private pickAaveUsdcBase(vaults: z.infer<typeof VaultSchema>[]): z.infer<typeof VaultSchema> | null {
    return (
      vaults.find(
        (v) =>
          v.chainId === BASE_CHAIN_ID &&
          (v.protocol?.name ?? "").toLowerCase().includes("aave") &&
          v.underlyingTokens.some((t) => (t.symbol ?? "").toUpperCase() === "USDC"),
      ) ?? null
    );
  }

  async listOpportunities(): Promise<EarnOpportunity[]> {
    const vaults = await this.fetchVaults();
    if (!vaults) return SEED_OPPORTUNITIES;
    const match = this.pickAaveUsdcBase(vaults);
    if (!match) return SEED_OPPORTUNITIES;
    const bps = toBps(match.analytics?.apy?.total);
    // Keep the seed opportunity's identity so downstream code (intent creation,
    // UI copy) stays deterministic. Only the live APY is overlaid.
    return [{ ...SEED_OPPORTUNITY, apyBps: bps ?? SEED_OPPORTUNITY.apyBps }];
  }

  async getOpportunity(id: string): Promise<EarnOpportunity | null> {
    const all = await this.listOpportunities();
    return all.find((o) => o.id === id) ?? null;
  }
}
