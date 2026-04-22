"use client";

import { AnimatePresence, motion } from "motion/react";
import type { StageFunding, StageRecommendation } from "./types";
import { useStagePacer } from "./useStagePacer";

interface Props {
  funding: StageFunding;
  recommendation: StageRecommendation | null;
  /**
   * When true, the component jumps directly to the "earning" finale. The
   * `StageInvested` screen uses the same rail geometry to keep layout
   * continuous across the two states.
   */
  finale?: boolean;
}

const STEPS = [
  { key: "payment", label: "Payment" },
  { key: "converted", label: "Converted" },
  { key: "routed", label: "Routed" },
  { key: "deposited", label: "Deposited" },
] as const;

const AAVE = {
  protocol: "Aave v3",
  pool: "USDC Supply Pool",
  yieldLow: 3.5,
  yieldHigh: 5.2,
};

function statusToTargetIdx(status: StageFunding["status"]): number {
  switch (status) {
    case "awaiting_checkout":
      return 0;
    case "payment_received":
      return 1;
    case "routing_to_yield":
      return 2;
    case "invested":
      return 3;
    default:
      return 0;
  }
}

function pillLabelFor(idx: number, success: boolean): string {
  if (success) return "Deposited to Aave";
  switch (idx) {
    case 0:
      return "Awaiting your payment";
    case 1:
      return "Payment received — routing to Aave";
    case 2:
      return "Supplying liquidity to Aave";
    case 3:
      return "Deposited to Aave";
    default:
      return "Processing";
  }
}

function formatAmount(
  amount: number,
  currency: "EUR" | "USD",
  maxFraction = 2,
): string {
  return new Intl.NumberFormat(currency === "EUR" ? "en-IE" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: maxFraction === 0 ? 0 : 2,
    maximumFractionDigits: maxFraction,
  }).format(amount);
}

/**
 * The Aave-styled "your money is moving" screen. Ported from the hackaton
 * status page — staggered entrance, dwell-clocked rail, animated hero + pill
 * swaps, reserved-slot tx pill that springs in when a hash arrives.
 */
