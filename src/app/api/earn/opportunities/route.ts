import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";

export async function GET() {
  const { earn } = getProviders();
  const opportunities = await earn.listOpportunities();
  return NextResponse.json({ opportunities });
}
