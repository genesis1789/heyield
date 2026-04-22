import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * GET /api/pricing
 *
 * Returns a live on-chain-cost snapshot from LI.FI for the curated Base
 * deposit leg. Shape: { estimate: { gasUsd, feeUsd, source } }. The adapter
 * degrades to `source: "fallback"` when LI.FI is unreachable so the UI can
 * always render a number.
 */
export async function GET() {
  const { pricing } = getProviders();
  const estimate = await pricing.estimateDepositCost();
  return NextResponse.json({ estimate });
}
