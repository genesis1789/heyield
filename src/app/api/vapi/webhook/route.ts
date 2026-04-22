import { NextResponse } from "next/server";
import {
  CreateApprovalToolArgsSchema,
  EndCallToolArgsSchema,
  GetApprovalStatusToolArgsSchema,
  RecommendToolArgsSchema,
  VapiEndOfCallMessageSchema,
  VapiServerMessageSchema,
  VapiStatusUpdateMessageSchema,
  VapiToolCallsMessageSchema,
  VapiTranscriptMessageSchema,
} from "@/lib/schemas";
import {
  createApproval,
  endCall,
  getApprovalStatus,
  recommend,
} from "@/lib/agent/tools";
import {
  appendTranscript,
  replaceTranscript,
  setCallStatus,
} from "@/lib/agent/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/vapi/webhook
 *
 * Single server URL the Vapi assistant uses for every server message.
 * We handle `tool-calls` (dispatches to our 4 tool handlers), `transcript`
 * (feeds the dashboard transcript pane), `status-update` (tracks call
 * lifecycle for the dashboard), and `end-of-call-report` (marks the call
 * ended). All other types are acknowledged with 200 and ignored.
 *
 * Auth: when VAPI_WEBHOOK_SECRET is set, the request must carry an
 * `x-vapi-secret` header matching it.
 *
 * Docs: https://docs.vapi.ai/server-url/events
 */

