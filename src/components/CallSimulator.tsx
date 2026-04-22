"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createTelephony, telephonyProviderLabel } from "@/lib/providers/telephony/factory";
import { initialState, transition } from "@/lib/state/machine";
import type { DemoEvent, DemoState } from "@/lib/state/types";
import type {
  FundingProviderKind,
  FundingStatus,
} from "@/lib/providers/funding/types";
import type { CallStatus, TranscriptEntry } from "@/lib/agent/session";
import { CallControl } from "./CallControl";
import { TranscriptPane } from "./TranscriptPane";
import { DevControls } from "./DevControls";
import { StageLinkCard } from "./operator/StageLinkCard";
import { StageMirror } from "./operator/StageMirror";

const SESSION_POLL_MS = 750;

interface FundingView {
  sessionId: string;
  intentId: string;
  status: FundingStatus;
  mode: FundingProviderKind;
  simulated: boolean;
  checkoutUrl: string;
  amountFiat: number;
  fiatCurrency: "EUR" | "USD";
  productName: string;
  protocolLabel: string;
  destWalletAddress?: string;
  txHash?: string;
  txExplorerUrl?: string;
  errorMessage?: string;
}

interface RecommendationView {
  intentId: string;
  productName: string;
  chain: string;
  apyPct: number;
  amountFiat: number;
  fiatCurrency: "EUR" | "USD";
}

interface AgentSessionView {
  recommendation: RecommendationView | null;
  funding: FundingView | null;
  transcript: TranscriptEntry[];
  callStatus: CallStatus;
  updatedAt: number;
}

const IDLE_SESSION: AgentSessionView = {
  recommendation: null,
  funding: null,
  transcript: [],
  callStatus: "idle",
  updatedAt: 0,
};

function deriveStateFromSession(
  session: AgentSessionView,
  prev: DemoState,
): DemoState {
  const f = session.funding;
  if (f) {
    switch (f.status) {
      case "invested":
        return { status: "invested" };
      case "failed":
        return { status: "failed", error: f.errorMessage ?? prev.error };
      case "cancelled":
        return { status: "cancelled", error: f.errorMessage ?? prev.error };
      case "routing_to_yield":
        return { status: "routing_to_yield" };
      case "payment_received":
        return { status: "payment_received" };
      case "awaiting_checkout":
        return { status: "awaiting_checkout" };
    }
  }
  if (session.recommendation) {
    return { status: "recommended" };
  }
  if (session.callStatus !== "idle") {
    return { status: "call_active" };
  }
  return prev.status === "failed" ? prev : initialState();
}

/**
 * Operator console. Drives the call, shows what the agent is doing, and
 * mirrors the audience-facing `/stage` view in a phone-shaped iframe so the
 * operator can see the phone without looking at it.
 *
 * All audience-facing UI (recommendation, handoff, investment timeline,
 * success) lives on `/stage` and is intentionally NOT duplicated here.
 */
