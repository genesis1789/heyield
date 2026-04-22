"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FundingSession } from "@/lib/providers/funding/types";

/**
 * Revolut-styled sandbox checkout page. Served from `/checkout/[id]`.
 *
 * Used as the redirect target from the simulator funding provider. The
 * page mimics Revolut's hosted payment UI closely enough that the
 * audience reads it as "yes, they're paying with Revolut" without us
 * needing a real merchant key to run the demo.
 *
 * Flow:
 *   1. Load session (GET /api/funding/[id])
 *   2. User taps "Pay <amount>" → POST /api/funding/[id]/advance
 *      { event: "confirm_payment" }
 *   3. Session transitions to payment_received → routing_to_yield → invested.
 *      We show a "Payment confirmed" receipt with the tx explorer link.
 */

interface Props {
  sessionId: string;
}

function formatAmount(session: FundingSession): string {
  const currency = session.fiatCurrency;
  return new Intl.NumberFormat(currency === "EUR" ? "en-IE" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(session.amountFiat);
}

export function CheckoutWidget({ sessionId }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<FundingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/funding/${sessionId}`);
      if (!res.ok) {
        setError(`Session not found (${res.status})`);
        return;
      }
      const data = (await res.json()) as { session: FundingSession };
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchSession();
    const id = window.setInterval(fetchSession, 1200);
    return () => window.clearInterval(id);
  }, [fetchSession]);

  const pay = useCallback(async () => {
    if (paying) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(`/api/funding/${sessionId}/advance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "confirm_payment" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `Payment failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { session: FundingSession };
      setSession(data.session);
      // Mirror the real Revolut redirect: hand the user off to the stage
      // so the Aave-style status page animates in immediately. A tiny
      // pause lets the "Payment confirmed" moment register visually.
      window.setTimeout(() => {
        router.push(`/stage/${sessionId}`);
      }, 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }, [paying, router, sessionId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <p className="text-sm text-slate-300">Loading secure checkout…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl">
          <p className="text-sm font-semibold text-red-600">
            Checkout session not found
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {error ?? "This link may have expired."}
          </p>
        </div>
      </main>
    );
  }

  const amount = formatAmount(session);
  const isTerminal =
    session.status === "invested" ||
    session.status === "cancelled" ||
    session.status === "failed";
  const completed = session.status === "invested";
  const payButtonDisabled =
    paying || session.status !== "awaiting_checkout";
  const payLabel =
    session.status === "awaiting_checkout"
      ? paying
        ? "Processing…"
        : `Pay ${amount}`
      : completed
        ? "Payment completed"
        : session.status === "cancelled"
          ? "Payment cancelled"
          : session.status === "failed"
            ? "Payment failed"
            : "Processing…";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-[#0075eb] to-[#1554d2] px-5 py-5 text-white">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#0075eb]">
              <span className="text-base font-black">R</span>
            </span>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">
                Revolut
              </p>
              <p className="text-sm font-semibold">Secure checkout</p>
            </div>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Sandbox
            </span>
          </div>
        </div>

        <div className="px-5 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Paying
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
            {amount}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            to Voice Concierge · Earn deposit
          </p>

          <div className="mt-5 space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm">
            <Row label="Destination" value={session.productName} />
            <Row label="Protocol" value={session.protocolLabel} />
            {session.destWalletAddress && (
              <Row
                label="Wallet"
                value={`${session.destWalletAddress.slice(0, 6)}…${session.destWalletAddress.slice(-4)}`}
                mono
              />
            )}
          </div>

          {completed && session.txExplorerUrl && session.txHash && (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                <svg
                  aria-hidden
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 11l4 4 8-8" />
                </svg>
              </div>
              <p className="mt-2 text-base font-bold text-emerald-800">
                Payment confirmed
              </p>
              <p className="text-xs text-emerald-700">
                {amount} delivered on-chain
              </p>
              <a
                href={session.txExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
              >
                <span className="text-[10px] uppercase tracking-wide text-emerald-500">
                  tx
                </span>
                <span className="font-mono">
                  {session.txHash.slice(0, 6)}…{session.txHash.slice(-4)}
                </span>
              </a>
            </div>
          )}

          {!isTerminal && (
            <button
              type="button"
              onClick={pay}
              disabled={payButtonDisabled}
              className={
                "mt-5 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold shadow-sm transition " +
                (payButtonDisabled
                  ? "bg-slate-300 text-white"
                  : "bg-[#0075eb] text-white hover:bg-[#0062d4]")
              }
            >
              {payLabel}
            </button>
          )}

          {session.status === "cancelled" && (
            <div className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              Payment cancelled. You can close this window.
            </div>
          )}

          {session.status === "failed" && (
            <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              {session.errorMessage ?? "This payment could not be completed."}
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-600">{error}</p>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-center text-[10px] text-slate-400">
          Protected by Revolut Pay · Sandbox mode
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span
        className={
          "text-sm font-semibold text-slate-900 " +
          (mono ? "font-mono text-xs" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}
