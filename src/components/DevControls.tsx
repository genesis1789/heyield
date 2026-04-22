"use client";

import { useCallback, useEffect, useState } from "react";

interface Config {
  forceFailure: boolean;
  skipDelays: boolean;
  stepMs: number;
}

/**
 * Operator-only controls. Hidden by default so the live audience never
 * sees them; toggled open by appending `?dev=1` to the URL or hitting
 * Shift+D on the dashboard.
 */
export function DevControls() {
  const [config, setConfig] = useState<Config | null>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show on `?dev=1` or `localStorage.vc_dev = 1`.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("dev") === "1") {
        setVisible(true);
        window.localStorage.setItem("vc_dev", "1");
      } else if (window.localStorage.getItem("vc_dev") === "1") {
        setVisible(true);
      }
    } catch {
      // ignore
    }
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        setVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/devcontrols");
    const data = (await res.json()) as { simulatorConfig: Config };
    setConfig(data.simulatorConfig);
  }, []);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [load, visible]);

  const update = useCallback(async (patch: Partial<Config>) => {
    const res = await fetch("/api/devcontrols", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { simulatorConfig: Config };
    setConfig(data.simulatorConfig);
  }, []);

  if (!visible || !config) return null;

  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Operator controls
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
            Fast-forward timeline
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Step cadence:
            <input
              type="number"
              min={200}
              max={6000}
              step={100}
              value={config.stepMs}
              onChange={(e) =>
                update({ stepMs: Number(e.target.value) || config.stepMs })
              }
              className="h-7 w-20 rounded-md border border-slate-200 px-2 text-sm"
            />
            ms
          </label>
        </div>
      )}
    </section>
  );
}
