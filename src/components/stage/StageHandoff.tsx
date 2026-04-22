"use client";

import type { StageFunding } from "./types";

interface Props {
  funding: StageFunding;
}

function formatAmount(amount: number, currency: "EUR" | "USD"): string {
  return new Intl.NumberFormat(currency === "EUR" ? "en-IE" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Revolut handoff moment. Full-screen card with one obvious CTA that takes
 * the phone to the real Revolut sandbox hosted checkout (or our simulated
 * one). After payment Revolut 302-redirects back to /stage/[id].
 */
export function StageHandoff({ funding }: Props) {
  const amount = formatAmount(funding.amountFiat, funding.fiatCurrency);

  return (
    <main className="stage-shell flex flex-col">
      <div className="relative mt-4 overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_rgba(15,17,21,0.04),0_20px_48px_rgba(15,17,21,0.08)]">
        <div className="h-1 bg-gradient-to-r from-[#0075eb] via-[#1554d2] to-[#6d5cf5]" />

        <div className="px-5 pt-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0075eb] text-sm font-black text-white shadow-sm">
              R
            </span>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Pay with Revolut
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Secure hosted checkout
              </p>
            </div>
            {funding.simulated && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-700 ring-1 ring-amber-200">
                <span className="h-1 w-1 rounded-full bg-amber-500" />
                Sandbox
              </span>
            )}
          </div>
        </div>

        <div className="px-5 pt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Amount
          </p>
          <p className="mt-1 text-[clamp(2.5rem,11vw,3.25rem)] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums">
            {amount}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            into{" "}
            <span className="font-semibold text-slate-900">
              {funding.productName}
            </span>{" "}
            on{" "}
            <span className="font-semibold text-[#6D5CF5]">
              {funding.protocolLabel}
            </span>
          </p>
        </div>

        <div className="px-5 py-5">
          <a
            href={funding.checkoutUrl}
            className="relative inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-[#0075eb] text-base font-semibold text-white shadow-[0_10px_32px_-8px_rgba(0,117,235,0.7)] transition active:scale-[0.98]"
          >
            <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="relative">Continue in Revolut</span>
            <svg
              aria-hidden
              className="relative ml-2 h-5 w-5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 13L13 7M7 7h6v6" />
            </svg>
          </a>
        </div>

        <p className="px-5 pb-5 text-[11px] leading-relaxed text-slate-400">
          You&rsquo;ll pay on Revolut&rsquo;s real checkout page. We never
          see your card details.
        </p>
      </div>

      <p className="mt-auto pt-10 text-center text-[11px] text-slate-400">
        Tap above when you&rsquo;re ready. Come back to this tab after paying.
      </p>
    </main>
  );
}
