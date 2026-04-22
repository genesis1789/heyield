/**
 * Pin provider selection during tests so adapters never hit real APIs.
 * This must run BEFORE any module import that triggers `getProviders()`
 * caching — vitest loads this via `setupFiles`.
 */
process.env.EARN_PROVIDER = "mock";
process.env.PRICING_PROVIDER = "mock";
process.env.INTENT_FACTORY_PROVIDER = "mock";
process.env.FUNDING_PROVIDER = "simulator";
process.env.FUNDING_SIM_STEP_MS = "0";
// Each vitest worker writes to its own funding-sessions file so parallel
// workers never clobber each other.
process.env.FUNDING_SIM_STORE_FILE = `funding-sessions.worker-${process.pid}.json`;

/** Reset caches before every test file. */
type Glob = {
  __vc_providers?: unknown;
  __vc_simulatorConfig?: unknown;
  __vc_agentSession?: unknown;
};
const g = globalThis as Glob;
delete g.__vc_providers;
delete g.__vc_simulatorConfig;
delete g.__vc_agentSession;
