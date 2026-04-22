# voiceconcierge

> **Talk to your money. Watch it invest.**

A hackathon demo of a voice-first Earn concierge, designed for a phone-screen-shared pitch. The caller speaks to a voice agent, the agent recommends one curated Earn opportunity and explains it, the caller confirms verbally, and Revolut opens on the phone for a real sandbox checkout. After paying, the phone is redirected to an Aave-styled status page that animates the money into the yield product and ends on "your money is earning" — optionally proven by a real Sepolia EURC transfer.

Two surfaces, one session:

- **Audience stage** at `/stage` — phone-first, full-bleed, no chrome. Eight states from "ready whenever you are" through to "earning".
- **Operator console** at `/simulator` — transcript, dial controls, QR to the stage, live iframe mirror of the stage, dev toggles.

See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) and [CLAUDE.md](CLAUDE.md) for the original brief, and [README_DEMO.md](README_DEMO.md) for the 2-minute pitch script.

## Architecture at a glance

```
 Caller ── Vapi call ──▶ GPT agent ──▶ /api/vapi/webhook ──▶ tools ──▶ AgentSession
                                                                           │
  recommend         selectOpportunity + buildExplanation + live APY        │
  startFunding      FundingAdapter.createSession (simulator or real)       │
  getFundingStatus  polled until invested / cancelled / failed             │
                                                                           ▼
                                    ┌──────────────────────────────────────┴──────┐
                                    ▼                                             ▼
                         /stage (audience, phone)                  /simulator (operator, laptop)
                         — poll 1.2-10s backoff                    — poll 750ms + transcript + QR + mirror
```

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Zod (boundary validation)
- Vitest
- `@vapi-ai/web` for the voice agent (opt-in)
- `viem` for optional Sepolia EURC transfers
- Custom typed FSM for dashboard state

## Install

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without any env tweaks the app boots into preview mode on `/simulator`: the voice agent is disabled (needs Vapi keys) but the full funding flow — recommendation, Revolut-styled checkout, Aave-style investment timeline, "now earning" finale — is fully wired in **simulator mode** at `/stage`.

To run the real voice flow, configure a Vapi assistant per [docs/vapi-assistant-config.md](docs/vapi-assistant-config.md) and populate `NEXT_PUBLIC_VAPI_*` in `.env.local`. To replace the simulator with a real Revolut Merchant sandbox, flip `FUNDING_PROVIDER=merchant` and set `PUBLIC_BASE_URL` + `NEXT_PUBLIC_PUBLIC_BASE_URL` to an ngrok tunnel so Revolut can redirect the phone back to `/stage/[id]`.

## Scripts

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start Next.js dev server at http://localhost:3000   |
| `npm run build`     | Production build                                    |
| `npm start`         | Run the production build                            |
| `npm run lint`      | ESLint (next/core-web-vitals)                       |
| `npm run typecheck` | `tsc --noEmit`                                      |
| `npm test`          | Vitest                                              |
| `npm run test:watch`| Vitest in watch mode                                |

## Provider matrix

| Env var                            | Values                                       | Default      | Mode                                |
| ---------------------------------- | -------------------------------------------- | ------------ | ----------------------------------- |
| `EARN_PROVIDER`                    | `mock` \| `lifi`                             | `mock`       | hybrid-real (LI.FI Earn overlay)    |
| `PRICING_PROVIDER`                 | `lifi` \| `mock`                             | `lifi`       | real, keyless                       |
| `INTENT_FACTORY_PROVIDER`          | `mock` \| `real`                             | `mock`       | mock only                           |
| `FUNDING_PROVIDER`                 | `simulator` \| `merchant` \| `merchant-onchain` | `simulator` | simulator is keyless; the others use a real Revolut sandbox key |
| `NEXT_PUBLIC_TELEPHONY_PROVIDER`   | `browser` \| `vapi`                          | `browser`    | real when Vapi keys are set         |
| `VAPI_WEBHOOK_SECRET`              | any string                                   | unset        | shared secret for tool-call webhook |

