import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/vapi/webhook/route";
import { getSession, resetSession } from "@/lib/agent/session";

/**
 * Exercises the single server-URL webhook that the Vapi assistant uses for
 * all four tool invocations. We assert:
 *   - both the flat and nested tool-call shapes are accepted
 *   - the result field is always a SINGLE-LINE STRING per Vapi's spec
 *   - the envelope is { results: [{ toolCallId, result | error }] }
 *   - shared-secret auth is enforced when configured
 */

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/vapi/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function flatCall(name: string, args: Record<string, unknown>, id = "call_1") {
  return {
    message: {
      type: "tool-calls",
      toolCallList: [{ id, type: "function", name, arguments: args }],
    },
  };
}

function nestedCall(name: string, args: Record<string, unknown>, id = "call_1") {
  return {
    message: {
      type: "tool-calls",
      toolCallList: [
        {
          id,
          type: "function",
          function: { name, arguments: args },
        },
      ],
    },
  };
}

function firstResult(body: { results: ({ result?: string; error?: string } & { toolCallId: string })[] }) {
  return body.results[0];
}

describe("POST /api/vapi/webhook", () => {
  beforeEach(() => {
    resetSession();
    delete process.env.VAPI_WEBHOOK_SECRET;
    process.env.PRICING_PROVIDER = "mock";
  });
  afterEach(() => {
    resetSession();
    delete process.env.VAPI_WEBHOOK_SECRET;
  });

  it("rejects malformed bodies", async () => {
    const res = await POST(req({ nope: true }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when VAPI_WEBHOOK_SECRET is set and header is missing", async () => {
    process.env.VAPI_WEBHOOK_SECRET = "secret-xyz";
    const res = await POST(req(flatCall("recommend", { amountFiat: 1000 })));
    expect(res.status).toBe(401);
  });

  it("returns 200 when VAPI_WEBHOOK_SECRET matches", async () => {
    process.env.VAPI_WEBHOOK_SECRET = "secret-xyz";
    const res = await POST(
      req(flatCall("recommend", { amountFiat: 1000 }), { "x-vapi-secret": "secret-xyz" }),
    );
    expect(res.status).toBe(200);
  });

  it("dispatches `recommend` — result is a SINGLE-LINE JSON string", async () => {
    const res = await POST(req(flatCall("recommend", { amountFiat: 1000, fiatCurrency: "EUR" })));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { toolCallId: string; result: string }[];
    };
    expect(body.results).toHaveLength(1);
    const r = body.results[0];
    expect(r.toolCallId).toBe("call_1");
    expect(typeof r.result).toBe("string");
    expect(r.result).not.toContain("\n");
    const parsed = JSON.parse(r.result);
    expect(parsed.productName).toBe("Aave v3 USDC");
    expect(parsed.intentId).toMatch(/^intent_demo_/);
    expect(parsed.amountFiat).toBe(1000);
  });

  it("accepts the nested `function` shape for backward compatibility", async () => {
    const res = await POST(
      req(nestedCall("recommend", { amountFiat: 500, fiatCurrency: "EUR" })),
    );
    const body = (await res.json()) as { results: { result: string }[] };
    const parsed = JSON.parse(body.results[0].result);
    expect(parsed.amountFiat).toBe(500);
  });

  it("accepts arguments as a JSON string", async () => {
    const envelope = {
      message: {
        type: "tool-calls",
        toolCallList: [
          {
            id: "call_str",
            type: "function",
            name: "recommend",
            arguments: JSON.stringify({ amountFiat: 500, fiatCurrency: "EUR" }),
          },
        ],
      },
    };
    const res = await POST(req(envelope));
    const body = (await res.json()) as { results: { result: string }[] };
    expect(JSON.parse(body.results[0].result).amountFiat).toBe(500);
  });

  it("rejects invalid args with a per-call error (string) — HTTP stays 200", async () => {
    const res = await POST(req(flatCall("recommend", { amountFiat: -1 })));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { toolCallId: string; error?: string; result?: string }[];
    };
    expect(firstResult(body).error).toBeDefined();
  });

  it("unknown tool names surface as per-call errors, not 500s", async () => {
    const res = await POST(req(flatCall("somethingWrong", {})));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { toolCallId: string; error?: string; result?: string }[];
    };
    expect(firstResult(body).error).toBeDefined();
  });

  it("acknowledges a transcript message and appends to session", async () => {
    const res = await POST(
      req({
        message: {
          type: "transcript",
          role: "user",
          transcriptType: "final",
          transcript: "I have 1000 euros sitting idle.",
        },
      }),
    );
    expect(res.status).toBe(200);
    const session = getSession();
    expect(session.transcript).toHaveLength(1);
    expect(session.transcript[0].role).toBe("user");
    expect(session.transcript[0].partial).toBe(false);
    expect(session.transcript[0].text).toBe("I have 1000 euros sitting idle.");
  });

  it("normalizes transcript role aliases and nested transcript text", async () => {
    const res = await POST(
      req({
        message: {
          type: "transcript",
          role: "bot",
          transcriptType: "interim",
          transcript: { text: "Let me check that for you." },
        },
      }),
    );
    expect(res.status).toBe(200);
    const session = getSession();
    expect(session.transcript).toHaveLength(1);
    expect(session.transcript[0].role).toBe("assistant");
    expect(session.transcript[0].partial).toBe(true);
    expect(session.transcript[0].text).toBe("Let me check that for you.");
  });

  it("collapses partial transcripts for the same speaker into one entry", async () => {
    for (const t of [
      { transcriptType: "partial", transcript: "I have" },
      { transcriptType: "partial", transcript: "I have 1000" },
      { transcriptType: "final", transcript: "I have 1000 euros." },
    ] as const) {
      await POST(
        req({
          message: { type: "transcript", role: "user", transcriptType: t.transcriptType, transcript: t.transcript },
        }),
      );
    }
    const session = getSession();
    expect(session.transcript).toHaveLength(1);
    expect(session.transcript[0].text).toBe("I have 1000 euros.");
    expect(session.transcript[0].partial).toBe(false);
  });

  it("status-update transitions drive session.callStatus", async () => {
    await POST(req({ message: { type: "status-update", status: "ringing" } }));
    expect(getSession().callStatus).toBe("ringing");

    await POST(req({ message: { type: "status-update", status: "in-progress" } }));
    expect(getSession().callStatus).toBe("in-progress");

    await POST(req({ message: { type: "status-update", status: "ended" } }));
    expect(getSession().callStatus).toBe("ended");
  });

  it("conversation-update rebuilds the transcript from assistant and user turns", async () => {
    const res = await POST(
      req({
        message: {
          type: "conversation-update",
          conversation: [
            { role: "system", content: "ignore this" },
            { role: "assistant", content: "Hi, what would you like to do?" },
            { role: "user", content: "I have 1000 euros." },
            { role: "tool", content: "{\"ignored\":true}" },
            { role: "assistant", content: "I can help with that." },
          ],
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(getSession().transcript).toMatchObject([
      { role: "assistant", text: "Hi, what would you like to do?" },
      { role: "user", text: "I have 1000 euros." },
      { role: "assistant", text: "I can help with that." },
    ]);
  });

  it("speech-update rebuilds the transcript from artifact messages", async () => {
    const res = await POST(
      req({
        message: {
          type: "speech-update",
          status: "stopped",
          role: "assistant",
          artifact: {
            messages: [
              { role: "bot", message: "Hello there." },
              { role: "user", message: "I want better yield." },
            ],
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(getSession().transcript).toMatchObject([
      { role: "assistant", text: "Hello there." },
      { role: "user", text: "I want better yield." },
    ]);
  });

  it("accepts newly introduced status strings without 400ing", async () => {
    const res = await POST(req({ message: { type: "status-update", status: "answered" } }));
    expect(res.status).toBe(200);
    expect(getSession().callStatus).toBe("answered");
  });

  it("status-update to in-progress wipes a stale recommendation/transcript", async () => {
    // Prime session with a recommendation + transcript from a prior call.
    await POST(req(flatCall("recommend", { amountFiat: 1000, fiatCurrency: "EUR" })));
    await POST(
      req({
        message: { type: "transcript", role: "user", transcriptType: "final", transcript: "old." },
      }),
    );
    expect(getSession().recommendation).not.toBeNull();
    expect(getSession().transcript).toHaveLength(1);

    // New call starts.
    await POST(req({ message: { type: "status-update", status: "in-progress" } }));
    const fresh = getSession();
    expect(fresh.recommendation).toBeNull();
    expect(fresh.transcript).toHaveLength(0);
    expect(fresh.callStatus).toBe("in-progress");
  });

  it("end-of-call-report marks the call ended", async () => {
    await POST(req({ message: { type: "status-update", status: "in-progress" } }));
    await POST(
      req({ message: { type: "end-of-call-report", endedReason: "hangup", artifact: {} } }),
    );
    expect(getSession().callStatus).toBe("ended");
  });

  it("ignores malformed transcript payloads instead of failing the webhook", async () => {
    const res = await POST(req({ message: { type: "transcript", transcript: 123 } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ignored?: string; received?: boolean };
    expect(body.received).toBe(true);
    expect(body.ignored).toBe("invalid transcript payload");
    expect(getSession().transcript).toHaveLength(0);
  });

  it("unknown message types are acknowledged with 200 and no side-effects", async () => {
    const before = getSession().updatedAt;
    const res = await POST(req({ message: { type: "totally-new-event", foo: "bar" } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ignored?: string; received?: boolean };
    expect(body.ignored).toBe("totally-new-event");
    expect(getSession().updatedAt).toBe(before);
  });

  it("recommend → createApproval → getApprovalStatus is end-to-end callable", async () => {
    const recRes = await POST(
      req(flatCall("recommend", { amountFiat: 1000, fiatCurrency: "EUR" })),
    );
    const rec = (await recRes.json()) as { results: { result: string }[] };
    const { intentId } = JSON.parse(rec.results[0].result);

    const apvRes = await POST(req(flatCall("createApproval", { intentId }, "call_2")));
    const apv = (await apvRes.json()) as { results: { result: string }[] };
    const { approvalId, status } = JSON.parse(apv.results[0].result);
    expect(status).toBe("pending");

    const statRes = await POST(
      req(flatCall("getApprovalStatus", { approvalId }, "call_3")),
    );
    const stat = (await statRes.json()) as { results: { result: string }[] };
    expect(JSON.parse(stat.results[0].result).status).toBe("pending");
  });
});
