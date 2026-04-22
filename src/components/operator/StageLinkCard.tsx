"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

/**
 * Operator-facing "point your phone here" card. Renders a QR code to
 * `/stage` using the public base URL (if configured) or the browser's own
 * origin as a fallback. The audience scans it once before the demo, loads
 * the stage on their phone, and never leaves the single-screen story.
 */
export function StageLinkCard() {
  const [origin, setOrigin] = useState<string>("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromEnv = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;
    const base = fromEnv && fromEnv.length > 0 ? fromEnv : window.location.origin;
    setOrigin(base);
  }, []);

  const stageUrl = useMemo(() => {
    if (!origin) return "";
    return `${origin.replace(/\/$/, "")}/stage`;
  }, [origin]);

  useEffect(() => {
    if (!stageUrl) return;
    let cancelled = false;
    QRCode.toDataURL(stageUrl, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: "#0F1115", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [stageUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(stageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; silent
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Phone stage
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Scan this with the demo phone. The audience-facing UI is at{" "}
            <code className="font-mono text-xs text-slate-900">/stage</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-[140px] w-[140px] items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
          {dataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={dataUrl}
              alt={`QR code to ${stageUrl}`}
              width={128}
              height={128}
              className="rounded"
            />
          ) : (
            <span className="text-xs text-slate-400">Generating…</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-all font-mono text-[11px] leading-relaxed text-slate-600">
            {stageUrl || "—"}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            For the real Revolut flow, point{" "}
            <code className="font-mono">PUBLIC_BASE_URL</code> at a tunnel
            (ngrok) so the redirect target resolves from the phone&rsquo;s
            browser.
          </p>
        </div>
      </div>
    </section>
  );
}
