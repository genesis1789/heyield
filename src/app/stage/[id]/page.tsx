import { StageFrame } from "@/components/stage/StageFrame";

export const dynamic = "force-dynamic";

/**
 * Session-pinned stage view. This is the redirect target Revolut sends the
 * user's browser to after a successful sandbox payment, so the Aave-styled
 * status page always tracks the correct funding session even if a fresh
 * session has since been started on the device.
 */
export default function StageForSession({
  params,
}: {
  params: { id: string };
}) {
  return <StageFrame sessionId={params.id} />;
}
