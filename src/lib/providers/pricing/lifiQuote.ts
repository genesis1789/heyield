import { z } from "zod";
import type { DepositCostEstimate, PricingAdapter } from "./types";

/**
 * LI.FI quote-based pricing adapter.
 *
 * Calls the public LI.FI Quote endpoint (open tier, no key required) for a
 * canonical same-chain stablecoin swap on Base. The returned `estimate.gasCosts`
 * and `estimate.feeCosts` give a live snapshot of what on-chain execution costs
 * on Base look like *right now*, which we surface as "est. network cost" on the
 * recommendation card.
 *
 * Endpoint: GET https://li.quest/v1/quote
 * Docs:     https://docs.li.fi/api-reference/get-a-quote-for-a-token-transfer
 *
 * Response paths used (verified against docs):
 *   estimate.feeCosts[].amountUSD
 *   estimate.gasCosts[].amountUSD
 *
 * This adapter NEVER throws: any HTTP/parse failure yields a deterministic
 * fallback so the demo stays reliable.
 *
 * ASSUMPTION: USDC→USDT on Base is an always-routable pair through LI.FI. If
 *   LI.FI rotates routing or the pair is paused, `safeParse` + try/catch fall
 *   through to the seed estimate below.
 */

const QuoteSchema = z.object({
  estimate: z
    .object({
      feeCosts: z
        .array(
          z
            .object({ amountUSD: z.string().optional() })
            .partial()
            .passthrough(),
        )
        .optional(),
      gasCosts: z
        .array(
          z
            .object({ amountUSD: z.string().optional() })
            .partial()
            .passthrough(),
        )
        .optional(),
    })
    .passthrough(),
});

const QUOTE_URL = "https://li.quest/v1/quote";
const BASE_CHAIN = 8453;
// 10 USDC (6 decimals) — small enough to keep any reported fee sensible.
const PROBE_AMOUNT_USDC_UNITS = "10000000";
// Zero-ish sender is fine — LI.FI's quote endpoint estimates, never executes.
const PROBE_FROM_ADDRESS = "0x0000000000000000000000000000000000000001";
const FETCH_TIMEOUT_MS = 4000;

// Fallback used whenever LI.FI is unreachable or returns an unexpected shape.
// Seeded from historical Base median costs — small, credible, never zero.
const FALLBACK: DepositCostEstimate = {
  gasUsd: 0.02,
  feeUsd: 0,
  source: "fallback",
};

function sumAmounts(items?: { amountUSD?: string }[]): number {
  if (!items) return 0;
  let total = 0;
  for (const it of items) {
    const v = Number.parseFloat(it.amountUSD ?? "0");
    if (Number.isFinite(v) && v > 0) total += v;
  }
  return total;
}

export class LifiPricingAdapter implements PricingAdapter {
  constructor(private readonly apiKey?: string) {}

  async estimateDepositCost(): Promise<DepositCostEstimate> {
    const params = new URLSearchParams({
      fromChain: String(BASE_CHAIN),
      toChain: String(BASE_CHAIN),
      fromToken: "USDC",
      toToken: "USDT",
      fromAmount: PROBE_AMOUNT_USDC_UNITS,
      fromAddress: PROBE_FROM_ADDRESS,
    });
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers["x-lifi-api-key"] = this.apiKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${QUOTE_URL}?${params.toString()}`, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok) return FALLBACK;
      const parsed = QuoteSchema.safeParse(await res.json());
      if (!parsed.success) return FALLBACK;
      const gasUsd = sumAmounts(parsed.data.estimate.gasCosts);
      const feeUsd = sumAmounts(parsed.data.estimate.feeCosts);
      return { gasUsd, feeUsd, source: "lifi" };
    } catch {
      return FALLBACK;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const fallbackDepositCost: DepositCostEstimate = FALLBACK;
