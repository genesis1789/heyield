import { NextResponse } from "next/server";
import { getSession, resetSession } from "@/lib/agent/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ session: getSession() });
}

export async function DELETE() {
  resetSession();
  return NextResponse.json({ session: getSession() });
}
