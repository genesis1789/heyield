/**
 * Pin provider selection to mocks during tests so adapters never hit the real
 * LI.FI Earn / Quote endpoints. This also must run BEFORE any module import
 * that triggers `getProviders()` caching — vitest loads this via `setupFiles`.
 */
process.env.EARN_PROVIDER = "mock";
process.env.PRICING_PROVIDER = "mock";
process.env.INTENT_FACTORY_PROVIDER = "mock";
process.env.REVOLUT_PROVIDER = "mock";

// Reset the globalThis provider cache before every test file so env changes in
// specific suites (e.g. testing the factory) aren't poisoned by earlier loads.
type Glob = { __vc_providers?: unknown; __vc_mockConfig?: unknown; __vc_agentSession?: unknown };
const g = globalThis as Glob;
delete g.__vc_providers;
delete g.__vc_mockConfig;
delete g.__vc_agentSession;
