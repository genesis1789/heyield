"use client";

import type { StageRecommendation as StageRecommendationData } from "./types";

interface Props {
  rec: StageRecommendationData;
}

function formatAmount(
  amount: number,
  currency: "EUR" | "USD",
  maxFraction = 0,
): string {
  return new Intl.NumberFormat(currency === "EUR" ? "en-IE" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: maxFraction,
  }).format(amount);
}

/**
 * The recommendation screen. Full-bleed APY number, product, projected
 * yearly return. No CTA — verbal confirmation is the only input.
 */
export function StageRecommendation({ rec }: Props) {
  const amount = formatAmount(rec.amountFiat, rec.fiatCurrency, 0);
  const projected = formatAmount(
    rec.estimatedAnnualReturnFiat,
    rec.fiatCurrency,
    2,
  );

  return (
    <main className="stage-shell">
      <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D5CF5]">
        <span className="inline-flex h-2 w-2 rounded-full bg-[#6D5CF5]" />
        Recommendation
      </div>

      <h1 className="mt-3 text-[clamp(1.9rem,7.5vw,2.5rem)] font-extrabold leading-tight tracking-tight text-slate-900">
        {amount} into{" "}
        <span
          className="bg-gradient-to-r from-[#9391F7] to-[#6D5CF5] bg-clip-text text-transparent"
        >
          {rec.productName}
        </span>
        .
      </h1>

      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Earning roughly{" "}
        <span className="font-semibold text-slate-900">
          {projected} per year
        </span>{" "}
        on {rec.chain}, after a {rec.feesPct.toFixed(2)}% fee.
      </p>

      <section className="mt-8 rounded-3xl bg-white p-6 shadow-[0_1px_0_rgba(15,17,21,0.04),0_10px_32px_rgba(15,17,21,0.05)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Expected APY
            </p>
            <p className="mt-1 text-[clamp(2.75rem,12vw,3.5rem)] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums">
              {rec.apyPct.toFixed(2)}
              <span className="ml-1 text-2xl text-slate-400">%</span>
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E8E7FE] px-3 py-1.5 ring-1 ring-[#CDC9FF]">
            <svg
              aria-hidden
              viewBox="0 0 254 254"
              className="h-5 w-5"
              fill="none"
            >
              <circle cx="127" cy="127" r="127" fill="#9391F7" />
              <path
                d="M103.39 133.19c10.89-1.76 18.28-12.02 16.52-22.91-1.77-10.89-12.03-18.28-22.92-16.52-10.89 1.77-18.28 12.03-16.51 22.92 1.77 10.89 12.03 18.28 22.91 16.51zM155.6 133.19c10.89-1.76 18.28-12.02 16.52-22.91-1.77-10.89-12.03-18.28-22.92-16.52-10.89 1.77-18.28 12.03-16.51 22.92 1.77 10.89 12.03 18.28 22.91 16.51z"
                fill="#fff"
              />
              <path
                d="M126.26 31c-54.24 0-98.22 44.81-98.2 100.08h25.08c0-41.42 32.48-75 73.12-75s73.12 33.58 73.12 75h25.09c.01-55.27-43.97-100.08-98.21-100.08z"
                fill="#fff"
              />
            </svg>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-[#211D1D]">
                Aave v3
              </span>
              <span className="text-[10px] font-medium text-[#5D5AB8]">
                USDC Supply Pool
              </span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
          {rec.riskSentence}
        </p>
      </section>

      <p className="mt-auto pt-10 text-center text-xs text-slate-400">
        Say &ldquo;yes&rdquo; to continue, or ask me anything about it.
      </p>
    </main>
  );
}
