import { NextResponse } from "next/server";
import { setSimulatorConfig, simulatorConfig } from "@/lib/providers";

export async function GET() {
  return NextResponse.json({
    simulatorConfig: {
      forceFailure: simulatorConfig.forceFailure,
      skipDelays: simulatorConfig.skipDelays,
      stepMs: simulatorConfig.stepMs,
    },
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    forceFailure?: boolean;
    skipDelays?: boolean;
    stepMs?: number;
  };
  setSimulatorConfig(body);
  return NextResponse.json({
    simulatorConfig: {
      forceFailure: simulatorConfig.forceFailure,
      skipDelays: simulatorConfig.skipDelays,
      stepMs: simulatorConfig.stepMs,
    },
  });
}
