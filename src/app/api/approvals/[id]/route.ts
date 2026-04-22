import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/[id]
 *
 * Dashboard polls this while state === "approval_pending". Also doubles as
 * the read-only surface the voice agent could reach via `getApprovalStatus`,
 * though the agent normally hits /api/vapi/webhook instead.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { revolut } = getProviders();
  const approval = await revolut.getApprovalStatus(params.id);
  return NextResponse.json({ approval });
}