Every selection degrades gracefully: missing LI.FI key falls back to the seed opportunity; missing Vapi keys fall back to the preview banner; missing Revolut Merchant key falls back to the simulator funding provider; unreachable LI.FI Quote falls back to an indicative network-cost estimate. The demo happy path never hinges on a real call succeeding — but when the keys are set the call, agent, pricing badge, Revolut checkout, and on-chain transfer are all real.

See each adapter under [`src/lib/providers/`](src/lib/providers/) for the exact API surfaces and doc URLs.

## What's real vs mocked

| Surface               | Status                 | Notes                                                          |
| --------------------- | ---------------------- | -------------------------------------------------------------- |
| Voice agent           | real (when keyed)      | Vapi hosts conversation + TTS. System prompt + tools in [docs/vapi-assistant-config.md](docs/vapi-assistant-config.md). |
| Earn opportunity APY  | hybrid real            | `earn.li.fi/v1/earn/vaults` — overlaid on seed opportunity     |
| LI.FI quote pricing   | real (keyless)         | `li.quest/v1/quote` — feeds the "Live · LI.FI" card badge       |
| Revolut checkout      | real (sandbox) or simulated | `FUNDING_PROVIDER=merchant` → Revolut Merchant sandbox; `simulator` → styled hosted page we serve ourselves |
| On-chain delivery     | optional real          | `FUNDING_PROVIDER=merchant-onchain` + `SEPOLIA_SOURCE_PRIVATE_KEY` → real Sepolia EURC transfer |
| Intent factory        | mock                   | Deterministic `intent_demo_XXX` ids                            |
| State machine         | real + canonical       | `recommended → awaiting_checkout → payment_received → routing_to_yield → invested` |

## Layout

```
src/
  app/
    api/
      agent/session         latest call snapshot the operator console polls
      agent/dial            outbound "Call me" endpoint
      funding/[id]          GET session snapshot (checkout widget + /stage/[id])
      funding/[id]/advance  POST advance event (sandbox Pay / cancel)
      earn/opportunities    legacy read-only route
      pricing               live LI.FI Quote wrapper
      vapi/webhook          tool-call dispatcher (recommend / startFunding / getFundingStatus / endCall)
      devcontrols           operator toggles (forceFailure, skipDelays, stepMs)
    checkout/[id]/page.tsx  Revolut-styled sandbox checkout widget
    stage/
      layout.tsx            phone-first full-bleed layout + Motion spring eases
      page.tsx              audience view, watches the latest agent session
      [id]/page.tsx         audience view pinned to one funding session (Revolut redirect target)
    simulator/page.tsx      operator console
  components/
    CallSimulator.tsx       operator orchestrator (call control + diagnostics)
    CallControl.tsx         Start/End call + outbound dial
    TranscriptPane.tsx      live transcript (operator-only)
    DevControls.tsx         operator toggles (hidden unless ?dev=1 / Shift+D)
    operator/
      StageLinkCard.tsx     QR code + copy-link for scanning the phone in
      StageMirror.tsx       iframe of /stage at phone aspect ratio
    stage/
      StageFrame.tsx        picks one of the seven screens from the session
      StageWaiting.tsx      pre-call idle
      StageListening.tsx    call live, no recommendation yet
      StageRecommendation.tsx   full-bleed APY + projected return
      StageHandoff.tsx      "Continue in Revolut" CTA
      StageInvesting.tsx    Aave-styled rail with dwell-clocked pacer
      StageInvested.tsx     "your money is earning" finale
      StageEnded.tsx        neutral cancelled/failed state
      useStageSession.ts    1.2s-10s backoff poll, visibility-aware
      useStagePacer.ts      3s-per-step pacer + sessionStorage idempotency
  lib/
    providers/              adapters (earn, pricing, intentFactory, funding, telephony)
      funding/              simulator + merchant + on-chain modules
    agent/                  tools.ts + session.ts
    state/                  FSM types + machine
    recommendation.ts       selectOpportunity + buildExplanation
    seed/opportunities.ts   the single curated product
    schemas.ts              Zod schemas for routes + webhook
  tests/                    Vitest
```

## Demo

See [README_DEMO.md](README_DEMO.md).
