"use client";

import type { TelephonyAdapter, Utterance } from "@/lib/providers/types";

type SRConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
  resultIndex: number;
}

function getSRCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class BrowserTelephonyAdapter implements TelephonyAdapter {
  private recognition: SpeechRecognitionLike | null = null;

  isSupported(): boolean {
    return getSRCtor() !== null;
  }

  async start(onUtterance: (u: Utterance) => void): Promise<void> {
    const Ctor = getSRCtor();
    if (!Ctor) throw new Error("SpeechRecognition not supported in this browser");

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (ev) => {
      let interim = "";
      let finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const r = ev.results[i];
        const chunk = r[0].transcript;
        if (r.isFinal) finalText += chunk;
        else interim += chunk;
      }
      if (finalText) {
        onUtterance({ text: finalText.trim(), finalized: true });
      } else if (interim) {
        onUtterance({ text: interim.trim(), finalized: false });
      }
    };
    rec.onend = () => {
      this.recognition = null;
    };
    rec.onerror = () => {
      this.recognition = null;
    };

    rec.start();
    this.recognition = rec;
  }

  async stop(): Promise<void> {
    this.recognition?.stop();
    this.recognition = null;
  }

  async speak(text: string): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    window.speechSynthesis.speak(utter);
  }
}
