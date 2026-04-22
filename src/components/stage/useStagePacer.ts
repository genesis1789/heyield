"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dwell-clocked pacer for the Aave-style rail.
 *
 * Reads a `targetIdx` derived from the server's `FundingStatus` and advances
 * a `visualIdx` toward it with a minimum dwell (default 3000ms) per step.
 * Never goes backwards. If the visitor has already seen this session id in
 * this tab (`sessionStorage`), jumps straight to the current target without
 * replaying.
 *
 * Ported from the hackaton status page's `tickAdvance` / `scheduleAdvance`
 * loop (see hackaton/revolut/src/server.ts ~L901-L955).
 */

export interface UseStagePacerOptions {
  /**
   * Stable id for this funding session. Used as the sessionStorage key so
   * reloads don't replay the animation.
   */
  sessionId: string | null;
  /**
   * 0-based index the server thinks the UI should be on.
   */
  targetIdx: number;
  /**
   * Optional "success" short-circuit. When true, the pacer will walk to the
   * final step once and then hold.
   */
  success: boolean;
  /**
   * Number of steps in the rail. Needed so we know the final index.
   */
  stepCount: number;
  /**
   * Milliseconds per step. Default 3000ms.
   */
  dwellMs?: number;
}

export interface UseStagePacerResult {
  visualIdx: number;
  visualSuccess: boolean;
}

export function useStagePacer({
  sessionId,
  targetIdx,
  success,
  stepCount,
  dwellMs = 3000,
}: UseStagePacerOptions): UseStagePacerResult {
  const storageKey = sessionId ? `stage-seen-${sessionId}` : null;

  // "Already seen this session in this tab?" Check once, synchronously, so
  // reload jumps straight to the final state.
  const sawBefore = (() => {
    if (typeof window === "undefined" || !storageKey) return false;
    try {
      return window.sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  })();

  const [visualIdx, setVisualIdx] = useState(() =>
    sawBefore ? Math.min(targetIdx, stepCount - 1) : 0,
  );
  const [visualSuccess, setVisualSuccess] = useState(() => sawBefore && success);

  const lastAdvanceRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : 0,
  );
  const timerRef = useRef<number | null>(null);
  const targetIdxRef = useRef(targetIdx);
  const successRef = useRef(success);
  const visualIdxRef = useRef(visualIdx);
  const visualSuccessRef = useRef(visualSuccess);

  targetIdxRef.current = targetIdx;
  successRef.current = success;
  visualIdxRef.current = visualIdx;
  visualSuccessRef.current = visualSuccess;

  const markSeen = useCallback(() => {
    if (!storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  }, [storageKey]);

  const scheduleAdvance = useCallback(() => {
    if (timerRef.current !== null) return;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const wait = Math.max(0, lastAdvanceRef.current + dwellMs - now);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      tickAdvance();
    }, wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dwellMs]);

  const tickAdvance = useCallback(() => {
    if (visualSuccessRef.current) return;
    const curIdx = visualIdxRef.current;
    const tgt = targetIdxRef.current;
    const suc = successRef.current;

    if (curIdx < tgt) {
      const next = curIdx + 1;
      if (suc && next >= stepCount - 1) {
        visualIdxRef.current = stepCount - 1;
        visualSuccessRef.current = true;
        setVisualIdx(stepCount - 1);
        setVisualSuccess(true);
        markSeen();
        return;
      }
      visualIdxRef.current = next;
      setVisualIdx(next);
      lastAdvanceRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (next < tgt || suc) {
        scheduleAdvance();
      } else {
        markSeen();
      }
    } else if (suc) {
      visualIdxRef.current = stepCount - 1;
      visualSuccessRef.current = true;
      setVisualIdx(stepCount - 1);
      setVisualSuccess(true);
      markSeen();
    }
  }, [markSeen, scheduleAdvance, stepCount]);

  // Initial boot: if we haven't seen this session and the server is already
  // ahead, start the advance loop from step 0.
  useEffect(() => {
    if (sawBefore) return;
    lastAdvanceRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (targetIdx > 0 || success) {
      scheduleAdvance();
    }
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever the target changes, schedule or snap depending on sawBefore.
  useEffect(() => {
    if (sawBefore) {
      const next = Math.min(targetIdx, stepCount - 1);
      visualIdxRef.current = next;
      setVisualIdx(next);
      if (success) {
        visualSuccessRef.current = true;
        setVisualSuccess(true);
      }
      return;
    }
    // Nudge the advance loop to pick up the new target.
    scheduleAdvance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIdx, success]);

  return { visualIdx, visualSuccess };
}
