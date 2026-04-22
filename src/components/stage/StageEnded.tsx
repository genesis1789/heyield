"use client";

import type { StageFunding } from "./types";

interface Props {
  funding: StageFunding | null;
}

/**
 * Neutral ended state. Covers:
 *   - call ended before any recommendation (funding === null)
 *   - user cancelled on Revolut (funding.status === "cancelled")
 *   - payment failed (funding.status === "failed")
 *
 * Deliberately calm — the audience shouldn't remember this beat.
 */
export function StageEnded({ funding }: Props) {
  const reason = (() => {
    if (!funding) return "The call ended.";
    if (funding.status === "cancelled") return "You cancelled the payment.";
    if (funding.status === "failed")
      return funding.errorMessage ?? "The payment could not complete.";
    return "The call ended.";
  })();

  return (
    <main className="stage-shell flex flex-col items-center justify-center text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
        </svg>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
        No worries.
      </h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
        {reason} Call again whenever you&rsquo;re ready — I&rsquo;ll still
        be here.
      </p>
    </main>
  );
}
