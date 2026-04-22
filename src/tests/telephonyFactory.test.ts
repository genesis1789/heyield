import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BrowserTelephonyAdapter } from "@/lib/providers/telephony/browser";
import { VapiTelephonyAdapter } from "@/lib/providers/telephony/vapi";
import {
  createTelephony,
  telephonyProviderLabel,
} from "@/lib/providers/telephony/factory";

const keysToReset = [
  "NEXT_PUBLIC_TELEPHONY_PROVIDER",
  "NEXT_PUBLIC_VAPI_PUBLIC_KEY",
  "NEXT_PUBLIC_VAPI_ASSISTANT_ID",
] as const;

const snapshot: Partial<Record<(typeof keysToReset)[number], string | undefined>> = {};

describe("telephony factory", () => {
  beforeEach(() => {
    for (const k of keysToReset) snapshot[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of keysToReset) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  });

  it("returns BrowserTelephonyAdapter by default", () => {
    delete process.env.NEXT_PUBLIC_TELEPHONY_PROVIDER;
    expect(createTelephony()).toBeInstanceOf(BrowserTelephonyAdapter);
    expect(telephonyProviderLabel()).toBe("browser");
  });

  it("falls back to browser when vapi is selected but keys are missing", () => {
    process.env.NEXT_PUBLIC_TELEPHONY_PROVIDER = "vapi";
    delete process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    delete process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    expect(createTelephony()).toBeInstanceOf(BrowserTelephonyAdapter);
    expect(telephonyProviderLabel()).toBe("browser");
  });

  it("returns VapiTelephonyAdapter when vapi + both keys are set", () => {
    process.env.NEXT_PUBLIC_TELEPHONY_PROVIDER = "vapi";
    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY = "pk-test";
    process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID = "asst-test";
    expect(createTelephony()).toBeInstanceOf(VapiTelephonyAdapter);
    expect(telephonyProviderLabel()).toBe("vapi");
  });
});
