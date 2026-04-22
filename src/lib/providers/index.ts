// This module is server-only. Importing it from a client component will leak
// environment secrets. All access goes through API routes in src/app/api.

import type {
  EarnAdapter,
  IntentFactoryAdapter,
  Providers,
  RevolutAdapter,
} from "./types";
import { MockEarnAdapter } from "./earn/mock";
import { LifiEarnAdapter } from "./earn/lifi";
import {
  MockIntentFactoryAdapter,
  PersistentMockIntentFactoryAdapter,
} from "./intentFactory/mock";
import { RealIntentFactoryAdapter } from "./intentFactory/real";
import {
  MockRevolutAdapter,
  PersistentMockRevolutAdapter,
  type MockRevolutConfigRef,
} from "./revolut/mock";
import { RealRevolutAdapter } from "./revolut/real";
import { MockPricingAdapter } from "./pricing/mock";
import { LifiPricingAdapter } from "./pricing/lifiQuote";
import type { PricingAdapter } from "./pricing/types";

/**
 * Central real-vs-mock provider selection. API routes import ONLY from this
 * module. Add a new provider choice by:
 *   1. adding a concrete class next to the existing one,
 *   2. extending the env-var switch below,
 *   3. leaving every route untouched.
 *
 * State is cached on globalThis so Next.js dev-mode hot reloads don't blow away
 * in-memory mock data between requests.
 */

type Glob = {
  __vc_providers?: Providers;
  __vc_mockConfig?: MockRevolutConfigRef;
};
const g = globalThis as unknown as Glob;

export const mockConfig: MockRevolutConfigRef =
  g.__vc_mockConfig ??
  (g.__vc_mockConfig = {
    forceFailure: false,
    skipDelays: false,
    confirmAfterMs: 1500,
  });

export function setMockConfig(patch: Partial<MockRevolutConfigRef>): void {
  Object.assign(mockConfig, patch);
}

function pickEarn(): EarnAdapter {
  const choice = (process.env.EARN_PROVIDER ?? "mock").toLowerCase();
  if (choice === "lifi") return new LifiEarnAdapter(process.env.LIFI_API_KEY ?? "");
  return new MockEarnAdapter();
}

function pickIntentFactory(): IntentFactoryAdapter {
  const choice = (process.env.INTENT_FACTORY_PROVIDER ?? "mock").toLowerCase();
  if (choice === "real") return new RealIntentFactoryAdapter();
  return new PersistentMockIntentFactoryAdapter();
}

function pickRevolut(): RevolutAdapter {
  const choice = (process.env.REVOLUT_PROVIDER ?? "mock").toLowerCase();
  if (choice === "real") return new RealRevolutAdapter(process.env.REVOLUT_API_KEY ?? "");
  return new PersistentMockRevolutAdapter(mockConfig);
}

function pickPricing(): PricingAdapter {
  const choice = (process.env.PRICING_PROVIDER ?? "lifi").toLowerCase();
  if (choice === "mock") return new MockPricingAdapter();
  return new LifiPricingAdapter(process.env.LIFI_API_KEY);
}

export function getProviders(): Providers {
  if (g.__vc_providers) return g.__vc_providers;
  const providers: Providers = {
    earn: pickEarn(),
    intentFactory: pickIntentFactory(),
    revolut: pickRevolut(),
    pricing: pickPricing(),
  };
  g.__vc_providers = providers;
  return providers;
}

/** Test-only: build a fresh, un-cached provider bundle with a private config. */
export function buildTestProviders(config?: Partial<MockRevolutConfigRef>): {
  providers: Providers;
  mockConfig: MockRevolutConfigRef;
} {
  const cfg: MockRevolutConfigRef = {
    forceFailure: false,
    skipDelays: true,
    confirmAfterMs: 0,
    ...config,
  };
  return {
    providers: {
      earn: new MockEarnAdapter(),
      intentFactory: new MockIntentFactoryAdapter(),
      revolut: new MockRevolutAdapter(cfg),
      pricing: new MockPricingAdapter(),
    },
    mockConfig: cfg,
  };
}
