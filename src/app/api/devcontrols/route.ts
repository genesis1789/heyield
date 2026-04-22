import { NextResponse } from "next/server";
import { mockConfig, setMockConfig } from "@/lib/providers";

export async function GET() {
  return NextResponse.json({ mockConfig });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    forceFailure?: boolean;
    skipDelays?: boolean;
    confirmAfterMs?: number;
  };
  setMockConfig(body);
  return NextResponse.json({ mockConfig });
}
