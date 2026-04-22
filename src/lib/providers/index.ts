// This module is server-only. Importing it from a client component will leak
// environment secrets. All access goes through API routes in src/app/api.

import type {
  EarnAdapter,
  IntentFactoryAdapter,
  Providers,
} from "./types";
import { MockEarnAdapter } from "./earn/mock";
import { LifiEarnAdapter } from "./earn/lifi";
import {
  MockIntentFactoryAdapter,
  PersistentMockIntentFactoryAdapter,
} from "./intentFactory/mock";
import { RealIntentFactoryAdapter } from "./intentFactory/real";
import { MockPricingAdapter } from "./pricing/mock";
import { LifiPricingAdapter } from "./pricing/lifiQuote";
import type { PricingAdapter } from "./pricing/types";
import type { FundingAdapter } from "./funding/types";
import {
  SimulatorFundingAdapter,
  type SimulatorConfig,
} from "./funding/simulator";
import { MerchantFundingAdapter } from "./funding/merchant";

/**
 * Central real-vs-mock provider selection. API routes import ONLY from this
 * module. Add a new provider choice by:
 *   1. adding a concrete class next to the existing one,
 *   2. extending the env-var switch below,
 *   3. leaving every route untouched.
 *
 * State is cached on globalThis so Next.js dev-mode hot reloads don't blow
 * away in-memory mock data between requests.
 */

type Glob = {
  __vc_providers?: Providers;
  __vc_simulatorConfig?: SimulatorConfig;
};
const g = globalThis as unknown as Glob;

const DEFAULT_PROTOCOL_LABEL = "Aave v3";
const DEFAULT_DEST_WALLET =
  "0x4BC6D93bA0aFbfc3A8Aa22F9Cc1C8a1E9f3a7b81"; // cosmetic fallback for simulator mode

function appBaseUrl(): string {
  // Client-provided URL only: never leak private headers into it. Falls
  // back to the conventional local dev origin.
  return (
    process.env.PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "http://localhost:3000"
  );
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function destWalletAddress(): string {
  return (
    process.env.FUNDING_DEST_WALLET?.trim() ??
    process.env.REVOLUT_RAMP_DEST_WALLET?.trim() ??
    DEFAULT_DEST_WALLET
  );
}

export const simulatorConfig: SimulatorConfig =
  g.__vc_simulatorConfig ??
  (g.__vc_simulatorConfig = {
    appBaseUrl: appBaseUrl(),
    destWalletAddress: destWalletAddress(),
    stepMs: readNumber("FUNDING_SIM_STEP_MS", 2200),
    forceFailure: false,
    skipDelays: false,
    protocolLabel: DEFAULT_PROTOCOL_LABEL,
    txExplorerUrlTemplate: "https://sepolia.etherscan.io/tx/{hash}",
    storeFile: process.env.FUNDING_SIM_STORE_FILE,
  });

export function setSimulatorConfig(
  patch: Partial<SimulatorConfig>,
): void {
  Object.assign(simulatorConfig, patch);
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

function pickPricing(): PricingAdapter {
  const choice = (process.env.PRICING_PROVIDER ?? "lifi").toLowerCase();
  if (choice === "mock") return new MockPricingAdapter();
  return new LifiPricingAdapter(process.env.LIFI_API_KEY);
}

function pickFunding(): FundingAdapter {
  const choice = (process.env.FUNDING_PROVIDER ?? "simulator").toLowerCase();
  if (choice === "merchant" || choice === "merchant-onchain") {
    const secret = process.env.REVOLUT_MERCHANT_SECRET_KEY;
    if (!secret) {
      console.warn(
        "[providers] FUNDING_PROVIDER=%s but REVOLUT_MERCHANT_SECRET_KEY is unset — falling back to simulator.",
        choice,
      );
      return new SimulatorFundingAdapter(simulatorConfig);
    }
    const onchain =
      choice === "merchant-onchain" &&
      process.env.SEPOLIA_SOURCE_PRIVATE_KEY &&
      /^0x[a-fA-F0-9]{64}$/.test(process.env.SEPOLIA_SOURCE_PRIVATE_KEY)
        ? {
            sourcePrivateKey: process.env
              .SEPOLIA_SOURCE_PRIVATE_KEY as `0x${string}`,
            rpcUrl:
              process.env.SEPOLIA_RPC_URL ??
              "https://ethereum-sepolia-rpc.publicnode.com",
            onchainAmountEurc: readNumber("DEMO_ONCHAIN_AMOUNT_EURC", 0.1),
            txExplorerUrlTemplate:
              simulatorConfig.txExplorerUrlTemplate,
          }
        : undefined;
    if (choice === "merchant-onchain" && !onchain) {
      console.warn(
        "[providers] FUNDING_PROVIDER=merchant-onchain but SEPOLIA_SOURCE_PRIVATE_KEY is missing/invalid — running fiat-only.",
      );
    }
    return new MerchantFundingAdapter({
      merchantSecretKey: secret,
      merchantBaseUrl:
        process.env.REVOLUT_MERCHANT_BASE_URL ??
        "https://sandbox-merchant.revolut.com/api",
      merchantApiVersion:
        process.env.REVOLUT_MERCHANT_API_VERSION ?? "2024-09-01",
      publicBaseUrl: process.env.PUBLIC_BASE_URL,
      protocolLabel: DEFAULT_PROTOCOL_LABEL,
      destWalletAddress: destWalletAddress(),
      onchain,
    });
  }
  return new SimulatorFundingAdapter(simulatorConfig);
}

export function getProviders(): Providers {
  if (g.__vc_providers) return g.__vc_providers;
  const providers: Providers = {
    earn: pickEarn(),
    intentFactory: pickIntentFactory(),
    funding: pickFunding(),
    pricing: pickPricing(),
  };
  g.__vc_providers = providers;
  return providers;
}

/** Test-only: build a fresh, un-cached provider bundle with a private config. */
export function buildTestProviders(
  overrides: Partial<SimulatorConfig> = {},
): {
  providers: Providers;
  simulatorConfig: SimulatorConfig;
} {
  const cfg: SimulatorConfig = {
    appBaseUrl: "http://localhost:3000",
    destWalletAddress: DEFAULT_DEST_WALLET,
    stepMs: 0,
    forceFailure: false,
    skipDelays: true,
    protocolLabel: DEFAULT_PROTOCOL_LABEL,
    txExplorerUrlTemplate: "https://sepolia.etherscan.io/tx/{hash}",
    // Each test bundle gets its own file so parallel vitest workers don't
    // clobber each other's state.
    storeFile: `funding-sessions.test-${process.pid}-${Math.random()
      .toString(36)
      .slice(2, 8)}.json`,
    ...overrides,
  };
  return {
    providers: {
      earn: new MockEarnAdapter(),
      intentFactory: new MockIntentFactoryAdapter(),
      funding: new SimulatorFundingAdapter(cfg),
      pricing: new MockPricingAdapter(),
    },
    simulatorConfig: cfg,
  };
}
