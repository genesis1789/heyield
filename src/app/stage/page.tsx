import { StageFrame } from "@/components/stage/StageFrame";

export const dynamic = "force-dynamic";

/**
 * Audience-facing phone surface. Polls the latest agent session and picks
 * one of seven full-bleed screens. No chrome, no transcript, no operator
 * controls — intended for screen-share on a phone.
 */
export default function StagePage() {
  return <StageFrame />;
}
