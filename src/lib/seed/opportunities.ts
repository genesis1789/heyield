import { EarnOpportunitySchema } from "@/lib/schemas";
import type { EarnOpportunity } from "@/lib/providers/types";

/**
 * One curated Earn opportunity. The demo always recommends this — product
 * choice is intentionally out of scope. APY and fees are placeholders until
 * the real LI.FI Earn adapter is wired.
 */
export const SEED_OPPORTUNITY: EarnOpportunity = {
  id: "usdc-aave-base-v3",
  name: "Aave v3 USDC",
  chain: "Base",
  asset: "USDC",
  apyBps: 520, // 5.20% — placeholder until real LI.FI Earn data is wired
  feesBps: 10, // 0.10% — placeholder
  depositToken: "USDC",
  riskSentence:
    "Smart-contract exposure in Aave plus the USDC peg — not FDIC-insured and yields can move.",
  riskBand: "moderate",
};

EarnOpportunitySchema.parse(SEED_OPPORTUNITY);

export const SEED_OPPORTUNITIES: EarnOpportunity[] = [SEED_OPPORTUNITY];
