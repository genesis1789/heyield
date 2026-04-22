"use client";

import type { TelephonyAdapter } from "@/lib/providers/types";
import { BrowserTelephonyAdapter } from "./browser";
import { VapiTelephonyAdapter } from "./vapi";

/**
 * Client-side telephony selector. Server adapters go through
 * `src/lib/providers/index.ts`; telephony is browser-bound so it sits here.
 *
 * Selection precedence:
 *   NEXT_PUBLIC_TELEPHONY_PROVIDER=vapi  + keys set → Vapi
 *   anything else / keys missing         → Browser (Web Speech API)
 */
export function createTelephony(): TelephonyAdapter {
  const provider = (process.env.NEXT_PUBLIC_TELEPHONY_PROVIDER ?? "browser").toLowerCase();
  if (provider === "vapi") {
    const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "";
    const assistant = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? "";
    if (key && assistant) return new VapiTelephonyAdapter(key, assistant);
    // Keys not configured — quietly fall back to browser.
  }
  return new BrowserTelephonyAdapter();
}

/** Exposed for tests + UI badges. */
export function telephonyProviderLabel(): "vapi" | "browser" {
  const provider = (process.env.NEXT_PUBLIC_TELEPHONY_PROVIDER ?? "browser").toLowerCase();
  if (
    provider === "vapi" &&
    (process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "").length > 0 &&
    (process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? "").length > 0
  ) {
    return "vapi";
  }
  return "browser";
}
