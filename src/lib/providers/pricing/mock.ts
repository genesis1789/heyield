import type { DepositCostEstimate, PricingAdapter } from "./types";

/**
 * Mock pricing adapter — returns deterministic, plausible numbers.
 */
export class MockPricingAdapter implements PricingAdapter {
  async estimateDepositCost(): Promise<DepositCostEstimate> {
    return { gasUsd: 0.02, feeUsd: 0, source: "fallback" };
  }
}
