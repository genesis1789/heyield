"use client";

export interface RecommendationSummary {
  productName: string;
  chain: string;
  apyPct: number;
  estimatedAnnualReturnFiat: number;
  feesPct: number;
  riskSentence: string;
  amountFiat: number;
  fiatCurrency: "EUR" | "USD";
  networkCostUsd: number;
  networkCostSource: "lifi" | "fallback";
}

interface Props {
  summary: RecommendationSummary;
}

function fiatFormatter(currency: "EUR" | "USD") {
  return new Intl.NumberFormat(currency === "EUR" ? "en-IE" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

function fiatRounded(currency: "EUR" | "USD") {
  return new Intl.NumberFormat(currency === "EUR" ? "en-IE" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

/**
 * Read-only recommendation summary. The agent drives confirmation verbally;
 * there are no buttons on this card.
 */
export function RecommendationCard({ summary }: Props) {
  const amount = fiatRounded(summary.fiatCurrency).format(summary.amountFiat);
  const annual = fiatFormatter(summary.fiatCurrency).format(summary.estimatedAnnualReturnFiat);
  const netCostLabel =
    summary.networkCostUsd < 0.01
      ? "< $0.01"
      : `~$${summary.networkCostUsd.toFixed(2)}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-brand-50 to-white p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            Recommendation
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            {summary.productName}
          </h2>
          <p className="text-sm text-slate-600">USDC on {summary.chain}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            APY
          </p>
          <p className="text-3xl font-semibold text-slate-900">
            {summary.apyPct.toFixed(2)}
            <span className="text-lg text-slate-500">%</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-sm">
        <Stat label="On" value={amount} />
        <Stat label="Est. annual return" value={annual} emphasis />
        <Stat label="Fees" value={`${summary.feesPct.toFixed(2)}%`} />
      </div>

      <div className="space-y-3 border-t border-slate-100 p-5 text-sm leading-relaxed text-slate-700">
        <p className="text-slate-500">Risk: {summary.riskSentence}</p>
        <p className="flex items-center gap-2 pt-1 text-xs text-slate-500">
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 " +
              (summary.networkCostSource === "lifi"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-slate-50 text-slate-500 ring-slate-200")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (summary.networkCostSource === "lifi"
                  ? "bg-emerald-500"
                  : "bg-slate-400")
              }
            />
            {summary.networkCostSource === "lifi" ? "Live · LI.FI" : "Indicative"}
          </span>
          Est. Base network cost {netCostLabel}
        </p>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={
          "mt-0.5 font-semibold " +
          (emphasis ? "text-emerald-600" : "text-slate-900")
        }
      >
        {value}
      </p>
    </div>
  );
}
