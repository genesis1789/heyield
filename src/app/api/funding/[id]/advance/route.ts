import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";
import { FundingAdvanceBodySchema } from "@/lib/schemas";
import { setFunding } from "@/lib/agent/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/funding/[id]/advance   { event: "confirm_payment" | "cancel" }
 *
 * Dashboard → backend hook. Only meaningful for providers that implement
 * the `advance` method — primarily the simulator, where this is how the
 * sandbox "Pay" button drives the lifecycle forward.
 *
 * For the real merchant provider, payment progression is driven by
 * Revolut's own lifecycle events (via server-side polling), so `cancel`
 * is the only useful event on that side; `confirm_payment` is a no-op.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = FundingAdvanceBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json(
      { error: "invalid body", details: body.error.flatten() },
      { status: 400 },
    );
  }

  const { funding } = getProviders();
  if (!funding.advance) {
    return NextResponse.json(
      { error: "advance not supported on the active funding provider" },
      { status: 501 },
    );
  }
  const session = await funding.advance(params.id, { type: body.data.event });
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  setFunding({
    sessionId: session.sessionId,
    intentId: session.intentId,
    status: session.status,
    mode: session.mode,
    simulated: session.simulated,
    checkoutUrl: session.checkoutUrl,
    amountFiat: session.amountFiat,
    fiatCurrency: session.fiatCurrency,
    productName: session.productName,
    protocolLabel: session.protocolLabel,
    destWalletAddress: session.destWalletAddress,
    txHash: session.txHash,
    txExplorerUrl: session.txExplorerUrl,
    errorMessage: session.errorMessage,
  });
  return NextResponse.json({ session });
}
