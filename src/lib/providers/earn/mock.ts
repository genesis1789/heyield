import type { EarnAdapter, EarnOpportunity } from "@/lib/providers/types";
import { SEED_OPPORTUNITIES } from "@/lib/seed/opportunities";

export class MockEarnAdapter implements EarnAdapter {
  async listOpportunities(): Promise<EarnOpportunity[]> {
    return SEED_OPPORTUNITIES;
  }

  async getOpportunity(id: string): Promise<EarnOpportunity | null> {
    return SEED_OPPORTUNITIES.find((o) => o.id === id) ?? null;
  }
}
