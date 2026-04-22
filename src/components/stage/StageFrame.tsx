"use client";

import { useStageSession } from "./useStageSession";
import { pickStageScreen, type StageSession } from "./types";
import { StageWaiting } from "./StageWaiting";
import { StageListening } from "./StageListening";
import { StageRecommendation } from "./StageRecommendation";
import { StageHandoff } from "./StageHandoff";
import { StageInvesting } from "./StageInvesting";
import { StageInvested } from "./StageInvested";
import { StageEnded } from "./StageEnded";

interface Props {
  /**
   * When set, the stage polls `/api/funding/[sessionId]` directly. Used by
   * `/stage/[id]` so Revolut redirects always land on a pinned session even
   * if the agent has already started a new one.
   */
  sessionId?: string;
}

const FALLBACK: StageSession = {
  callStatus: "idle",
  recommendation: null,
  funding: null,
  updatedAt: 0,
};

export function StageFrame({ sessionId }: Props) {
  const { session } = useStageSession({ sessionId });
  const s = session ?? FALLBACK;
  const screen = pickStageScreen(s);

  switch (screen) {
    case "waiting":
    case "ringing":
      return <StageWaiting />;
    case "listening":
      return <StageListening />;
    case "recommendation":
      return s.recommendation ? (
        <StageRecommendation rec={s.recommendation} />
      ) : (
        <StageListening />
      );
    case "handoff":
      return s.funding ? (
        <StageHandoff funding={s.funding} />
      ) : (
        <StageListening />
      );
    case "investing":
      return s.funding ? (
        <StageInvesting
          funding={s.funding}
          recommendation={s.recommendation}
        />
      ) : (
        <StageWaiting />
      );
    case "invested":
      return s.funding ? (
        <StageInvested
          funding={s.funding}
          recommendation={s.recommendation}
        />
      ) : (
        <StageWaiting />
      );
    case "ended":
      return <StageEnded funding={s.funding} />;
    default: {
      // Exhaustiveness guard
      const _never: never = screen;
      void _never;
      return <StageWaiting />;
    }
  }
}
