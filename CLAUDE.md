# CLAUDE.md

## Project
Build a hackathon demo for a voice-first LI.FI Earn concierge.

## Goal
A user speaks a request like "I have idle EUR cash and want better yield."
The system:
1. extracts amount + intent
2. recommends exactly one predefined Earn opportunity
3. explains APY, estimated return, fees, and one risk sentence
4. asks for confirmation
5. creates an intent/deposit address
6. triggers Revolut as the funding rail
7. shows async execution states until completion

## Non-goals
- no compliance flows
- no broad investment search
- no portfolio optimization
- no real advisory engine
- no multi-asset complexity

## Product constraints
- LI.FI Earn = discovery/data
- Composer / Intent Factory = execution
- Revolut = funding rail only, not DeFi signer
- one curated product path only
- narrow, polished demo beats broad fragile system

## Default architecture
- Next.js + TypeScript
- Tailwind + clean component library
- Zod for validation
- provider adapters:
  - EarnAdapter
  - IntentFactoryAdapter
  - RevolutAdapter
  - TelephonyAdapter
- every adapter supports real and mock mode

## UX surfaces
- call simulator
- recommendation/explanation card
- confirmation step
- funding step
- async status timeline
- final success state
- developer controls for mock events

## Engineering rules
- verify API shapes before coding
- do not invent undocumented fields
- prefer one working vertical slice over broad scaffolding
- keep mocks deterministic
- keep real vs mock provider selection centralized
- add tests for parsing, pricing, status transitions, and happy path orchestration

## Commands
- install deps
- dev server
- lint
- typecheck
- test
- build

## Done definition
The demo works locally from one user utterance through completion and clearly shows what is real vs mocked.

## Stack pins (set during bootstrap)
- package manager: npm
- test runner: Vitest
- telephony default: Web Speech API in the browser, text-input fallback
- state machine: custom typed FSM in `src/lib/state` (no XState dep)
- central real-vs-mock switch: `src/lib/providers/index.ts` (env-driven)
- assumption markers: any unverified LI.FI / Revolut field is commented `// ASSUMPTION:` in the real-adapter stubs
