"use client";

import { useState } from "react";

interface Props {
  approvalId: string;
  productName: string;
  amountLabel: string;
  /** When non-null, the approval has resolved and the card shows the outcome. */
  outcome: "approved" | "declined" | null;
  onTap: (decision: "approve" | "decline") => Promise<void> | void;
}

export function PhonePushCard({
  approvalId,
  productName,
  amountLabel,
  outcome,
  onTap,
}: Props) {
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);
  const resolved = outcome !== null;

  async function handle(decision: "approve" | "decline") {
    if (pending || resolved) return;
    setPending(decision);
    try {
      await onTap(decision);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Revolut push
        </p>
        <span className="text-[11px] font-mono text-slate-400">{approvalId}</span>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[18rem] rounded-[2.25rem] border border-slate-300 bg-slate-900 p-1.5 shadow-lg">
          <div className="rounded-[1.75rem] bg-gradient-to-b from-slate-800 via-slate-900 to-black p-4 text-white">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>9:41</span>
              <span>5G</span>
            </div>

            <div className="mt-8 rounded-2xl bg-white/95 p-3 text-slate-900 shadow-lg ring-1 ring-white/10">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#0075eb] text-[11px] font-bold text-white">
                  R
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Revolut
                </span>
                <span className="ml-auto text-[10px] text-slate-400">now</span>
              </div>
              <p className="mt-1.5 text-[13px] font-semibold text-slate-900">
                Approve {amountLabel} into {productName}?
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Tap to review and approve this transfer.
              </p>
            </div>

            {!resolved && (
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => handle("decline")}
                  disabled={pending !== null}
                  className={
                    "flex-1 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur hover:bg-white/20 " +
                    (pending === "decline" ? "opacity-60" : "")
                  }
                >
                  {pending === "decline" ? "Declining…" : "Decline"}
                </button>
                <button
                  type="button"
                  onClick={() => handle("approve")}
                  disabled={pending !== null}
                  className={
                    "flex-1 rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-400 " +
                    (pending === "approve" ? "opacity-60" : "")
                  }
                >
                  {pending === "approve" ? "Approving…" : "Approve"}
                </button>
              </div>
            )}

            {resolved && (
              <p
                className={
                  "mt-5 rounded-full px-3 py-2 text-center text-xs font-semibold " +
                  (outcome === "approved"
                    ? "bg-emerald-500 text-white"
                    : "bg-red-500 text-white")
                }
              >
                {outcome === "approved" ? "Approved ✓" : "Declined"}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">
        {resolved
          ? outcome === "approved"
            ? "Approval sent — the concierge will confirm on the call."
            : "Approval declined — the concierge will acknowledge on the call."
          : "Waiting for you to approve on your phone."}
      </p>
    </section>
  );
}
