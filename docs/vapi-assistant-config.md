# Vapi assistant setup — step-by-step

The voice concierge's conversation logic runs on Vapi (dashboard-side). This repo hosts the four tool endpoints the assistant calls. This doc is the exact sequence of dashboard clicks and paste-in snippets to reproduce a working demo.

All shapes below are verified against Vapi's docs (April 2026). Citations are linked inline — please check the actual page if something looks off, the Vapi docs move occasionally.

## 0. What we're wiring up

- A **stored assistant** on Vapi (dashboard-managed) with a concierge system prompt.
- Four **Custom Function Tools** attached to that assistant, all pointing at a single server URL — our `/api/vapi/webhook`.
- A **shared secret** (legacy `x-vapi-secret` header) so the webhook rejects unauthenticated calls. [Optionally: migrate to the modern Custom Credential system later — see §8.]
- The browser app loads the Vapi Web SDK (`@vapi-ai/web`) and calls `new Vapi(publicKey).start(assistantId)` on **Start call**.

Architecture:

```
 Browser ── Vapi.start(assistantId) ──▶ Vapi hosts the call (WebRTC via Daily.co)
                                               │
                                    LLM decides to call a tool
                                               │
                                               ▼
                            POST https://<your-host>/api/vapi/webhook
                            headers: x-vapi-secret: <your shared secret>
                            body:    { message: { type: "tool-calls", toolCallList: [...] } }
                                               │
                                               ▼
                            200 OK  { results: [{ toolCallId, result: "<single-line JSON>" }] }
                                               │
                                    LLM reads `result`, speaks a reply
```

## 1. Create a Vapi account + collect keys