export function CallSimulator() {
  const telephony = useMemo(() => createTelephony(), []);
  const [provider, setProvider] = useState<"vapi" | "browser">("browser");
  const [supported, setSupported] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  useEffect(() => {
    setProvider(telephonyProviderLabel());
    setSupported(telephony.isSupported());
    setPhoneNumber(process.env.NEXT_PUBLIC_VAPI_PHONE_NUMBER ?? null);
  }, [telephony]);

  const [state, setState] = useState<DemoState>(initialState());
  const [connecting, setConnecting] = useState(false);
  const [session, setSession] = useState<AgentSessionView>(IDLE_SESSION);

  const dispatch = useCallback((ev: DemoEvent) => {
    setState((s) => transition(s, ev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/agent/session");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { session: AgentSessionView };
        setSession((prev) =>
          data.session.updatedAt === prev.updatedAt ? prev : data.session,
        );
      } catch {
        // transient — next tick will retry
      }
    };
    void tick();
    const id = window.setInterval(tick, SESSION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const callLive = session.callStatus === "in-progress";
  const callEnded = session.callStatus === "ended";

  useEffect(() => {
    setState((prev) => {
      const next = deriveStateFromSession(session, prev);
      return next.status === prev.status && next.error === prev.error
        ? prev
        : next;
    });
  }, [session]);

  const startWebCall = useCallback(async () => {
    if (connecting || callLive) return;
    setConnecting(true);
    try {
      await fetch("/api/agent/session", { method: "DELETE" });
    } catch {
      // non-fatal
    }
    dispatch({ type: "RESET" });
    try {
      await telephony.start(() => {});
    } catch (err) {
      dispatch({
        type: "FAIL",
        reason: err instanceof Error ? err.message : "Could not start call.",
      });
    } finally {
      setConnecting(false);
    }
  }, [callLive, connecting, dispatch, telephony]);

  const endWebCall = useCallback(async () => {
    try {
      await telephony.stop();
    } catch {
      // best-effort
    }
  }, [telephony]);

  const reset = useCallback(async () => {
    await endWebCall();
    dispatch({ type: "RESET" });
    try {
      await fetch("/api/agent/session", { method: "DELETE" });
    } catch {
      // fine
    }
    setSession(IDLE_SESSION);
  }, [dispatch, endWebCall]);

  const showStartOver =
    state.status === "invested" ||
    state.status === "cancelled" ||
    state.status === "failed" ||
    callEnded;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-5">
        <CallControl
          active={callLive}
          connecting={connecting}
          disabled={provider === "browser" && !supported}
          provider={provider}
          phoneNumber={phoneNumber}
          onStart={startWebCall}
          onEnd={endWebCall}
        />

        <StageLinkCard />

        {provider === "browser" && (
          <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-900">
            <p className="font-semibold uppercase tracking-wide text-amber-700">
              Preview mode
            </p>
            <p className="mt-1 leading-relaxed">
              No Vapi agent configured. The stage still renders state changes
              driven by tool calls, but no voice agent is running. Set{" "}
              <code className="font-mono">NEXT_PUBLIC_TELEPHONY_PROVIDER=vapi</code>
              {" "}+ Vapi keys in{" "}
              <code className="font-mono">.env.local</code> to enable it.
            </p>
          </section>
        )}

        <TranscriptPane entries={session.transcript} active={callLive} />

        <OperatorDiagnostics
          state={state}
          session={session}
        />

        {showStartOver && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-brand hover:text-brand-700"
            >
              Start over
            </button>
          </div>
        )}

        <DevControls />
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-6 space-y-5">
          <StageMirror />
        </div>
      </div>
    </div>
  );
}

function OperatorDiagnostics({
  state,
  session,
}: {
  state: DemoState;
  session: AgentSessionView;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Session
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
        <Row label="Call" value={session.callStatus} />
        <Row label="Demo state" value={state.status} />
        <Row
          label="Recommendation"
          value={
            session.recommendation
              ? `${session.recommendation.productName} · ${session.recommendation.apyPct.toFixed(2)}%`
              : "—"
          }
        />
        <Row
          label="Funding mode"
          value={session.funding?.mode ?? "—"}
        />
        <Row
          label="Funding id"
          value={session.funding?.sessionId ?? "—"}
        />
        <Row
          label="Funding status"
          value={session.funding?.status ?? "—"}
        />
        <Row
          label="Tx hash"
          value={
            session.funding?.txHash
              ? `${session.funding.txHash.slice(0, 6)}…${session.funding.txHash.slice(-4)}`
              : "—"
          }
        />
      </dl>
      {session.funding?.checkoutUrl && (
        <a
          href={session.funding.checkoutUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-[11px] font-medium text-brand hover:text-brand-700"
        >
          Open checkout URL ↗
        </a>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="break-all text-slate-800">{value}</dd>
    </>
  );
}
