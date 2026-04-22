import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * GET /api/funding/[id]
 *
 * Returns a funding session snapshot. Used by both the dashboard status
 * timeline and the standalone `/checkout/[id]` sandbox page.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { funding } = getProviders();
  const session = await funding.getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}