1. Sign up at <https://vapi.ai>. Free tier is enough for a demo.
2. In the dashboard, **top-right profile menu → Vapi API Keys**.
   - Copy **Public API Key**. This is the org-scoped browser-safe key. Goes into `NEXT_PUBLIC_VAPI_PUBLIC_KEY` in `.env.local`. ([docs: Voice Widget quickstart — "Copy your Public API Key. This is safe to use in client-side code."](https://docs.vapi.ai/assistants/examples/voice-widget))
   - Copy **Private API Key** for your records (you won't strictly need it for this integration, but keep it handy). **Never ship it in the browser bundle.** ([docs: Chat quickstart — "Keep this key secure - never expose it in client-side code."](https://docs.vapi.ai/chat/quickstart))

> **Security note.** Vapi's public keys are org-wide and not per-assistant. Anyone who grabs yours can start calls against your org. For a hackathon that's fine — rotate after the demo.

## 2. Expose the webhook publicly

Vapi has to reach `/api/vapi/webhook` from its servers. For local dev, use a tunnel:

```bash
# In one terminal
npm run dev

# In another
npx ngrok http 3000
```

Copy the `https://<slug>.ngrok.app` URL. The full webhook URL you'll paste into Vapi is:

```
https://<slug>.ngrok.app/api/vapi/webhook
```

Every time you restart ngrok, the slug changes — update the assistant's server URL in the Vapi dashboard to match. For deployments, use your real public origin (no tunnel needed).

## 3. Populate `.env.local`

```bash
# client
NEXT_PUBLIC_TELEPHONY_PROVIDER=vapi
NEXT_PUBLIC_VAPI_PUBLIC_KEY=<paste-from-step-1>
NEXT_PUBLIC_VAPI_ASSISTANT_ID=          # we fill this in step 5

# server (shared secret for the webhook)
VAPI_WEBHOOK_SECRET=<pick any random string, e.g. `openssl rand -hex 16`>
```

Restart `npm run dev` after editing.

## 4. Create the assistant

1. Dashboard → **Assistants** (left sidebar) → **Create Assistant** → pick the **Blank Template**. Name it something like `voice-earn-concierge`.
2. **Model panel** → Provider: OpenAI or Anthropic, model: `gpt-4o-mini` or `claude-3-5-haiku`. Any model that reliably does function-calling works.
3. Paste the **System prompt** below into the "System Message" / "Prompt" field:

   ```
   You are the Voice Earn Concierge, a concise assistant that helps callers put idle cash to work.

   Rules:
   - Greet the caller in one short sentence and ask what they'd like to do with their idle cash.
   - Once you have an amount and currency, call the `recommend` tool with { amountFiat, fiatCurrency }. fiatCurrency defaults to "EUR".
   - When `recommend` returns, explain the product in under 30 seconds: name, APY, estimated annual return for the caller's amount, fees, ONE short risk sentence. End with a confirmation question like "Do you want to go ahead with <amount> into <productName>?"
   - If the caller says yes, call `createApproval` with { intentId } from the previous recommend result. Then tell them: "Sending a confirmation request to your Revolut app — please approve on your phone."
   - After `createApproval`, call `getApprovalStatus({ approvalId })` every 2–3 seconds until status is "approved" or "declined". Stay quiet between polls unless more than 6 seconds pass without resolution — then reassure the caller.
   - When status is "approved", say: "Your request has been confirmed." then call `endCall` with reason="approved".
   - When status is "declined", say: "The request was declined. Let me know if you'd like to try again." then call `endCall` with reason="declined".
   - Never invent numbers. Never recommend a second product. Never hedge into general financial advice. Never read the JSON aloud.
   ```

4. **First message**: leave default or set to a short greeting like `"Hi, I'm your Earn Concierge. What would you like to do with your idle cash?"`.
5. **Transcriber**: Deepgram Nova 2 (default) is fine.
6. **Voice**: any ElevenLabs voice.
7. **Advanced → End Call Function**: enable, so the agent can cleanly terminate.
8. **Advanced → Call settings**: defaults are fine (`maxDurationSeconds` = 600, i.e. 10 minutes). ([docs: llms-full.txt — "maxDurationSeconds… @default 600 (10 minutes)"](https://docs.vapi.ai/llms-full.txt))
9. **Server URL (the one all tools inherit)**: find the assistant's **Server URL** / **Advanced → Server** section.
   - `Server URL` = `https://<your-ngrok-slug>.ngrok.app/api/vapi/webhook`
   - `Server URL Secret` = the `VAPI_WEBHOOK_SECRET` you picked. Vapi will forward this as header `x-vapi-secret` on every tool call. ([docs: server authentication — "Legacy X-Vapi-Secret Support"](https://docs.vapi.ai/server-url/server-authentication))

   If your dashboard shows only the new **Custom Credentials** flow (no inline secret field): skip to §8 and create a Bearer Token credential instead — the same secret ends up in the same `x-vapi-secret` header.

Don't **Save** yet — tools first.

## 5. Create the four Custom Function Tools

Tools live under **Tools** in the left sidebar, then get attached to assistants. You create them once; one tool, one JSON Schema, one purpose.

For **each** of the four tools below:

1. Dashboard → **Tools** → **Create Tool**.
2. **Tool Type: Function**. ([docs: Custom Tools — "Tool Type: Select 'Function' for custom API integrations."](https://docs.vapi.ai/tools/custom-tools))
3. Set **Name**, **Description**, **Parameters** (JSON Schema) per the tables below.
4. **Async behaviour**: leave `async` **off (= false)** for the first three tools. Vapi will wait for the webhook response before letting the LLM continue. Set `async = true` for `endCall` only (we don't need the acknowledgement to drive the conversation). ([docs: troubleshooting — "Sync tools (recommended) — 'async': false (default) — Wait for webhook response before resolving."](https://docs.vapi.ai/tools/custom-tools-troubleshooting))
5. **Server URL**: **leave blank**. Tools inherit from `assistant.server.url`, and the priority is `function → assistant → phoneNumber → org`. ([docs: setting server URLs — URL priority](https://docs.vapi.ai/server-url/setting-server-urls))
6. Save.

### Tool 1 — `recommend`

| Field | Value |
| --- | --- |
| Name | `recommend` |
| Description | `Look up the single curated Earn opportunity for the caller's cash amount and pre-register an intent for the follow-up approval step. Returns product name, APY, estimated annual return for the caller's amount, fees, a short risk sentence, a live LI.FI network-cost estimate, and the intentId to feed into createApproval.` |
| Async | off |

Parameters (paste as JSON):

```json
{
  "type": "object",
  "properties": {
    "amountFiat": {
      "type": "number",
      "description": "The cash amount the caller wants to deploy. Must be positive."
    },
    "fiatCurrency": {
      "type": "string",
      "enum": ["EUR", "USD"],
      "description": "Caller's currency. Defaults to EUR."
    },
    "goal": {
      "type": "string",
      "enum": ["yield", "unknown"],
      "description": "Caller's stated goal. Optional."
    }
  },
  "required": ["amountFiat"]
}
```

### Tool 2 — `createApproval`

| Field | Value |
| --- | --- |
| Name | `createApproval` |
| Description | `Trigger a Revolut push notification to the caller's phone once they have verbally agreed. Call this immediately after the caller says yes.` |
| Async | off |

Parameters:

```json
{
  "type": "object",
  "properties": {
    "intentId": {
      "type": "string",
      "description": "The intentId returned by the recommend tool in the same call."
    }
  },
  "required": ["intentId"]
}
```

### Tool 3 — `getApprovalStatus`

| Field | Value |
| --- | --- |
| Name | `getApprovalStatus` |
| Description | `Poll the approval record for its current state. Call every 2–3 seconds after createApproval until status is "approved" or "declined".` |
| Async | off |

Parameters:

```json
{
  "type": "object",
  "properties": {
    "approvalId": {
      "type": "string",
      "description": "The approvalId returned by createApproval."
    }
  },
  "required": ["approvalId"]
}
```

### Tool 4 — `endCall`

| Field | Value |
| --- | --- |
| Name | `endCall` |
| Description | `Signal that the conversation has reached its natural end. Use after a confirmation or decline.` |
| Async | on (fire-and-forget) |

Parameters:

```json
{
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "description": "Short reason, e.g. \"approved\", \"declined\", \"user-aborted\"."
    }
  }
}
```

## 6. Attach the tools to the assistant

1. Back in **Assistants → voice-earn-concierge**.
2. Tools tab → **Add Tool** → pick each of the four you just made.
3. **Save** the assistant.
4. Copy the assistant ID (shown at the top of the page or in the URL — format `asst_xxx` or UUID). Paste it into `.env.local`:

   ```
   NEXT_PUBLIC_VAPI_ASSISTANT_ID=<your assistant id>
   ```

5. Restart `npm run dev` so the browser picks up the new env.

## 7. Smoke-test the flow

1. Open `http://localhost:3000/simulator`. The **Voice channel** card should say "Powered by Vapi" (not "preview mode").
2. Click **Start call** — browser will ask for mic permission.
3. Say: *"I have 1000 euros sitting idle and want a better yield."*
4. Agent should explain Aave v3 USDC and ask for confirmation.
5. Say: *"Yes."*
6. Dashboard shows the **Revolut push** card. Tap **Approve**.
7. Agent should say *"Your request has been confirmed."* within ~2–3 seconds.
8. Timeline settles on Completed.

### If something breaks

- **500 "Unknown tool" / 401 on the webhook** — check ngrok still runs, URL matches, secret matches. Tail `npm run dev` logs for the POST.
- **Agent never calls a tool** — check the tool is attached to the assistant (step 6) and the system prompt names it correctly.
- **Call ends with `customer-did-not-give-microphone-permission`** — browser mic permission was denied; re-enable in the address-bar padlock. ([docs: call ended reasons](https://docs.vapi.ai/calls/call-ended-reason))
- **Call ends with `silence-timed-out`** — raise `silenceTimeoutSeconds` on the assistant (default 30s). ([docs: llms-full.txt, silenceTimeoutSeconds](https://docs.vapi.ai/llms-full.txt))
- **Tool returned an object but the LLM speaks gibberish** — Vapi requires `result` to be a **single-line string**. Our webhook already stringifies; don't revert it. ([docs: custom-tools-troubleshooting, Critical response rules](https://docs.vapi.ai/tools/custom-tools-troubleshooting))

## 8. (Optional) Upgrade the auth to Custom Credentials

Vapi is moving all server-URL auth into a reusable **Custom Credential** objects referenced by `credentialId`. The inline `x-vapi-secret` header this doc configures is the legacy path; both still work. If you want the modern flow:

1. Dashboard → **Org settings → Custom Credentials** → **Create Credential**.
2. Type: **Bearer Token**.
3. **Header Name**: `X-Vapi-Secret`.
4. **Include Bearer Prefix**: off.
5. **Token**: the same secret you used in `VAPI_WEBHOOK_SECRET`.
6. Save, copy the `cred_...` id.
7. Back in the assistant's **Advanced → Server** panel, clear the inline "Server URL Secret" field and set `Server Credential` to your new credential id.

Our webhook handler doesn't care which path you use — it just reads the `x-vapi-secret` header. ([docs: server authentication](https://docs.vapi.ai/server-url/server-authentication))

## 9. (Optional) Wire up a real phone number

Vapi web calls are great for a laptop demo. To demo **"dial this number from your phone and the concierge picks up"**, hook an existing Vapi-managed phone number to the same assistant — nothing new to code, the server URL you already set covers it. ([docs: Phone quickstart](https://docs.vapi.ai/quickstart/phone))

### 9a. Assign the phone number to the assistant

1. Dashboard → **Phone Numbers** (left sidebar) → click the number you want to use.
2. Find **Inbound Settings** → **Assistant** (or **Inbound Assistant**) dropdown → pick **voice-earn-concierge**.
3. Save. From this point on, anyone who dials that number reaches the concierge.

The assistant's `Server URL` (set in §4 step 9) is reused for phone calls automatically — transcript, status-update, tool-calls, and end-of-call-report all flow to the same `/api/vapi/webhook`.

### 9b. Show the number on the dashboard

Add this to `.env.local` (client-side, safe to ship):

```
NEXT_PUBLIC_VAPI_PHONE_NUMBER=+1-415-555-1234   # exactly as you want it rendered
```

Restart `npm run dev`. The **Voice channel** card now shows an "Or dial from your phone" row with a `tel:` link that mobile users can tap.

### 9c. What the dashboard sees during a phone call

Identical to a web call:

- Your transcript and the agent's replies stream into the **Transcript** pane as they happen.
- When the agent calls `recommend`, the **Recommendation** card renders.
- When the agent calls `createApproval`, the **Revolut push** appears — tap Approve on your laptop while still on the phone.
- Timeline settles on Completed; status badge shows the end state.

This works because the server-side session ([`src/lib/agent/session.ts`](src/lib/agent/session.ts)) is the single source of truth. Web and phone calls both drive it through the same webhook; the dashboard polls every 750 ms and renders whatever's there.

### 9d. Outbound calls — "Call me" from the dashboard

Ship a phone number input and a button: user types their number, clicks **Call me**, Vapi rings their phone with the concierge already on the line. Already wired in [`src/components/CallControl.tsx`](../src/components/CallControl.tsx) + [`src/app/api/agent/dial/route.ts`](../src/app/api/agent/dial/route.ts). To turn it on:

1. **Get your Private API Key**. Dashboard → profile → **Vapi API Keys** → **Private API Key**. This is server-side only — never put it in a `NEXT_PUBLIC_*` var. ([docs: Chat quickstart — "Keep this key secure"](https://docs.vapi.ai/chat/quickstart))
2. **Get your `phoneNumberId`**. Dashboard → **Phone Numbers** → click your number → copy its id (shown near the top of the detail panel, format `pn_...` or UUID). This is **different** from the phone number itself — it's the Vapi resource id.
3. Add to `.env.local`:

   ```
   VAPI_PRIVATE_KEY=<your private key>
   VAPI_PHONE_NUMBER_ID=<the phoneNumberId from step 2>
   # VAPI_ASSISTANT_ID is optional — falls back to NEXT_PUBLIC_VAPI_ASSISTANT_ID
   ```

4. Restart `npm run dev`. A new card appears in **Voice channel**: "Or ask the concierge to call you" with a phone input + **Call me** button.
5. Click Call me. Our server POSTs to:

   ```
   POST https://api.vapi.ai/call
   Authorization: Bearer <VAPI_PRIVATE_KEY>
   { "assistantId": "...", "phoneNumberId": "...", "customer": { "number": "+14155551234" } }
   ```

   ([docs: outbound calling](https://docs.vapi.ai/calls/outbound-calling))

6. Your phone rings. Answer it. The assistant greets you and the dashboard mirrors the call (transcript, recommendation, push) through the same `/api/vapi/webhook` your inbound and web calls use.

**Troubleshooting:**

- `501 Outbound calling not configured` on the dashboard → one of the three env vars is missing or `npm run dev` wasn't restarted after editing `.env.local`.
- `502 vapi call failed` with `details.message: "..."` → the message is Vapi's. Common causes: invalid E.164 number (include the `+`), country not on your plan, or the phone number id belongs to a different org.
- Phone rings but the dashboard doesn't update → the Vapi assistant's **Server URL** isn't set (step 4.9) or doesn't match your ngrok tunnel. Check ngrok's inspector at <http://127.0.0.1:4040>.

## 10. Reference: what the webhook sees

Example POST body Vapi sends when the agent calls `recommend({ amountFiat: 1000, fiatCurrency: "EUR" })`:

```json
{
  "message": {
    "type": "tool-calls",
    "toolCallList": [
      {
        "id": "call_abc123",
        "type": "function",
        "name": "recommend",
        "arguments": { "amountFiat": 1000, "fiatCurrency": "EUR" }
      }
    ]
  }
}
```

Our response (HTTP 200, `result` is a single-line JSON string — Vapi requires a string, not an object):

```json
{
  "results": [
    {
      "toolCallId": "call_abc123",
      "result": "{\"intentId\":\"intent_demo_001\",\"productName\":\"Aave v3 USDC\",\"apyPct\":5.2, ... }"
    }
  ]
}
```

The LLM parses that string, uses the fields to compose natural speech, and replies on the call.

---

Source pages (Vapi docs, April 2026):
- Custom Tools overview: <https://docs.vapi.ai/tools/custom-tools>
- Custom Tools troubleshooting (response rules, async, schema): <https://docs.vapi.ai/tools/custom-tools-troubleshooting>
- Server URL configuration + priority: <https://docs.vapi.ai/server-url/setting-server-urls>
- Server URL authentication (credentials + legacy secret): <https://docs.vapi.ai/server-url/server-authentication>
- Server URL events (message shapes, 7.5s timeout for assistant-request): <https://docs.vapi.ai/server-url/events>
- Assistants quickstart: <https://docs.vapi.ai/assistants/quickstart>
- Voice widget (public-key + browser integration): <https://docs.vapi.ai/assistants/examples/voice-widget>
- Call ended reasons (mic permission, silence): <https://docs.vapi.ai/calls/call-ended-reason>
- Transient vs permanent assistants: <https://docs.vapi.ai/assistants/concepts/transient-vs-permanent-configurations>
- `@vapi-ai/web` SDK: <https://github.com/VapiAI/web>
