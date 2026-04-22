import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";
import { ApprovalTapBodySchema } from "@/lib/schemas";
import type { ApprovalResult, RevolutAdapter } from "@/lib/providers/types";
import { setApproval } from "@/lib/agent/session";

type Tappable = RevolutAdapter & {
  recordTap: (id: string, decision: "approve" | "decline") => ApprovalResult | null;
};

function isTappable(x: RevolutAdapter): x is Tappable {
  return typeof (x as Tappable).recordTap === "function";
}

export const dynamic = "force-dynamic";

/**
 * POST /api/approvals/[id]/tap  { decision: "approve" | "decline" }
 *
 * Dashboard → backend hook for the mock Revolut push card. Only meaningful
 * when REVOLUT_PROVIDER=mock; a real approval rail would receive the decision
 * asynchronously from the user's actual Revolut app.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = ApprovalTapBodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "invalid body", details: body.error.flatten() },
      { status: 400 },
    );
  }

  const { revolut } = getProviders();
  if (!isTappable(revolut)) {
    return NextResponse.json(
      { error: "tap not supported on the active Revolut adapter" },
      { status: 501 },
    );
  }

  const result = revolut.recordTap(params.id, body.data.decision);
  if (!result) {
    return NextResponse.json({ error: "approval not found" }, { status: 404 });
  }
  setApproval({
    approvalId: result.approvalId,
    intentId: result.intentId,
    status: result.status,
    errorMessage: result.errorMessage,
  });
  return NextResponse.json({ approval: result });
}
