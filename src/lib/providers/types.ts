/**
 * Adapter contracts. Every concrete implementation (mock or real) must satisfy
 * one of these interfaces. Nothing outside src/lib/providers imports concrete
 * implementations directly — routes and components always go through
 * src/lib/providers/index.ts.
 */

export type FiatCurrency = "EUR" | "USD";

export type RiskBand = "conservative" | "moderate" | "aggressive" | "unspecified";

export interface EarnOpportunity {
  id: string;
  name: string;
  chain: string;
  asset: "USDC";
  apyBps: number;
  feesBps: number;
  depositToken: string;
  riskSentence: string;
  riskBand: RiskBand;
}

export interface EarnAdapter {
  listOpportunities(): Promise<EarnOpportunity[]>;
  getOpportunity(id: string): Promise<EarnOpportunity | null>;
}

export interface IntentRequest {
  opportunityId: string;
  amountFiat: number;
  fiatCurrency: FiatCurrency;
  userRef: string;
}

export interface Intent {
  id: string;
  opportunityId: string;
  depositAddress: string;
  depositToken: string;
  depositChain: string;
  expectedUsdcAmount: number;
  createdAt: string;
}

export interface IntentFactoryAdapter {
  createIntent(req: IntentRequest): Promise<Intent>;
  getIntent(id: string): Promise<Intent | null>;
}

export interface ApprovalRequest {
  intentId: string;
  amountFiat: number;
  fiatCurrency: FiatCurrency;
}

export type ApprovalStatus = "pending" | "approved" | "declined";

export interface ApprovalResult {
  approvalId: string;
  intentId: string;
  status: ApprovalStatus;
  errorMessage?: string;
}

/**
 * Revolut adapter — approval channel, NOT a funding rail.
 *
 * `requestApproval()` mocks the "push notification to the caller's phone"
 * moment. The UI reveals a phone-frame with Approve / Decline buttons; tapping
 * one calls the approval store, which flips the result on the next
 * `getApprovalStatus()` poll.
 */
export interface RevolutAdapter {
  requestApproval(req: ApprovalRequest): Promise<ApprovalResult>;
  getApprovalStatus(approvalId: string): Promise<ApprovalResult>;
}

export interface Utterance {
  text: string;
  finalized: boolean;
}

export interface TelephonyAdapter {
  isSupported(): boolean;
  start(onUtterance: (u: Utterance) => void): Promise<void>;
  stop(): Promise<void>;
  speak(text: string): Promise<void>;
}

export interface Providers {
  earn: EarnAdapter;
  intentFactory: IntentFactoryAdapter;
  revolut: RevolutAdapter;
  pricing: import("./pricing/types").PricingAdapter;
  telephony?: TelephonyAdapter;
}
