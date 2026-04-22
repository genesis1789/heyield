import { getProviders } from "@/lib/providers";
import { buildExplanation, selectOpportunity } from "@/lib/recommendation";
import type {
  FundingProviderKind,
  FundingStatus,
} from "@/lib/providers/funding/types";
import { setFunding, setRecommendation } from "./session";

/**
 * Agent-facing tool handlers.
 *
 * These are the operations the Vapi assistant can invoke mid-conversation
 * via our /api/vapi/webhook endpoint. Each handler is a pure async function
 * that takes already-validated arguments and hits the central provider
 * factory — so UI, webhook, and tests share the same code path.
 *
 * After the voice brief was reframed ("talk to your money, watch it invest"),
 * the Revolut step is a FUNDING RAIL not an approval channel:
 *   recommend            – pick + explain the product
 *   startFunding         – create a Revolut checkout session
 *   getFundingStatus     – poll lifecycle until the money is invested
 *   endCall              – hang up
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

export interface StartFundingOutput {
  sessionId: string;
  /** URL the agent tells the caller to open; also surfaced on the dashboard. */
  checkoutUrl: string;
  status: FundingStatus;
  mode: FundingProviderKind;
  simulated: boolean;
}

export async function startFunding(args: {
  intentId: string;
  amountFiat?: number;
  fiatCurrency?: "EUR" | "USD";
}): Promise<StartFundingOutput> {
  const { intentFactory, funding } = getProviders();
  const intent = await intentFactory.getIntent(args.intentId);
  if (!intent) throw new Error(`Intent not found: ${args.intentId}`);

  // Resolve the real fiat amount the caller confirmed. We keep the
  // recommendation as the source of truth; intent.expectedUsdcAmount is
  // the USDC equivalent and would misstate fiat on the card.
  const amountFiat = args.amountFiat ?? intent.expectedUsdcAmount;
  const fiatCurrency = args.fiatCurrency ?? "EUR";

  // Product name for the checkout description. We pull it from the
  // earn adapter so it stays in sync with the recommendation card.
  const { earn } = getProviders();
  const opp = await earn.getOpportunity(intent.opportunityId);
  const productName = opp?.name ?? "Earn product";

  const session = await funding.createSession({
    intentId: intent.id,
    amountFiat,
    fiatCurrency,
    productName,
  });

  setFunding({
    sessionId: session.sessionId,
    intentId: session.intentId,
    status: session.status,
    mode: session.mode,
    simulated: session.simulated,
    checkoutUrl: session.checkoutUrl,
    amountFiat: session.amountFiat,
    fiatCurrency: session.fiatCurrency,
    productName: session.productName,
    protocolLabel: session.protocolLabel,
    destWalletAddress: session.destWalletAddress,
    txHash: session.txHash,
    txExplorerUrl: session.txExplorerUrl,
    errorMessage: session.errorMessage,
  });

  return {
    sessionId: session.sessionId,
    checkoutUrl: session.checkoutUrl,
    status: session.status,
    mode: session.mode,
    simulated: session.simulated,
  };
}

export interface GetFundingStatusOutput {
  sessionId: string;
  status: FundingStatus;
  mode: FundingProviderKind;
  simulated: boolean;
  checkoutUrl?: string;
  txHash?: string;
  txExplorerUrl?: string;
  errorMessage?: string;
}

export async function getFundingStatus(args: {
  sessionId: string;
}): Promise<GetFundingStatusOutput> {
  const { funding } = getProviders();
  const session = await funding.getSession(args.sessionId);
  if (!session) {
    return {
      sessionId: args.sessionId,
      status: "failed",
      mode: "simulator",
      simulated: true,
      errorMessage: "Funding session not found.",
    };
  }
  setFunding({
    sessionId: session.sessionId,
    intentId: session.intentId,
    status: session.status,
    mode: session.mode,
    simulated: session.simulated,
    checkoutUrl: session.checkoutUrl,
    amountFiat: session.amountFiat,
    fiatCurrency: session.fiatCurrency,
    productName: session.productName,
    protocolLabel: session.protocolLabel,
    destWalletAddress: session.destWalletAddress,
    txHash: session.txHash,
    txExplorerUrl: session.txExplorerUrl,
    errorMessage: session.errorMessage,
  });
  return {
    sessionId: session.sessionId,
    status: session.status,
    mode: session.mode,
    simulated: session.simulated,
    checkoutUrl: session.checkoutUrl,
    txHash: session.txHash,
    txExplorerUrl: session.txExplorerUrl,
    errorMessage: session.errorMessage,
  };
}

export interface EndCallOutput {
  acknowledged: true;
}

export async function endCall(_args: { reason?: string }): Promise<EndCallOutput> {
  void _args;
  return { acknowledged: true };
}
