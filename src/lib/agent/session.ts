import type {
  FundingProviderKind,
  FundingStatus,
} from "@/lib/providers/funding/types";
import type { FiatCurrency } from "@/lib/providers/types";
import type { VapiCallStatus } from "@/lib/schemas";
import type { RecommendOutput } from "./tools";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonStore";

/**
 * Server-side "latest call state".
 *
 * Tool calls AND transcript + status-update messages from Vapi all land here
 * via /api/vapi/webhook. The dashboard polls GET /api/agent/session to render
 * transcript, product card, funding handoff, investment timeline — works
 * identically for web and phone calls.
 *
 * File-backed because Next dev can serve route handlers from different
 * contexts; webhook writes must be visible to the dashboard poll and the
 * `/checkout/[id]` advance route immediately.
 */

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  partial: boolean;
  at: number;
}

export type CallStatus = "idle" | VapiCallStatus;

export interface SessionFundingState {
  sessionId: string;
  intentId: string;
  status: FundingStatus;
  mode: FundingProviderKind;
  simulated: boolean;
  checkoutUrl: string;
  amountFiat: number;
  fiatCurrency: FiatCurrency;
  productName: string;
  protocolLabel: string;
  destWalletAddress?: string;
  txHash?: string;
  txExplorerUrl?: string;
  errorMessage?: string;
}

export interface AgentSession {
  recommendation: RecommendOutput | null;
  funding: SessionFundingState | null;
  transcript: TranscriptEntry[];
  callStatus: CallStatus;
  /** Monotonic epoch ms — bumped on every write so clients can detect changes. */
  updatedAt: number;
}

export interface SessionTranscriptInput {
  role: "user" | "assistant";
  text: string;
  partial: boolean;
}

const SESSION_FILE = "agent-session.json";
const COUNTER_FILE = "agent-session-counter.json";

const EMPTY_SESSION: AgentSession = {
  recommendation: null,
  funding: null,
  transcript: [],
  callStatus: "idle",
  updatedAt: 0,
};

function store(): AgentSession {
  return readJsonFile(SESSION_FILE, EMPTY_SESSION);
}

function nextCounter(): number {
  const counter = readJsonFile(COUNTER_FILE, { value: 0 });
  const next = counter.value + 1;
  writeJsonFile(COUNTER_FILE, { value: next });
  return next;
}

function save(s: AgentSession) {
  writeJsonFile(SESSION_FILE, s);
}

function touch(s: AgentSession) {
  s.updatedAt = Date.now();
  save(s);
}

export function setRecommendation(rec: RecommendOutput): void {
  const s = store();
  s.recommendation = rec;
  touch(s);
}

export function setFunding(funding: SessionFundingState): void {
  const s = store();
  s.funding = funding;
  touch(s);
}

export function appendTranscript(
  role: "user" | "assistant",
  text: string,
  partial: boolean,
): void {
  const s = store();
  const trimmed = text.trim();
  if (!trimmed) return;

  const last = s.transcript[s.transcript.length - 1];
  if (last && last.role === role && last.partial) {
    last.text = trimmed;
    last.partial = partial;
    last.at = Date.now();
  } else {
    s.transcript.push({
      id: `${role}-${nextCounter()}`,
      role,
      text: trimmed,
      partial,
      at: Date.now(),
    });
  }
  touch(s);
}

export function replaceTranscript(entries: SessionTranscriptInput[]): void {
  const s = store();
  s.transcript = entries
    .map((entry) => ({
      id: `${entry.role}-${nextCounter()}`,
      role: entry.role,
      text: entry.text.trim(),
      partial: entry.partial,
      at: Date.now(),
    }))
    .filter((entry) => entry.text.length > 0);
  touch(s);
}

/**
 * Update call status. If the call is transitioning from a non-in-progress
 * state into `in-progress`, wipe the session first — a fresh call shouldn't
 * see stale transcript / recommendation / funding session from the previous
 * one.
 */
export function setCallStatus(status: CallStatus): void {
  const s = store();
  if (status === "in-progress" && s.callStatus !== "in-progress") {
    s.recommendation = null;
    s.funding = null;
    s.transcript = [];
  }
  s.callStatus = status;
  touch(s);
}

export function getSession(): AgentSession {
  return store();
}

export function resetSession(): void {
  writeJsonFile(SESSION_FILE, EMPTY_SESSION);
  writeJsonFile(COUNTER_FILE, { value: 0 });
}
