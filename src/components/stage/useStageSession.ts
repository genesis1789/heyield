"use client";

import { useEffect, useRef, useState } from "react";
import type { StageSession } from "./types";

/**
 * Phone-side session poll.
 *
 * Mirrors the polling discipline from the hackaton status page:
 *   - 1.2s base interval, exponential backoff (×1.8) up to 10s on fetch error
 *   - AbortController on in-flight request
 *   - pauses on tab hidden, resumes on visible (and resets backoff)
 *   - stops on terminal states
 *
 * Two fetch shapes are supported:
 *   - `/api/agent/session`         — when no sessionId is pinned (latest session)
 *   - `/api/funding/[sessionId]`   — when pinned (Revolut redirect target)
 *
 * Either way the hook returns a unified StageSession.
 */

const BASE_MS = 1200;
const MAX_MS = 10000;
const BACKOFF_FACTOR = 1.8;

export interface UseStageSessionResult {
  session: StageSession | null;
  loading: boolean;
  error: string | null;
}

type SessionEnvelope = {
  session: {
    recommendation: unknown;
    funding: unknown;
    callStatus: string;
    updatedAt: number;
  };
};

type FundingEnvelope = {
  session: {
    sessionId: string;
    intentId: string;
    status: string;
    mode: string;
    simulated: boolean;
    checkoutUrl: string;
    amountFiat: number;
    fiatCurrency: string;
    productName: string;
    protocolLabel: string;
    destWalletAddress?: string;
    txHash?: string;
    txExplorerUrl?: string;
    errorMessage?: string;
    updatedAt: number;
  };
};

function normalizeAgentSession(data: SessionEnvelope): StageSession {
  const s = data.session;
  return {
    callStatus: (s.callStatus ?? "idle") as StageSession["callStatus"],
    recommendation: s.recommendation as StageSession["recommendation"],
    funding: s.funding as StageSession["funding"],
    updatedAt: s.updatedAt ?? 0,
  };
}

function normalizeFundingOnly(data: FundingEnvelope): StageSession {
  const f = data.session;
  return {
    callStatus: "ended",
    recommendation: null,
    funding: {
      sessionId: f.sessionId,
      intentId: f.intentId,
      status: f.status as StageSession["funding"] extends null
        ? never
        : NonNullable<StageSession["funding"]>["status"],
      mode: f.mode as NonNullable<StageSession["funding"]>["mode"],
      simulated: f.simulated,
      checkoutUrl: f.checkoutUrl,
      amountFiat: f.amountFiat,
      fiatCurrency: f.fiatCurrency as NonNullable<
        StageSession["funding"]
      >["fiatCurrency"],
      productName: f.productName,
      protocolLabel: f.protocolLabel,
      destWalletAddress: f.destWalletAddress,
      txHash: f.txHash,
      txExplorerUrl: f.txExplorerUrl,
      errorMessage: f.errorMessage,
    },
    updatedAt: f.updatedAt ?? 0,
  };
}

function isTerminal(session: StageSession | null): boolean {
  const s = session?.funding?.status;
  return s === "invested" || s === "cancelled" || s === "failed";
}

export function useStageSession(
  options: { sessionId?: string } = {},
): UseStageSessionResult {
  const { sessionId } = options;
  const [session, setSession] = useState<StageSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backoffRef = useRef(BASE_MS);
  const aborterRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  // Use a ref for the latest session so `tick` doesn't need to be re-built
  // on every render.
  const sessionRef = useRef<StageSession | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    stoppedRef.current = false;
    backoffRef.current = BASE_MS;

    const cancelInflight = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (aborterRef.current) {
        try {
          aborterRef.current.abort();
        } catch {
          // ignore
        }
        aborterRef.current = null;
      }
    };

    const tick = async () => {
      if (stoppedRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;

      const aborter = new AbortController();
      aborterRef.current = aborter;

      const url = sessionId
        ? `/api/funding/${encodeURIComponent(sessionId)}`
        : `/api/agent/session`;

      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: aborter.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`http ${res.status}`);
        const data = (await res.json()) as SessionEnvelope | FundingEnvelope;

        let next: StageSession;
        if (sessionId) {
          next = normalizeFundingOnly(data as FundingEnvelope);
        } else {
          next = normalizeAgentSession(data as SessionEnvelope);
        }

        setSession((prev) =>
          prev && prev.updatedAt === next.updatedAt ? prev : next,
        );
        setLoading(false);
        setError(null);
        backoffRef.current = BASE_MS;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
        backoffRef.current = Math.min(
          Math.round(backoffRef.current * BACKOFF_FACTOR),
          MAX_MS,
        );
      } finally {
        aborterRef.current = null;
        if (stoppedRef.current) return;
        if (isTerminal(sessionRef.current)) return;
        if (typeof document !== "undefined" && document.hidden) return;
        timerRef.current = window.setTimeout(tick, backoffRef.current);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelInflight();
      } else if (!stoppedRef.current && !isTerminal(sessionRef.current)) {
        cancelInflight();
        backoffRef.current = BASE_MS;
        void tick();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    void tick();

    return () => {
      stoppedRef.current = true;
      cancelInflight();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionId]);

  return { session, loading, error };
}
