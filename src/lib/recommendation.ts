import type { EarnOpportunity } from "@/lib/providers/types";

/**
 * Deterministic selection: the demo has exactly one curated opportunity. We
 * return the first one every time. Product search is out of scope.
 */
export function selectOpportunity(
  opportunities: EarnOpportunity[],
): EarnOpportunity | null {
  return opportunities[0] ?? null;
}

export interface ExplanationInput {
  opportunity: EarnOpportunity;
  amountEur: number;
}

export interface Explanation {
  headline: string;
  lines: string[];
  confirmationQuestion: string;
  estimatedAnnualReturnEur: number;
  apyPct: number;
  feesPct: number;
}

const EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const EUR_PRECISE = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/**
 * Generate a short, natural-language explanation for the recommendation.
 * Deliberately plain — no AI-advisor flourish. The same copy is read aloud by
 * the voice agent AND shown on the dashboard card.
 */
export function buildExplanation(input: ExplanationInput): Explanation {
  const { opportunity, amountEur } = input;
  const apyPct = opportunity.apyBps / 100;
  const feesPct = opportunity.feesBps / 100;
  const grossReturn = amountEur * (opportunity.apyBps / 10_000);
  const feesCost = amountEur * (opportunity.feesBps / 10_000);
  const estimatedAnnualReturnEur = Math.max(0, grossReturn - feesCost);

  const amountLabel = EUR.format(amountEur);
  const returnLabel = EUR_PRECISE.format(estimatedAnnualReturnEur);

  const lines: string[] = [
    `${opportunity.name} on ${opportunity.chain} pays about ${apyPct.toFixed(2)}% APY.`,
    `On ${amountLabel}, that's roughly ${returnLabel} per year after fees (${feesPct.toFixed(2)}%).`,
    `Risk: ${opportunity.riskSentence}`,
  ];

  return {
    headline: opportunity.name,
    lines,
    confirmationQuestion: `Do you want to go ahead with ${amountLabel} into ${opportunity.name}?`,
    estimatedAnnualReturnEur,
    apyPct,
    feesPct,
  };
}
