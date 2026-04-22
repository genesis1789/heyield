"use client";

import type { StageFunding, StageRecommendation } from "./types";
import { StageInvesting } from "./StageInvesting";

interface Props {
  funding: StageFunding;
  recommendation: StageRecommendation | null;
}

/**
 * Success finale. Same layout as StageInvesting (keeps the amount card,
 * pill, hero, rail in identical geometry so the page doesn't rearrange
 * when the rail completes). The pacer still runs through the steps the
 * first time the user lands, then locks on "earning".
 */
export function StageInvested({ funding, recommendation }: Props) {
  return (
    <StageInvesting
      funding={funding}
      recommendation={recommendation}
      finale
    />
  );
}
