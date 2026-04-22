import { NextResponse } from "next/server";
import { DialBodySchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/dial  { phoneNumber: "+14155551234" }
 *
 * Starts an outbound Vapi call to the caller's phone. Vapi rings the number;
 * when answered, the concierge assistant is already on the line.
 *
 * Required server env:
 *   - VAPI_PRIVATE_KEY      (dashboard → Vapi API Keys → Private API Key)
 *   - VAPI_PHONE_NUMBER_ID  (dashboard → Phone Numbers → click the number → copy its id)
 *   - VAPI_ASSISTANT_ID     (falls back to NEXT_PUBLIC_VAPI_ASSISTANT_ID so you don't have
 *                            to set it twice; the private value wins if both are present)
 *
 * Docs: https://docs.vapi.ai/calls/outbound-calling
 */
export async function POST(req: Request) {
  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const assistantId =
    process.env.VAPI_ASSISTANT_ID ?? process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

  if (!privateKey || !phoneNumberId || !assistantId) {
    return NextResponse.json(
      {
        error:
          "Outbound calling not configured. Set VAPI_PRIVATE_KEY + VAPI_PHONE_NUMBER_ID + NEXT_PUBLIC_VAPI_ASSISTANT_ID in .env.local. See docs/vapi-assistant-config.md §9d.",
      },
      { status: 501 },
    );
  }

  const body = DialBodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "invalid body", details: body.error.flatten() },
      { status: 400 },
    );
  }

  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      authorization: `Bearer ${privateKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: body.data.phoneNumber },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    // Vapi errors come back as JSON; surface them verbatim so the UI can show
    // the actual reason (e.g. "phoneNumber country not supported on free tier").
    let details: unknown;
    try {
      details = JSON.parse(text);
    } catch {
      details = text;
    }
    return NextResponse.json(
      { error: "vapi call failed", status: res.status, details },
      { status: 502 },
    );
  }

  let call: unknown = null;
  try {
    call = JSON.parse(text);
  } catch {
    call = { raw: text };
  }
  return NextResponse.json({ call });
}
