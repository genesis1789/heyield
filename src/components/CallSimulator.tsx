"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createTelephony, telephonyProviderLabel } from "@/lib/providers/telephony/factory";
import { initialState, transition } from "@/lib/state/machine";
import type { DemoEvent, DemoState } from "@/lib/state/types";
import type { ApprovalStatus } from "@/lib/providers/types";
import type { CallStatus, TranscriptEntry } from "@/lib/agent/session";
import { CallControl } from "./CallControl";
import { TranscriptPane } from "./TranscriptPane";
import { RecommendationCard, type RecommendationSummary } from "./RecommendationCard";
import { PhonePushCard } from "./PhonePushCard";
import { StatusTimeline } from "./StatusTimeline";
import { DevControls } from "./DevControls";

const SESSION_POLL_MS = 750;

interface AgentSessionView {
  recommendation: (RecommendationSummary & { intentId: string }) | null;
  approval: {
    approvalId: string;
    intentId: string;
    status: ApprovalStatus;
    errorMessage?: string;
  } | null;
  transcript: TranscriptEntry[];
  callStatus: CallStatus;
  updatedAt: number;
}

const IDLE_SESSION: AgentSessionView = {
  recommendation: null,
  approval: null,
  transcript: [],
  callStatus: "idle",
  updatedAt: 0,
};

function deriveStateFromSession(session: AgentSessionView, prev: DemoState): DemoState {
  if (session.approval?.status === "approved") {
    return { status: "completed" };
  }
  if (session.approval?.status === "declined") {
    return {
      status: "declined",
      error: session.approval.errorMessage ?? prev.error,
    };
  }
  if (session.approval) {
    return { status: "approval_pending" };
  }
  if (session.recommendation) {
    return { status: "recommended" };
  }
  if (session.callStatus !== "idle") {
    return { status: "call_active" };
  }
  return prev.status === "failed" ? prev : initialState();
}

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

  // ─── Always-on session poll ─────────────────────────────────────────────
  // We poll regardless of which channel started the call (web click OR
  // inbound dial), so the dashboard reflects whatever Vapi is doing right
  // now. When state is terminal, we back off.
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

  // ─── Reconcile dashboard state to the latest server snapshot ────────────
  const callLive = session.callStatus === "in-progress";
  const callEnded = session.callStatus === "ended";

  useEffect(() => {
    setState((prev) => {
      const next = deriveStateFromSession(session, prev);
      return next.status === prev.status && next.error === prev.error ? prev : next;
    });
  }, [session]);

  // ─── Web-call lifecycle: only the "Start call" button uses this ────────
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
      await telephony.start(() => {
        // Transcripts now come from the server-side poll; we intentionally
        // ignore the client-side utterance callback so web + phone calls
        // render identically.
      });
      // session poll will pick up status "in-progress" once Vapi connects.
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

  const onTap = useCallback(
    async (decision: "approve" | "decline") => {
      if (!session.approval) return;
      try {
        await fetch(`/api/approvals/${session.approval.approvalId}/tap`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        });
      } catch {
        // the poll will reconcile
      }
    },
    [session.approval],
  );

  const approvalOutcome: "approved" | "declined" | null =
    session.approval?.status === "approved"
      ? "approved"
      : session.approval?.status === "declined"
        ? "declined"
        : null;

  const amountLabel = session.recommendation
    ? new Intl.NumberFormat(
        session.recommendation.fiatCurrency === "EUR" ? "en-IE" : "en-US",
        {
          style: "currency",
          currency: session.recommendation.fiatCurrency,
          maximumFractionDigits: 0,
        },
      ).format(session.recommendation.amountFiat)
    : "";

  const showPush =
    session.recommendation !== null &&
    session.approval !== null &&
    (state.status === "approval_pending" || approvalOutcome !== null);

  const showStartOver =
    state.status === "completed" ||
    state.status === "declined" ||
    state.status === "failed" ||
    callEnded;

  return (
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

      {provider === "browser" && (
        <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-900">
          <p className="font-medium">Preview mode — no Vapi agent configured.</p>
          <p className="mt-1 text-amber-800">
            Set <code className="font-mono">NEXT_PUBLIC_TELEPHONY_PROVIDER=vapi</code>{" "}
            plus <code className="font-mono">NEXT_PUBLIC_VAPI_PUBLIC_KEY</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_VAPI_ASSISTANT_ID</code> in{" "}
            <code className="font-mono">.env.local</code> to enable the real voice
            concierge. See{" "}
            <code className="font-mono">docs/vapi-assistant-config.md</code>.
          </p>
        </section>
      )}

      <TranscriptPane entries={session.transcript} active={callLive} />

      {session.recommendation && <RecommendationCard summary={session.recommendation} />}

      {showPush && session.approval && session.recommendation && (
        <PhonePushCard
          approvalId={session.approval.approvalId}
          productName={session.recommendation.productName}
          amountLabel={amountLabel}
          outcome={approvalOutcome}
          onTap={onTap}
        />
      )}

      {session.recommendation && <StatusTimeline state={state} />}

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
  );
}
