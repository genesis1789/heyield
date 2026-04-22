"use client";

/**
 * Live iframe of the phone-facing `/stage` surface at a near-phone aspect
 * ratio, so the operator sees exactly what the audience sees without
 * needing to look at the phone.
 */
export function StageMirror() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Stage mirror
        </p>
        <a
          href="/stage"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-medium text-brand hover:text-brand-700"
        >
          Open in new tab ↗
        </a>
      </div>

      <div className="mt-3 flex justify-center">
        <div className="relative overflow-hidden rounded-[1.75rem] border-4 border-slate-900 bg-slate-900 shadow-lg">
          <iframe
            src="/stage"
            title="Stage preview"
            className="block h-[520px] w-[290px] border-0 bg-white"
          />
        </div>
      </div>
    </section>
  );
}
