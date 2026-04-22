"use client";

import { useEffect, useRef } from "react";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  partial: boolean;
}

interface Props {
  entries: TranscriptEntry[];
  active: boolean;
}

export function TranscriptPane({ entries, active }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [entries]);

  const visible = entries.filter((e) => e.text.trim().length > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Transcript
        </p>
        {active && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-ring text-emerald-400" />
            Live
          </span>
        )}
      </div>
      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 text-sm">
        {visible.length === 0 ? (
          <p className="text-slate-400">
            {active
              ? "Listening…"
              : "The transcript will appear here once you start the call."}
          </p>
        ) : (
          visible.map((e) => (
            <div key={e.id} className="flex gap-3">
              <span
                className={
                  "mt-0.5 inline-flex h-6 min-w-[4.5rem] items-center justify-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-wide " +
                  (e.role === "assistant"
                    ? "bg-brand-50 text-brand ring-1 ring-brand/20"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200")
                }
              >
                {e.role === "assistant" ? "Concierge" : "You"}
              </span>
              <p
                className={
                  "flex-1 leading-relaxed " +
                  (e.partial ? "text-slate-400" : "text-slate-800")
                }
              >
                {e.text}
              </p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}
