# Demo script — Voice Earn Concierge

60 seconds from "Start call" to "Completed."

## Setup (once)

```bash
npm install
cp .env.example .env.local
npm run dev
```

To run the **real voice flow** you'll also need:

1. A Vapi account + a configured assistant (paste-ready config in [docs/vapi-assistant-config.md](docs/vapi-assistant-config.md)).
2. A public URL that Vapi can reach (locally: `ngrok http 3000` works).
3. These in `.env.local`:
   ```
   NEXT_PUBLIC_TELEPHONY_PROVIDER=vapi
   NEXT_PUBLIC_VAPI_PUBLIC_KEY=...
   NEXT_PUBLIC_VAPI_ASSISTANT_ID=...
   VAPI_WEBHOOK_SECRET=<random>
   ```

Without those, `/simulator` boots in **preview mode** (dashboard renders, preview banner explains what's missing, no agent).

## Happy path (the pitch)

1. Open http://localhost:3000 (redirects to `/simulator`).
2. Click **Start call**. Browser prompts for mic access.
3. Speak:
   > "My bank is not offering me any yield on my cash. Do you have a good option to invest 1000 EUR with a decent risk-return profile?"
4. Your words stream into the Transcript pane live.
5. The agent calls `recommend` → the **Recommendation** card renders (Aave v3 USDC, APY from LI.FI Earn, est. annual return on 1000 EUR, fees, one risk sentence, **Live · LI.FI** gas badge).
6. The agent reads the explanation aloud and asks if you want to proceed.
7. Say: *"Yes."*
8. The agent calls `createApproval`. The **Revolut push** card pops with an iPhone-style frame. The agent says "Please approve on your phone."
9. Tap **Approve** on the mock phone card.
10. The agent polls `getApprovalStatus`, sees `approved`, says "Your request has been confirmed."
11. The timeline settles on **Completed**; the transcript is complete.

## Failure path

Same flow — on step 9 tap **Decline** instead. Agent says "The request was declined." Timeline shows a "Declined" banner.

Alternatively, open **Dev controls** → toggle "Force funding failure" (auto-declines the approval on the first poll) → start over. Simulates a silent rejection.

## Key moments the judges should see

- **Live transcription**: both caller and agent labelled in the Transcript pane.
- **Real APY**: when `EARN_PROVIDER=lifi` + `LIFI_API_KEY` are set, the card shows live LI.FI Earn APY; otherwise the seed value.
- **Live LI.FI pricing badge**: a green "Live · LI.FI" pill with the Base network cost estimate (keyless, always on).
- **The phone-frame push**: the approval step renders an iPhone mockup with Revolut branding. This is the "confirm on your phone" payoff.
- **Verbal confirmation drives state**: no buttons between "agent recommended" and "tap approve". The agent drives it.

## What's real

See the table in [README.md](README.md#whats-real-vs-mocked).
