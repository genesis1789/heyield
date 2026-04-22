import { z } from "zod";

export const GoalSchema = z.enum(["yield", "unknown"]);
export type Goal = z.infer<typeof GoalSchema>;

export const RiskPreferenceSchema = z.enum([
  "conservative",
  "moderate",
  "aggressive",
  "unspecified",
]);
export type RiskPreference = z.infer<typeof RiskPreferenceSchema>;

export const EarnOpportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  chain: z.string(),
  asset: z.literal("USDC"),
  apyBps: z.number().int().nonnegative(),
  feesBps: z.number().int().nonnegative(),
  depositToken: z.string(),
  riskSentence: z.string(),
  riskBand: RiskPreferenceSchema,
});

// ─── Vapi tool-call webhook schemas ────────────────────────────────────────

/**
 * A single tool invocation the Vapi server forwards to us.
 *
 * The documented current shape (per https://docs.vapi.ai/tools/custom-tools
 * "Request Format") is FLATTENED — { id, name, arguments } at the top level.
 * Vapi also echoes a redundant nested `function: { name, arguments }` in
 * `toolWithToolCallList[].toolCall`, so we accept either form for resilience.
 * Arguments usually arrive as a parsed JSON object; we also accept strings.
 */
export const VapiToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function").optional(),
  name: z.string().optional(),
  arguments: z.union([z.record(z.unknown()), z.string()]).optional(),
  function: z
    .object({
      name: z.string(),
      arguments: z.union([z.record(z.unknown()), z.string()]),
    })
    .optional(),
});

export const VapiToolCallsMessageSchema = z.object({
  message: z
    .object({
      type: z.literal("tool-calls"),
      toolCallList: z.array(VapiToolCallSchema),
    })
    .passthrough(),
});

/**
 * Broader Vapi server-message schema — we accept many types over the same
 * /api/vapi/webhook URL (Vapi uses one server URL for everything).
 *
 * Documented types we handle:
 *   - tool-calls (handled above — drives our 4 tool dispatchers)
 *   - transcript (live transcription lines, both user + assistant)
 *   - status-update (call lifecycle: queued/ringing/in-progress/ended/…)
 *   - end-of-call-report (final artifact after hangup)
 *
 * Every other message type returns 200 with no side-effect.
 */

export const VapiTranscriptMessageSchema = z.object({
  message: z
    .object({
      type: z.literal("transcript"),
      role: z.enum(["user", "assistant"]),
      transcriptType: z.enum(["partial", "final"]),
      transcript: z.string(),
    })
    .passthrough(),
});

/**
 * Vapi occasionally adds lifecycle statuses without much ceremony. We keep the
 * parser open so the webhook doesn't start 400'ing on new status strings.
 */
export const VapiCallStatusSchema = z.string().min(1);
export type VapiCallStatus = z.infer<typeof VapiCallStatusSchema>;

export const VapiStatusUpdateMessageSchema = z.object({
  message: z
    .object({
      type: z.literal("status-update"),
      status: VapiCallStatusSchema,
      call: z.record(z.unknown()).optional(),
    })
    .passthrough(),
});

export const VapiEndOfCallMessageSchema = z.object({
  message: z
    .object({
      type: z.literal("end-of-call-report"),
      endedReason: z.string().optional(),
    })
    .passthrough(),
});

/** Any message at all — we at least validate the envelope. */
export const VapiServerMessageSchema = z.object({
  message: z.object({ type: z.string() }).passthrough(),
});

export const RecommendToolArgsSchema = z.object({
  amountFiat: z.number().positive(),
  fiatCurrency: z.enum(["EUR", "USD"]).default("EUR"),
  goal: GoalSchema.optional(),
});
export type RecommendToolArgs = z.infer<typeof RecommendToolArgsSchema>;

export const CreateApprovalToolArgsSchema = z.object({
  intentId: z.string().min(1),
});
export type CreateApprovalToolArgs = z.infer<typeof CreateApprovalToolArgsSchema>;

export const GetApprovalStatusToolArgsSchema = z.object({
  approvalId: z.string().min(1),
});
export type GetApprovalStatusToolArgs = z.infer<typeof GetApprovalStatusToolArgsSchema>;

export const EndCallToolArgsSchema = z.object({
  reason: z.string().optional(),
});
export type EndCallToolArgs = z.infer<typeof EndCallToolArgsSchema>;

// ─── Dashboard REST schemas ────────────────────────────────────────────────

export const ApprovalTapBodySchema = z.object({
  decision: z.enum(["approve", "decline"]),
});
export type ApprovalTapBody = z.infer<typeof ApprovalTapBodySchema>;

/**
 * E.164 phone number validation — leading "+" then 8–15 digits. Matches what
 * Vapi's `customer.number` expects.
 */
export const E164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, {
    message: "Phone must be E.164 format, e.g. +14155551234",
  });

export const DialBodySchema = z.object({
  phoneNumber: E164PhoneSchema,
});
export type DialBody = z.infer<typeof DialBodySchema>;
