# Demo script — Voice Earn Concierge

Two minutes. Phone screen shared with the audience. The whole story plays out on the phone: call comes in, agent recommends, user pays in Revolut, money lands in Aave. Operator runs it from the laptop without ever touching the phone on camera.

## Pre-show setup (once)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local`:

1. **Vapi** (required for the real voice flow). Follow [docs/vapi-assistant-config.md](docs/vapi-assistant-config.md).
   ```
   NEXT_PUBLIC_TELEPHONY_PROVIDER=vapi
   NEXT_PUBLIC_VAPI_PUBLIC_KEY=...
   NEXT_PUBLIC_VAPI_ASSISTANT_ID=...
   VAPI_PRIVATE_KEY=...
   VAPI_PHONE_NUMBER_ID=...
   NEXT_PUBLIC_VAPI_PHONE_NUMBER=+14155551234   # optional, for inbound dial
   ```

2. **Funding** (choose one):
   - **Simulator mode** (no keys, rehearsal-friendly): leave `FUNDING_PROVIDER=simulator`. Works on pure localhost.
   - **Real Revolut sandbox** (the wow path): set `FUNDING_PROVIDER=merchant` (or `merchant-onchain` for a real Sepolia tx) and `REVOLUT_MERCHANT_SECRET_KEY=sk_…`. **Also set `PUBLIC_BASE_URL`** to an ngrok tunnel — Revolut rejects localhost redirects.

3. **Tunnel** (required for the real Revolut flow):
   ```bash
   npx ngrok http 3000
   ```
   Copy the `https://<slug>.ngrok.app` URL into `PUBLIC_BASE_URL` and into your Vapi assistant's server URL.

## The two surfaces

| Where | URL | Who sees it |
|-------|-----|-------------|
| Operator console | `http://localhost:3000/simulator` | You, on the laptop |
| Audience stage | `https://<tunnel>/stage` | The audience, via shared phone screen |

The stage is the product. The operator console is the control panel.

## Pitch script (2 minutes)

**Pre-show (off-camera):**
- Laptop: open `/simulator`.
- Phone: scan the QR on the operator console, land on `/stage`. Leave it open.
- Start screen-share of the phone.

**0:00** *"This is my phone. Watch what happens when an AI agent manages my money for me."*

**0:05** Operator taps **Call me** on the laptop. *(Narrate if you like: "I'm about to call myself.")*

**0:10** Phone rings. Answer. `/stage` fades to a listening waveform.

**0:15** Speak naturally: *"I have a thousand euros sitting idle. Got anything decent for yield?"*

**0:30** Agent responds. `/stage` transitions to the recommendation card — big APY, projected yearly return, one risk line. Aave v3 badge visible.

**0:50** Say: *"Yes, let's do it."*

**0:55** Agent: *"I'm opening Revolut on your phone."* `/stage` swaps to the Revolut handoff card with one button: **Continue in Revolut**.

**1:00** Tap the button. Phone navigates to the real Revolut sandbox checkout.

**1:10** Pay with a Revolut sandbox test card (e.g. `4929 4210 0000 0472`, any future expiry, any CVV).

**1:20** Revolut redirects back to `/stage/<sessionId>`. Aave-styled status page springs in: pill ("Payment received — routing to Aave"), hero ("Depositing to Aave."), amount card, progress rail.

**1:30** Rail animates through: Payment → Converted → Routed.

**1:45** Hero crossfades to *"Your money is earning."* Rail locks on Deposited. Tx hash pill pops in (in `merchant-onchain` mode).

**1:55** Agent on the call: *"You're in. About €52 expected this year."* Call ends.

**2:00** Done. The last 30 seconds are pure visual payoff — no taps, no user input.

## Rehearsal path (no keys needed)

- `FUNDING_PROVIDER=simulator` in `.env.local`.
- No ngrok needed.
- Tap **Continue in Revolut** on the stage → phone navigates to our own Revolut-styled sandbox page at `/checkout/<id>` → tap **Pay** → phone routes back to `/stage/<id>` and the same Aave choreography runs.
- Exactly one surface less real but reads identically to the audience.

## Failure path (demoable)

- Open operator console, press Shift+D (or append `?dev=1` to the URL).
- Dev controls panel appears. Check **Force funding failure**.
- Next payment attempt on the stage flips straight to the ended state with a neutral copy line. Resets cleanly with the **Start over** button on the laptop.

## What the audience sees, state by state

| Trigger | Stage screen |
|---|---|
| App loaded, no call yet | `StageWaiting` — "I'm ready whenever you are." |
| Phone ringing | `StageWaiting` (same) |
| Call live, no recommendation | `StageListening` — waveform, "Tell me what you're trying to do." |
| Agent ran `recommend` | `StageRecommendation` — APY hero, Aave badge |
| Agent ran `startFunding` | `StageHandoff` — "Continue in Revolut" CTA |
| Revolut captured payment | `StageInvesting` — Aave-style rail, "Depositing to Aave." |
| Funding complete | `StageInvested` — "Your money is earning." + tx pill |
| Cancelled / failed | `StageEnded` — calm "No worries." |

## Hidden by default

- Transcript — only on the operator console.
- Dev controls — only revealed with Shift+D or `?dev=1`.
- Session ids, funding mode, tx hash raw — all in the operator diagnostics card, never on the stage.
- "Sandbox" badge — only shown briefly on the handoff card when `simulated === true`. Removed on the success screen.

## Live vs. simulated quick reference

| `FUNDING_PROVIDER` | Revolut checkout | On-chain proof | Needs tunnel |
|---|---|---|---|
| `simulator` | local Revolut-styled page | simulated tx hash | no |
| `merchant` | real Revolut sandbox | none | yes (for redirect) |
| `merchant-onchain` | real Revolut sandbox | real Sepolia EURC transfer | yes |
