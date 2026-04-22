export interface DepositCostEstimate {
  /** Summed gas cost for the on-chain deposit leg, in USD. */
  gasUsd: number;
  /** Summed routing / protocol fees reported by LI.FI, in USD. */
  feeUsd: number;
  /** Human label for the source. `"lifi"` when the quote API returned data. */
  source: "lifi" | "fallback";
}

export interface PricingAdapter {
  /**
   * Returns an estimated on-chain cost snapshot for the "deposit into Earn"
   * leg. Implementations MUST resolve to a reasonable fallback rather than
   * throwing — the demo never hinges on this call succeeding.
   */
  estimateDepositCost(): Promise<DepositCostEstimate>;
}
