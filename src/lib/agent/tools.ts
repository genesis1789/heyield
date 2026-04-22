import { getProviders } from "@/lib/providers";
import { buildExplanation, selectOpportunity } from "@/lib/recommendation";
import type { ApprovalStatus } from "@/lib/providers/types";
import { setApproval, setRecommendation } from "./session";

/**
 * Agent-facing tool handlers.
 *
 * These are the four operations the Vapi assistant can invoke mid-conversation
 * via our /api/vapi/webhook endpoint. Each handler is a pure async function
 * that takes already-validated arguments and hits the central provider
 * factory — so UI, webhook, and tests all share the same code path.
 */

export interface RecommendOutput {
  intentId: string;
  productName: string;
  chain: string;
  apyPct: number;
  estimatedAnnualReturnFiat: number;
  feesPct: number;
  riskSentence: string;
  explanationLines: string[];
  confirmationQuestion: string;
  /** Currency the caller used; echoed back so the agent can read the amount naturally. */
  fiatCurrency: "EUR" | "USD";
  amountFiat: number;
  /** Live LI.FI gas + fee snapshot for the "network cost" line. */
  networkCostUsd: number;
  networkCostSource: "lifi" | "fallback";
}

export async function recommend(args: {
  amountFiat: number;
  fiatCurrency?: "EUR" | "USD";
}): Promise<RecommendOutput> {
  const { earn, intentFactory, pricing } = getProviders();
  const opportunities = await earn.listOpportunities();
  const opp = selectOpportunity(opportunities);
  if (!opp) throw new Error("No earn opportunity available");

  const fiatCurrency = args.fiatCurrency ?? "EUR";
  const explanation = buildExplanation({
    opportunity: opp,
    amountEur: args.amountFiat,
  });

  const intent = await intentFactory.createIntent({
    opportunityId: opp.id,
    amountFiat: args.amountFiat,
    fiatCurrency,
    userRef: "voice-agent",
  });

  const cost = await pricing.estimateDepositCost();

  const output: RecommendOutput = {
    intentId: intent.id,
    productName: opp.name,
    chain: opp.chain,
    apyPct: explanation.apyPct,
    estimatedAnnualReturnFiat: explanation.estimatedAnnualReturnEur,
    feesPct: explanation.feesPct,
    riskSentence: opp.riskSentence,
    explanationLines: explanation.lines,
    confirmationQuestion: explanation.confirmationQuestion,
    fiatCurrency,
    amountFiat: args.amountFiat,
    networkCostUsd: cost.gasUsd + cost.feeUsd,
    networkCostSource: cost.source,
  };
  setRecommendation(output);
  return output;
}

export interface CreateApprovalOutput {
  approvalId: string;
  intentId: string;
  status: ApprovalStatus;
}

export async function createApproval(args: {
  intentId: string;
  amountFiat?: number;
  fiatCurrency?: "EUR" | "USD";
}): Promise<CreateApprovalOutput> {
  const { intentFactory, revolut } = getProviders();
  const intent = await intentFactory.getIntent(args.intentId);
  if (!intent) throw new Error(`Intent not found: ${args.intentId}`);

  const result = await revolut.requestApproval({
    intentId: intent.id,
    amountFiat: args.amountFiat ?? intent.expectedUsdcAmount,
    fiatCurrency: args.fiatCurrency ?? "EUR",
  });

  const output: CreateApprovalOutput = {
    approvalId: result.approvalId,
    intentId: result.intentId,
    status: result.status,
  };
  setApproval(output);
  return output;
}

export interface GetApprovalStatusOutput {
  approvalId: string;
  status: ApprovalStatus;
  errorMessage?: string;
}

export async function getApprovalStatus(args: {
  approvalId: string;
}): Promise<GetApprovalStatusOutput> {
  const { revolut } = getProviders();
  const res = await revolut.getApprovalStatus(args.approvalId);
  setApproval({
    approvalId: res.approvalId,
    intentId: res.intentId,
    status: res.status,
    errorMessage: res.errorMessage,
  });
  return {
    approvalId: res.approvalId,
    status: res.status,
    errorMessage: res.errorMessage,
  };
}

export interface EndCallOutput {
  acknowledged: true;
}

export async function endCall(_args: { reason?: string }): Promise<EndCallOutput> {
  void _args;
  return { acknowledged: true };
}
