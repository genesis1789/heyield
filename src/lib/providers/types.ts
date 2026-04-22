/**
 * Adapter contracts. Every concrete implementation (mock or real) must satisfy
 * one of these interfaces. Nothing outside src/lib/providers imports concrete
 * implementations directly — routes and components always go through
 * src/lib/providers/index.ts.
 */

import type { FundingAdapter } from "./funding/types";

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
  funding: FundingAdapter;
  pricing: import("./pricing/types").PricingAdapter;
  telephony?: TelephonyAdapter;
}
