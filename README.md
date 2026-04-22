# voiceconcierge

> **Talk to your money. Confirm on your phone.**

A hackathon demo of a voice-first Earn concierge. The caller speaks their request to a voice agent, the agent recommends one curated Earn opportunity, explains it, asks for confirmation, and hands off to a mocked Revolut push for phone-based approval. The browser dashboard observes the call.

See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) and [CLAUDE.md](CLAUDE.md) for the brief.

## Architecture at a glance

```
 Caller ──▶ Vapi web call ──▶ GPT-driven agent ──▶ /api/vapi/webhook ──▶ tools ─┐
                                                                               │
  recommend ── selectOpportunity + buildExplanation + LI.FI APY + LI.FI quote  │
  createApproval ── MockRevolutAdapter.requestApproval                         │
  getApprovalStatus ── polled until approved/declined                          │
                                                                               ▼
                                                                      Dashboard polls
                                                                     /api/agent/session
```

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Zod (boundary validation)
- Vitest
- `@vapi-ai/web` for the voice agent (opt-in, gated by env)
- Custom typed FSM for dashboard state

## Install

```bash
npm install
cp .env.example .env.local
```

Without any env tweaks the app boots into a **preview mode** on `/simulator` — the voice agent is disabled (since it needs Vapi keys), but all backend endpoints, LI.FI Earn hybrid, and LI.FI Quote pricing are live.

To run the real voice flow, configure a Vapi assistant per [docs/vapi-assistant-config.md](docs/vapi-assistant-config.md), then populate `NEXT_PUBLIC_VAPI_*` in `.env.local`.

## Scripts

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start Next.js dev server at http://localhost:3000   |
| `npm run build`     | Production build                                    |
| `npm start`         | Run the production build                            |
| `npm run lint`      | ESLint (next/core-web-vitals)                       |
| `npm run typecheck` | `tsc --noEmit`                                      |
| `npm test`          | Vitest (machine, adapters, webhook, orchestration)  |
| `npm run test:watch`| Vitest in watch mode                                |

## Provider matrix

| Env var                            | Values                  | Default    | Mode                                |
| ---------------------------------- | ----------------------- | ---------- | ----------------------------------- |
| `EARN_PROVIDER`                    | `mock` \| `lifi`        | `mock`     | hybrid-real (LI.FI Earn overlay)    |
| `PRICING_PROVIDER`                 | `lifi` \| `mock`        | `lifi`     | real, keyless                       |
| `INTENT_FACTORY_PROVIDER`          | `mock` \| `real`        | `mock`     | mock only                           |
| `REVOLUT_PROVIDER`                 | `mock` \| `real`        | `mock`     | mock only (documented boundary)     |
| `NEXT_PUBLIC_TELEPHONY_PROVIDER`   | `browser` \| `vapi`     | `browser`  | real when Vapi keys are set         |
| `VAPI_WEBHOOK_SECRET`              | any string              | unset      | shared secret for tool-call webhook |

Every selection degrades gracefully: missing LI.FI key falls back to the seed opportunity; missing Vapi keys fall back to the preview banner; unreachable LI.FI Quote falls back to an indicative network-cost estimate. The demo happy path never hinges on a real call succeeding — but when the keys are set the call, agent, and pricing badge are all real.

See each adapter under [`src/lib/providers/`](src/lib/providers/) for the exact API surfaces, doc URLs, and `// ASSUMPTION:` markers.

## What's real vs mocked

| Surface              | Status                 | Notes                                                          |
| -------------------- | ---------------------- | -------------------------------------------------------------- |
| Voice agent          | real (when keyed)      | Vapi hosts conversation + TTS. System prompt + tools documented in [docs/vapi-assistant-config.md](docs/vapi-assistant-config.md). |
| Earn opportunity APY | hybrid real            | `earn.li.fi/v1/earn/vaults` — overlaid on seed opportunity      |
| LI.FI quote pricing  | real (keyless)         | `li.quest/v1/quote` — feeds the "Live · LI.FI" card badge       |
| Revolut approval push| mock with phone-frame UI | Reframe vs. brief: approval channel, not funding rail. [Boundary note](src/lib/providers/revolut/real.ts). |
| Intent factory       | mock                   | Deterministic `intent_demo_XXX` ids                             |
| State machine        | real + canonical       | `idle → call_active → recommended → approval_pending → completed` |

## Layout

```
src/
  app/
    api/
      agent/session         latest call snapshot the dashboard polls
      approvals/[id]        GET status, POST /tap (judge's Approve/Decline)
      earn/opportunities    legacy read-only route (kept for agent-adjacent consumers)
      pricing               live LI.FI Quote wrapper
      vapi/webhook          tool-call dispatcher (recommend / createApproval / getApprovalStatus / endCall)
      devcontrols           mock config toggles (forceFailure, skipDelays)
    simulator/page.tsx      the dashboard
  components/
    CallSimulator.tsx       thin orchestrator; no forms
    CallControl.tsx         Start/End call
    TranscriptPane.tsx      live transcript (user + assistant)
    RecommendationCard.tsx  read-only product card
    PhonePushCard.tsx       mock Revolut iPhone push w/ Approve/Decline
    StatusTimeline.tsx      3-node timeline
    DevControls.tsx         mock forceFailure / skipDelays
  lib/
    providers/              adapters (earn, pricing, intentFactory, revolut, telephony)
    agent/                  tools.ts + session.ts
    state/                  FSM types + machine
    recommendation.ts       selectOpportunity + buildExplanation
    seed/opportunities.ts   the single curated product
    schemas.ts              Zod schemas for routes + webhook
  tests/                    Vitest
```

## Demo

See [README_DEMO.md](README_DEMO.md).
