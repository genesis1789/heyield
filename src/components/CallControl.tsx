"use client";

import { useCallback, useEffect, useState } from "react";

interface Props {
  active: boolean;
  connecting: boolean;
  disabled?: boolean;
  provider: "vapi" | "browser";
  phoneNumber: string | null;
  onStart: () => void;
  onEnd: () => void;
}

/**
 * Voice-channel controls. Three entry points into a call:
 *   1. Start web call — WebRTC in the browser via Vapi Web SDK.
 *   2. Dial the displayed number from your phone — Vapi's assistant picks up.
 *   3. Enter your own number + click "Call me" — Vapi dials YOU (outbound).
 *
 * The dashboard renders the same way for all three channels because the
 * server-side session is the single source of truth.
 */
export function CallControl({
  active,
  connecting,
  disabled,
  provider,
  phoneNumber,
  onStart,
  onEnd,
}: Props) {
  const webCallLabel = connecting
    ? "Connecting…"
    : active
      ? "End call"
      : provider === "vapi"
        ? "Start web call"
        : "Start call (preview)";

  const handler = active ? onEnd : onStart;
  const busy = connecting || disabled;

  const [outboundNumber, setOutboundNumber] = useState("");
  const [dialing, setDialing] = useState(false);
  const [dialError, setDialError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("vc_outbound_number");
    if (saved) setOutboundNumber(saved);
  }, []);

  const dial = useCallback(async () => {
    setDialError(null);
    if (dialing || active) return;
    setDialing(true);
    try {
      window.localStorage.setItem("vc_outbound_number", outboundNumber);
      const res = await fetch("/api/agent/dial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: outboundNumber }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: unknown;
        };
        setDialError(body.error ?? `dial failed (${res.status})`);
        return;
      }
      // Success — the dashboard's session poll will flip to "in-progress"
      // within a second once Vapi starts ringing your phone.
    } catch (err) {
      setDialError(err instanceof Error ? err.message : "dial failed");
    } finally {
      setDialing(false);
    }
  }, [active, dialing, outboundNumber]);

  const phoneValid = /^\+[1-9]\d{7,14}$/.test(outboundNumber.trim());

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Voice channel
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {provider === "vapi" ? (
              <>Powered by Vapi. Pick an entry point below — all three work.</>
            ) : (
              <>
                Vapi keys not configured — running browser-only preview without
                the concierge agent.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handler}
          disabled={busy}
          className={
            "inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm transition " +
            (active
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-brand text-white hover:bg-brand-700") +
            (busy ? " cursor-not-allowed opacity-60" : "")
          }
        >
          <span
            className={
              "inline-flex h-2 w-2 rounded-full " +
              (active ? "bg-white pulse-ring text-red-300" : "bg-white/90")
            }
          />
          {webCallLabel}
        </button>
      </div>

      {provider === "vapi" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {phoneNumber && (
            <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Or dial from your phone
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                  {phoneNumber}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  The concierge picks up and this dashboard mirrors the call.
                </p>
              </div>
              <a
                href={`tel:${phoneNumber.replace(/[^+\d]/g, "")}`}
                className="mt-3 inline-flex h-9 w-fit items-center rounded-full border border-brand bg-white px-4 text-sm font-medium text-brand hover:bg-brand-50"
              >
                Call now
              </a>
            </div>
          )}

          <div className={`flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-4 ${phoneNumber ? "" : "sm:col-span-2"}`}>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Or ask the concierge to call you
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Enter your number in international format. Vapi will ring your
                phone and the assistant will be on the line when you answer.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="tel"
                  inputMode="tel"
                  value={outboundNumber}
                  onChange={(e) => setOutboundNumber(e.target.value)}
                  placeholder="+14155551234"
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  disabled={dialing || active}
                />
                <button
                  type="button"
                  onClick={dial}
                  disabled={!phoneValid || dialing || active}
                  className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {dialing ? "Ringing…" : "Call me"}
                </button>
              </div>
            </div>
            {dialError && (
              <p className="mt-2 text-xs text-red-600">{dialError}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
