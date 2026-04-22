import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/dial/route";

const originalFetch = globalThis.fetch;

function req(body: unknown) {
  return new Request("http://localhost/api/agent/dial", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/dial (outbound Vapi call)", () => {
  beforeEach(() => {
    delete process.env.VAPI_PRIVATE_KEY;
    delete process.env.VAPI_PHONE_NUMBER_ID;
    delete process.env.VAPI_ASSISTANT_ID;
    delete process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 501 when outbound env vars are missing", async () => {
    const res = await POST(req({ phoneNumber: "+14155551234" }));
    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/VAPI_PRIVATE_KEY/);
  });

  it("rejects malformed phone numbers with 400", async () => {
    process.env.VAPI_PRIVATE_KEY = "sk-test";
    process.env.VAPI_PHONE_NUMBER_ID = "pn-test";
    process.env.VAPI_ASSISTANT_ID = "asst-test";
    const res = await POST(req({ phoneNumber: "4155551234" })); // no leading +
    expect(res.status).toBe(400);
  });

  it("POSTs to https://api.vapi.ai/call with the documented body shape", async () => {
    process.env.VAPI_PRIVATE_KEY = "sk-test";
    process.env.VAPI_PHONE_NUMBER_ID = "pn-xyz";
    process.env.VAPI_ASSISTANT_ID = "asst-abc";

    const spy = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ id: "call_123" }), { status: 201 }),
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    const res = await POST(req({ phoneNumber: "+14155551234" }));
    expect(res.status).toBe(200);

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://api.vapi.ai/call");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-test");
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toEqual({
      assistantId: "asst-abc",
      phoneNumberId: "pn-xyz",
      customer: { number: "+14155551234" },
    });

    const body = (await res.json()) as { call: { id: string } };
    expect(body.call.id).toBe("call_123");
  });

  it("surfaces Vapi error responses as 502 with the original details", async () => {
    process.env.VAPI_PRIVATE_KEY = "sk-test";
    process.env.VAPI_PHONE_NUMBER_ID = "pn-xyz";
    process.env.VAPI_ASSISTANT_ID = "asst-abc";

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "country not supported" }), {
        status: 400,
      })) as unknown as typeof fetch;

    const res = await POST(req({ phoneNumber: "+14155551234" }));
    expect(res.status).toBe(502);
    const body = (await res.json()) as {
      error: string;
      details: { message: string };
    };
    expect(body.error).toMatch(/vapi/);
    expect(body.details.message).toBe("country not supported");
  });

  it("falls back to NEXT_PUBLIC_VAPI_ASSISTANT_ID when VAPI_ASSISTANT_ID is unset", async () => {
    process.env.VAPI_PRIVATE_KEY = "sk-test";
    process.env.VAPI_PHONE_NUMBER_ID = "pn-xyz";
    process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID = "asst-public";

    const spy = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ id: "x" }), { status: 201 }),
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    await POST(req({ phoneNumber: "+14155551234" }));
    const [, init] = spy.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(sent.assistantId).toBe("asst-public");
  });
});
