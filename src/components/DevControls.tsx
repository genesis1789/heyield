"use client";

import { useCallback, useEffect, useState } from "react";

interface Config {
  forceFailure: boolean;
  skipDelays: boolean;
  confirmAfterMs: number;
}

export function DevControls() {
  const [config, setConfig] = useState<Config | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/devcontrols");
    const data = (await res.json()) as { mockConfig: Config };
    setConfig(data.mockConfig);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(async (patch: Partial<Config>) => {
    const res = await fetch("/api/devcontrols", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { mockConfig: Config };
    setConfig(data.mockConfig);
  }, []);

  if (!config) return null;

  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Dev controls
        </span>
        <span className="text-xs text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.forceFailure}
              onChange={(e) => update({ forceFailure: e.target.checked })}
            />
            Force funding failure
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.skipDelays}
              onChange={(e) => update({ skipDelays: e.target.checked })}
            />
            Skip mock delays
          </label>
        </div>
      )}
    </section>
  );
}