export function StageInvesting({ funding, recommendation, finale = false }: Props) {
  const targetIdx = finale ? STEPS.length - 1 : statusToTargetIdx(funding.status);
  const success = finale || funding.status === "invested";

  const { visualIdx, visualSuccess } = useStagePacer({
    sessionId: funding.sessionId,
    targetIdx,
    success,
    stepCount: STEPS.length,
    dwellMs: 3000,
  });

  const amount = formatAmount(funding.amountFiat, funding.fiatCurrency, 2);

  const apyLow = recommendation?.apyPct
    ? Math.max(0, recommendation.apyPct - 1.7)
    : AAVE.yieldLow;
  const apyHigh = recommendation?.apyPct ?? AAVE.yieldHigh;
  const annualLow = (funding.amountFiat * apyLow) / 100;
  const annualHigh = (funding.amountFiat * apyHigh) / 100;
  const fmtYear = (n: number) =>
    formatAmount(n, funding.fiatCurrency, 0);

  const pillLabel = pillLabelFor(visualIdx, visualSuccess);
  const heroHeadline = visualSuccess
    ? "Your money is earning."
    : "Depositing to Aave.";
  const heroSub = visualSuccess
    ? `Supplied into the ${AAVE.protocol} ${AAVE.pool}. Starts earning immediately.`
    : `Routing your payment into the ${AAVE.protocol} ${AAVE.pool}.`;

  const railProgressPct = visualSuccess
    ? 100
    : (visualIdx / (STEPS.length - 1)) * 100;

  return (
    <main className="stage-shell">
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mb-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
            EC
          </span>
          <span className="tracking-tight">Earn</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">
          #{funding.sessionId.slice(-6)}
        </span>
      </motion.div>

      {/* Pill */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.0 }}
        className="inline-flex items-center gap-2 rounded-full bg-[#E8E7FE] px-3 py-1 text-xs font-semibold text-[#4F46E5] ring-1 ring-[#CDC9FF]"
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full bg-[#6D5CF5] ${visualSuccess ? "" : "animate-pulse"}`}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={pillLabel}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {pillLabel}
          </motion.span>
        </AnimatePresence>
      </motion.div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.06 }}
        className="mt-3"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1
            key={heroHeadline}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.26 }}
            className="text-[clamp(1.9rem,6.5vw,2.5rem)] font-extrabold leading-[1.04] tracking-tight text-slate-900"
          >
            {heroHeadline.includes("Aave") ? (
              <>
                Depositing to{" "}
                <span className="bg-gradient-to-r from-[#9391F7] to-[#7F7DFF] bg-clip-text text-transparent">
                  Aave
                </span>
                .
              </>
            ) : (
              heroHeadline
            )}
          </motion.h1>
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={heroSub}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.26, delay: 0.04 }}
            className="mt-2 min-h-[2.9em] text-[1rem] leading-[1.45] text-[#3C404A]"
          >
            {heroSub}
          </motion.p>
        </AnimatePresence>
      </motion.div>

      {/* Amount card */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.12 }}
        className="mt-4 rounded-[22px] bg-white px-5 py-5 shadow-[0_1px_0_rgba(15,17,21,0.04),0_10px_32px_rgba(15,17,21,0.05)]"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Deposited
            </p>
            <motion.p
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1], delay: 0.22 }}
              className="mt-1 text-[clamp(2.1rem,7.5vw,2.75rem)] font-extrabold leading-none tracking-tight tabular-nums text-slate-900"
            >
              {amount}
            </motion.p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full bg-[#E8E7FE] px-3 py-1.5 ring-1 ring-[#CDC9FF]">
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
                {AAVE.protocol}
              </span>
              <span className="text-[10px] font-medium text-[#5D5AB8]">
                {AAVE.pool}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.28 }}
            className="rounded-xl border border-slate-100 bg-[#FAFAF8] px-3 py-2.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Expected APY
            </p>
            <p className="mt-0.5 text-[17px] font-bold tabular-nums text-slate-900">
              {apyLow.toFixed(1)}% – {apyHigh.toFixed(1)}%
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.34 }}
            className="rounded-xl border border-slate-100 bg-[#FAFAF8] px-3 py-2.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Projected / year
            </p>
            <p className="mt-0.5 text-[17px] font-bold tabular-nums text-slate-900">
              {fmtYear(annualLow)} – {fmtYear(annualHigh)}
            </p>
          </motion.div>
        </div>

        <p className="mt-3 text-[12px] leading-[1.4] text-slate-500">
          Yield is variable and tracks the Aave supply rate. Not a bank
          deposit; capital protection does not apply.
        </p>
      </motion.section>

      {/* Rail */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.18 }}
        className="mt-4 px-0.5"
      >
        <div className="relative flex h-3.5 items-center">
          <div className="absolute inset-x-1.5 top-1/2 h-0.5 -translate-y-1/2 rounded bg-slate-200" />
          <motion.div
            className="absolute left-1.5 top-1/2 h-0.5 -translate-y-1/2 rounded bg-slate-900"
            animate={{ width: `calc((100% - 0.75rem) * ${railProgressPct / 100})` }}
            transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ maxWidth: "calc(100% - 0.75rem)" }}
          />
          <div className="relative flex w-full justify-between">
            {STEPS.map((step, i) => {
              const done = visualSuccess || i < visualIdx;
              const now = !visualSuccess && i === visualIdx;
              return (
                <motion.span
                  key={step.key}
                  animate={
                    done || now
                      ? { scale: [1, 1.35, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                  className={`relative h-2.5 w-2.5 rounded-full border-2 transition-colors ${
                    done
                      ? "border-slate-900 bg-slate-900"
                      : now
                        ? "scale-110 border-slate-900 bg-white shadow-[0_0_0_0_rgba(15,17,21,0.3)] animate-[dotPulse_1.4s_ease-out_infinite]"
                        : "border-slate-200 bg-white"
                  }`}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={STEPS[visualSuccess ? STEPS.length - 1 : visualIdx]?.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="min-w-[6ch] font-semibold text-slate-900"
            >
              {STEPS[visualSuccess ? STEPS.length - 1 : visualIdx]?.label}
            </motion.span>
          </AnimatePresence>
          <span className="opacity-45">·</span>
          <span className="tabular-nums">
            Step {(visualSuccess ? STEPS.length - 1 : visualIdx) + 1} of{" "}
            {STEPS.length}
          </span>
        </div>
      </motion.div>

      {/* Reserved tx-pill slot */}
      <div className="mt-2.5 min-h-[36px]">
        <AnimatePresence>
          {funding.txHash && (
            <motion.a
              key="tx"
              href={funding.txExplorerUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full bg-[rgba(152,150,255,0.14)] px-3 py-2 text-[12px] text-slate-900 no-underline hover:bg-[rgba(152,150,255,0.22)]"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5D5AB8]">
                On-chain receipt
              </span>
              <span className="font-mono font-semibold">
                {funding.txHash.slice(0, 6)}…{funding.txHash.slice(-4)}
              </span>
              <span className="text-[#5D5AB8]">↗</span>
            </motion.a>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.42 }}
        className="mt-3 text-center text-[11px] leading-[1.5] text-slate-500"
      >
        {funding.simulated && <span>Simulated · </span>}
        Keep this tab open. The rest happens on its own.
      </motion.div>

      <style jsx>{`
        @keyframes dotPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(15, 17, 21, 0.28);
          }
          70% {
            box-shadow: 0 0 0 7px rgba(15, 17, 21, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(15, 17, 21, 0);
          }
        }
      `}</style>
    </main>
  );
}
