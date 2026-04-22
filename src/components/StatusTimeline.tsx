"use client";

import {
  TIMELINE_STATUSES,
  type DemoState,
  type TimelineStatus,
} from "@/lib/state/types";

const LABELS: Record<TimelineStatus, string> = {
  recommended: "Recommended",
  approval_pending: "Approval pending",
  completed: "Completed",
};

const SUBTITLES: Record<TimelineStatus, string> = {
  recommended: "Agent explained the product",
  approval_pending: "Waiting for Revolut approval",
  completed: "Request confirmed",
};

export function StatusTimeline({ state }: { state: DemoState }) {
  const isFailed = state.status === "failed";
  const isDeclined = state.status === "declined";
  const isCompleted = state.status === "completed";
  const currentIdx = TIMELINE_STATUSES.indexOf(state.status as TimelineStatus);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Call timeline
        </p>
        {isCompleted && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Request confirmed
          </span>
        )}
      </div>

      <ol className="mt-5 grid grid-cols-3 gap-0">
        {TIMELINE_STATUSES.map((s, i) => {
          const done =
            !isFailed && !isDeclined && (isCompleted || (currentIdx >= 0 && i < currentIdx));
          const active =
            !isFailed &&
            !isDeclined &&
            !isCompleted &&
            currentIdx >= 0 &&
            i === currentIdx;
          const pending =
            isFailed ||
            isDeclined ||
            currentIdx < 0 ||
            (!isCompleted && i > currentIdx);
          return (
            <li key={s} className="relative flex flex-col items-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={
                    "absolute top-3 right-1/2 h-0.5 w-full " +
                    (done || (active && i > 0) ? "bg-brand" : "bg-slate-200")
                  }
                />
              )}
              <span
                className={
                  "relative z-10 grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ring-4 ring-white " +
                  (done
                    ? "bg-brand text-white"
                    : active
                      ? "bg-brand text-white"
                      : "bg-slate-200 text-slate-500")
                }
              >
                {done ? "✓" : i + 1}
                {active && (
                  <span className="pulse-ring absolute inset-0 rounded-full text-brand" />
                )}
              </span>
              <p
                className={
                  "mt-2 text-center text-[11px] font-medium " +
                  (active
                    ? "text-slate-900"
                    : done
                      ? "text-slate-700"
                      : "text-slate-400")
                }
              >
                {LABELS[s]}
              </p>
              <p
                className={
                  "mt-0.5 max-w-[10rem] text-center text-[10px] leading-tight " +
                  (pending ? "text-slate-400" : "text-slate-500")
                }
              >
                {SUBTITLES[s]}
              </p>
            </li>
          );
        })}
      </ol>

      {isDeclined && (
        <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100">
          <span className="font-semibold">Declined:</span>{" "}
          {state.error ?? "The caller or the phone tap declined the request."}
        </p>
      )}

      {isFailed && (
        <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100">
          <span className="font-semibold">Failed:</span>{" "}
          {state.error ?? "unknown error"}
        </p>
      )}
    </section>
  );
}
