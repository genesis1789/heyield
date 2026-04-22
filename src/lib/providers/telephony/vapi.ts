"use client";

import type { TelephonyAdapter, Utterance } from "@/lib/providers/types";

/**
 * Real-agent telephony via Vapi (https://vapi.ai).
 *
 * Gated by `NEXT_PUBLIC_TELEPHONY_PROVIDER=vapi` + `NEXT_PUBLIC_VAPI_PUBLIC_KEY`
 * + `NEXT_PUBLIC_VAPI_ASSISTANT_ID`. When any of these is missing we stay on
 * the browser Web-Speech fallback so the demo is never one env var away from
 * being broken.
 *
 * Wiring contract (from https://docs.vapi.ai/quickstart/web):
 *   new Vapi(publicKey).start(assistantId)
 *   vapi.on('message', m) — `m.type === 'transcript'` carries user speech
 *     `m.transcript` (string)  — the text
 *     `m.transcriptType`       — "partial" | "final"
 *     `m.role`                 — "user" | "assistant"
 *
 * We only surface user transcripts upward; assistant TTS is played by Vapi.
 * `.speak(text)` uses the Vapi "say" message so the agent speaks the copy
 * through the same voice instead of forking to Web Speech Synthesis.
 *
 * ASSUMPTION: message shape from Vapi follows the documented web-event
 *   convention. If fields rotate the adapter simply won't emit utterances;
 *   the CallSimulator's text input remains a working fallback.
 */

// Loaded lazily so the browser bundle stays slim when Vapi is not selected.
type VapiInstance = {
  start: (assistantId: string) => Promise<unknown>;
  stop: () => Promise<void> | void;
  send: (msg: unknown) => void;
  on: (event: string, cb: (payload: unknown) => void) => void;
};

function isTranscriptMessage(x: unknown): x is {
  type: "transcript";
  transcript: string;
  transcriptType: "partial" | "final";
  role: "user" | "assistant";
} {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.type === "transcript" &&
    typeof o.transcript === "string" &&
    (o.transcriptType === "partial" || o.transcriptType === "final") &&
    (o.role === "user" || o.role === "assistant")
  );
}

export class VapiTelephonyAdapter implements TelephonyAdapter {
  private vapi: VapiInstance | null = null;
  private active = false;

  constructor(
    private readonly publicKey: string,
    private readonly assistantId: string,
  ) {}

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      this.publicKey.length > 0 &&
      this.assistantId.length > 0
    );
  }

  async start(onUtterance: (u: Utterance) => void): Promise<void> {
    if (!this.isSupported()) throw new Error("Vapi telephony not configured");
    const mod = (await import("@vapi-ai/web")) as unknown as {
      default: new (key: string) => VapiInstance;
    };
    const instance: VapiInstance = new mod.default(this.publicKey);
    this.vapi = instance;
    this.active = true;

    instance.on("message", (payload: unknown) => {
      if (!isTranscriptMessage(payload)) return;
      if (payload.role !== "user") return;
      onUtterance({
        text: payload.transcript.trim(),
        finalized: payload.transcriptType === "final",
      });
    });
    instance.on("error", () => {
      this.active = false;
    });
    instance.on("call-end", () => {
      this.active = false;
    });

    await instance.start(this.assistantId);
  }

  async stop(): Promise<void> {
    if (this.vapi && this.active) {
      try {
        await this.vapi.stop();
      } catch {
        // ignore — stop is best-effort
      }
    }
    this.vapi = null;
    this.active = false;
  }

  async speak(text: string): Promise<void> {
    if (!this.vapi || !this.active) return;
    this.vapi.send({ type: "say", message: text, interruptionsEnabled: true });
  }
}
