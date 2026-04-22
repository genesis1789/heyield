# docs/PROJECT_BRIEF.md

## Product
Hackathon showcase: voice-first Earn concierge for LI.FI.

## Demo contract
User says they have idle EUR cash and want better yield.
System recommends one predefined Earn option.
System explains:
- product
- APY
- estimated yearly return on entered amount
- fees
- one risk/tradeoff sentence
User confirms.
System creates intent/deposit address.
Revolut funds USDC to that address.
Intent Factory / LI.FI execution proceeds asynchronously.
UI shows states until success.

## Real vs mocked by default
- LI.FI Earn: real if possible
- LI.FI quote/composer data: real if possible
- Intent Factory: mock unless stable real API is available
- Revolut: mock unless real sandbox/test flow is available
- telephony: browser simulator first, real phone optional

## Recommended default product
A simple same-chain stablecoin-oriented path, ideally USDC-based and easy to explain.

## Acceptance criteria
- one happy path fully works
- one failure path is demoable
- explanation is amount-specific
- async status tracker is clear in under 1 minute
- README and demo script exist