type ToolResult =
  | { toolCallId: string; result: string }
  | { toolCallId: string; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseArguments(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

async function dispatchTool(toolName: string, args: unknown): Promise<unknown> {
  switch (toolName) {
    case "recommend":
      return recommend(RecommendToolArgsSchema.parse(args));
    case "createApproval":
      return createApproval(CreateApprovalToolArgsSchema.parse(args));
    case "getApprovalStatus":
      return getApprovalStatus(GetApprovalStatusToolArgsSchema.parse(args));
    case "endCall":
      return endCall(EndCallToolArgsSchema.parse(args));
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/** Vapi requires `result` to be a single-line string — strip newlines. */
function toToolResultString(value: unknown): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.replace(/\s*\r?\n\s*/g, " ").trim();
}

function normalizeTranscriptRole(raw: unknown): "user" | "assistant" | null {
  switch (raw) {
    case "user":
    case "caller":
    case "customer":
    case "human":
      return "user";
    case "assistant":
    case "agent":
    case "bot":
    case "model":
      return "assistant";
    default:
      return null;
  }
}

function normalizeTranscriptPartialFlag(raw: unknown): boolean {
  return raw === "partial" || raw === "interim";
}

function coerceTranscriptMessage(
  body: unknown,
): { role: "user" | "assistant"; transcript: string; partial: boolean } | null {
  const root = asRecord(body);
  const message = asRecord(root?.message);
  if (!message || message.type !== "transcript") return null;

  const transcriptRaw =
    typeof message.transcript === "string"
      ? message.transcript
      : typeof asRecord(message.transcript)?.text === "string"
        ? (asRecord(message.transcript)?.text as string)
        : typeof message.text === "string"
          ? message.text
          : null;
  const role =
    normalizeTranscriptRole(message.role) ??
    normalizeTranscriptRole(asRecord(message.transcript)?.role);

  if (!transcriptRaw || !role) return null;

  return {
    role,
    transcript: transcriptRaw,
    partial: normalizeTranscriptPartialFlag(
      message.transcriptType ?? asRecord(message.transcript)?.transcriptType,
    ),
  };
}

function coerceStatusUpdate(body: unknown): string | null {
  const root = asRecord(body);
  const message = asRecord(root?.message);
  return message && message.type === "status-update" && typeof message.status === "string"
    ? message.status
    : null;
}

function normalizeConversationRole(raw: unknown): "user" | "assistant" | null {
  switch (raw) {
    case "user":
    case "caller":
    case "customer":
    case "human":
      return "user";
    case "assistant":
    case "bot":
    case "agent":
    case "model":
      return "assistant";
    default:
      return null;
  }
}

function extractConversationEntries(
  rawEntries: unknown,
): { role: "user" | "assistant"; text: string; partial: boolean }[] {
  if (!Array.isArray(rawEntries)) return [];
  return rawEntries
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      const role = normalizeConversationRole(record.role);
      const text =
        typeof record.content === "string"
          ? record.content
          : typeof record.message === "string"
            ? record.message
            : null;
      if (!role || !text) return null;
      return { role, text, partial: false };
    })
    .filter((entry): entry is { role: "user" | "assistant"; text: string; partial: boolean } => entry !== null);
}

function handleConversationUpdate(body: unknown) {
  const root = asRecord(body);
  const message = asRecord(root?.message);
  if (!message || message.type !== "conversation-update") {
    return NextResponse.json({ received: true, ignored: "invalid conversation-update payload" });
  }
  const entries = extractConversationEntries(message.conversation ?? message.messages);
  if (entries.length === 0) {
    return NextResponse.json({ received: true, ignored: "empty conversation-update payload" });
  }
  replaceTranscript(entries);
  return NextResponse.json({ received: true });
}

function handleSpeechUpdate(body: unknown) {
  const root = asRecord(body);
  const message = asRecord(root?.message);
  const artifact = asRecord(message?.artifact);
  if (!message || message.type !== "speech-update" || !artifact) {
    return NextResponse.json({ received: true, ignored: "invalid speech-update payload" });
  }
  const entries = extractConversationEntries(artifact.messages);
  if (entries.length === 0) {
    return NextResponse.json({ received: true, ignored: "empty speech-update payload" });
  }
  replaceTranscript(entries);
  return NextResponse.json({ received: true });
}

async function handleToolCalls(body: unknown) {
  const parsed = VapiToolCallsMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid tool-calls payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const results: ToolResult[] = [];
  for (const call of parsed.data.message.toolCallList) {
    const name = call.name ?? call.function?.name;
    const argsRaw = call.arguments ?? call.function?.arguments;
    if (!name) {
      results.push({ toolCallId: call.id, error: "missing tool name" });
      continue;
    }
    try {
      const result = await dispatchTool(name, parseArguments(argsRaw));
      results.push({ toolCallId: call.id, result: toToolResultString(result) });
    } catch (err) {
      results.push({
        toolCallId: call.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results });
}

function handleTranscript(body: unknown) {
  const parsed = VapiTranscriptMessageSchema.safeParse(body);
  if (parsed.success) {
    const { role, transcript, transcriptType } = parsed.data.message;
    appendTranscript(role, transcript, transcriptType === "partial");
    return NextResponse.json({ received: true });
  }

  const fallback = coerceTranscriptMessage(body);
  if (!fallback) {
    // Do not fail the whole webhook on non-critical transcript variants.
    return NextResponse.json({ received: true, ignored: "invalid transcript payload" });
  }

  appendTranscript(fallback.role, fallback.transcript, fallback.partial);
  return NextResponse.json({ received: true, normalized: true });
}

function handleStatusUpdate(body: unknown) {
  const parsed = VapiStatusUpdateMessageSchema.safeParse(body);
  if (parsed.success) {
    setCallStatus(parsed.data.message.status);
    return NextResponse.json({ received: true });
  }

  const status = coerceStatusUpdate(body);
  if (!status) {
    return NextResponse.json({ received: true, ignored: "invalid status-update payload" });
  }

  setCallStatus(status);
  return NextResponse.json({ received: true, normalized: true });
}

function handleEndOfCall(body: unknown) {
  const parsed = VapiEndOfCallMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ received: true, ignored: "invalid end-of-call payload" });
  }
  setCallStatus("ended");
  return NextResponse.json({ received: true });
}

export async function POST(req: Request) {
  const expectedSecret = process.env.VAPI_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = req.headers.get("x-vapi-secret");
    if (got !== expectedSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => null);
  const envelope = VapiServerMessageSchema.safeParse(body);
  if (!envelope.success) {
    return NextResponse.json(
      { error: "invalid vapi payload", details: envelope.error.flatten() },
      { status: 400 },
    );
  }

  switch (envelope.data.message.type) {
    case "tool-calls":
      return handleToolCalls(body);
    case "transcript":
      return handleTranscript(body);
    case "status-update":
      return handleStatusUpdate(body);
    case "conversation-update":
      return handleConversationUpdate(body);
    case "speech-update":
      return handleSpeechUpdate(body);
    case "end-of-call-report":
      return handleEndOfCall(body);
    default:
      // Many other Vapi message types exist (conversation-update, speech-update,
      // user-interrupted, model-output, hang, …). We don't need them for the demo.
      return NextResponse.json({ received: true, ignored: envelope.data.message.type });
  }
}
