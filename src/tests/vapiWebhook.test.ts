import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/vapi/webhook/route";
import { getSession, resetSession } from "@/lib/agent/session";
import { writeJsonFile } from "@/lib/server/jsonStore";

/**
 * Exercises the single server-URL webhook that the Vapi assistant uses for
 * all tool invocations. We assert:
 *   - both the flat and nested tool-call shapes are accepted
 *   - the result field is always a SINGLE-LINE STRING per Vapi's spec
 *   - the envelope is { results: [{ toolCallId, result | error }] }
 *   - shared-secret auth is enforced when configured
 *   - the legacy `createApproval` / `getApprovalStatus` names still resolve
 *     onto the new funding tools
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

function firstResult(body: {
  results: ({ result?: string; error?: string } & { toolCallId: string })[];
}) {
  return body.results[0];
}

describe("POST /api/vapi/webhook", () => {
  beforeEach(() => {
    resetSession();
    writeJsonFile("mock-intents.json", { counter: 0, intents: {} });
    writeJsonFile(
      process.env.FUNDING_SIM_STORE_FILE ?? "funding-sessions.json",
      { counter: 0, sessions: {} },
    );
    delete process.env.VAPI_WEBHOOK_SECRET;
    process.env.PRICING_PROVIDER = "mock";
    process.env.FUNDING_PROVIDER = "simulator";
    process.env.FUNDING_SIM_STEP_MS = "0";
    // Drop cached providers so the next getProviders() rebuilds.
    delete (globalThis as unknown as { __vc_providers?: unknown })
      .__vc_providers;
    delete (globalThis as unknown as { __vc_simulatorConfig?: unknown })
      .__vc_simulatorConfig;
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
      req(flatCall("recommend", { amountFiat: 1000 }), {
        "x-vapi-secret": "secret-xyz",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("dispatches `recommend` — result is a SINGLE-LINE JSON string", async () => {
    const res = await POST(
      req(flatCall("recommend", { amountFiat: 1000, fiatCurrency: "EUR" })),
    );
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

  it("transcript payloads append to the session", async () => {
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
    expect(session.transcript[0].text).toBe("I have 1000 euros sitting idle.");
  });

  it("status-update to in-progress wipes a stale recommendation/transcript", async () => {
    await POST(req(flatCall("recommend", { amountFiat: 1000, fiatCurrency: "EUR" })));
    await POST(
      req({
        message: {
          type: "transcript",
          role: "user",
          transcriptType: "final",
          transcript: "old.",
        },
      }),
    );
    expect(getSession().recommendation).not.toBeNull();
    expect(getSession().transcript).toHaveLength(1);

    await POST(req({ message: { type: "status-update", status: "in-progress" } }));
    const fresh = getSession();
    expect(fresh.recommendation).toBeNull();
    expect(fresh.transcript).toHaveLength(0);
    expect(fresh.callStatus).toBe("in-progress");
  });

  it("recommend → startFunding → getFundingStatus is end-to-end callable", async () => {
    const recRes = await POST(
      req(flatCall("recommend", { amountFiat: 1000, fiatCurrency: "EUR" })),
    );
    const rec = (await recRes.json()) as { results: { result: string }[] };
    const { intentId } = JSON.parse(rec.results[0].result);

    const fundRes = await POST(
      req(flatCall("startFunding", { intentId }, "call_2")),
    );
    const fund = (await fundRes.json()) as { results: { result: string }[] };
    const { sessionId, status, checkoutUrl, simulated } = JSON.parse(
      fund.results[0].result,
    );
    expect(sessionId).toMatch(/^fund_sim_/);
    expect(status).toBe("awaiting_checkout");
    expect(checkoutUrl).toContain(`/checkout/${sessionId}`);
    expect(simulated).toBe(true);

    const statRes = await POST(
      req(flatCall("getFundingStatus", { sessionId }, "call_3")),
    );
    const stat = (await statRes.json()) as { results: { result: string }[] };
    expect(JSON.parse(stat.results[0].result).status).toBe("awaiting_checkout");
  });

  it("legacy createApproval / getApprovalStatus aliases route to the funding tools", async () => {
    const recRes = await POST(
      req(flatCall("recommend", { amountFiat: 500, fiatCurrency: "EUR" })),
    );
    const rec = (await recRes.json()) as { results: { result: string }[] };
    const { intentId } = JSON.parse(rec.results[0].result);

    const createRes = await POST(
      req(flatCall("createApproval", { intentId }, "call_2")),
    );
    const create = (await createRes.json()) as {
      results: { result: string }[];
    };
    const parsed = JSON.parse(create.results[0].result);
    expect(parsed.sessionId).toMatch(/^fund_sim_/);

    const statRes = await POST(
      req(
        flatCall(
          "getApprovalStatus",
          { approvalId: parsed.sessionId },
          "call_3",
        ),
      ),
    );
    const stat = (await statRes.json()) as { results: { result: string }[] };
    expect(JSON.parse(stat.results[0].result).status).toBe(
      "awaiting_checkout",
    );
  });
});
