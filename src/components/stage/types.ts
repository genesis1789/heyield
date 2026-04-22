/**
 * Shared shape for the phone-side view of an agent session. The stage reads
 * the same session blob the dashboard reads, but cares about a narrower
 * subset of fields.
 */

import type {
  FundingProviderKind,
  FundingStatus,
} from "@/lib/providers/funding/types";
import type { FiatCurrency } from "@/lib/providers/types";
import type { CallStatus } from "@/lib/agent/session";

export interface StageRecommendation {
  intentId: string;
  productName: string;
  chain: string;
  apyPct: number;
  feesPct: number;
  riskSentence: string;
  amountFiat: number;
  fiatCurrency: FiatCurrency;
  estimatedAnnualReturnFiat: number;
}

export interface StageFunding {
  sessionId: string;
  intentId: string;
  status: FundingStatus;
  mode: FundingProviderKind;
  simulated: boolean;
  checkoutUrl: string;
  amountFiat: number;
  fiatCurrency: FiatCurrency;
  productName: string;
  protocolLabel: string;
  destWalletAddress?: string;
  txHash?: string;
  txExplorerUrl?: string;
  errorMessage?: string;
}

export interface StageSession {
  callStatus: CallStatus;
  recommendation: StageRecommendation | null;
  funding: StageFunding | null;
  updatedAt: number;
}

/**
 * The eight mutually-exclusive stage screens. The frame picks one based on
 * call + funding + recommendation state.
 */
export type StageScreen =
  | "waiting"       // pre-call, no call yet
  | "ringing"       // call initiated but not yet in-progress
  | "listening"     // call live, no recommendation yet
  | "recommendation"// agent has a product to show
  | "handoff"       // funding session created, awaiting user to pay
  | "investing"     // money is moving (payment_received / routing_to_yield)
  | "invested"      // terminal success
  | "ended";        // cancelled / failed / call ended without funding

export const INVESTING_STATUSES = new Set<FundingStatus>([
  "payment_received",
  "routing_to_yield",
]);

export const ENDED_STATUSES = new Set<FundingStatus>([
  "cancelled",
  "failed",
]);

/**
 * Pure mapper: session snapshot -> which StageScreen to render.
 * Exported standalone so it can be unit-tested without React.
 */
export function pickStageScreen(session: StageSession): StageScreen {
  const { callStatus, recommendation, funding } = session;

  if (funding) {
    if (funding.status === "invested") return "invested";
    if (ENDED_STATUSES.has(funding.status)) return "ended";
    if (INVESTING_STATUSES.has(funding.status)) return "investing";
    if (funding.status === "awaiting_checkout") return "handoff";
  }

  if (recommendation) return "recommendation";

  if (callStatus === "in-progress") return "listening";
  if (callStatus === "ended") return "ended";
  if (callStatus !== "idle") return "ringing";

  return "waiting";
}
