import { CallSimulator } from "@/components/CallSimulator";

export default function SimulatorPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-sm font-medium text-brand">
          <span className="inline-block h-2 w-2 rounded-full bg-brand" />
          Voice Earn Concierge
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Talk to your money. Confirm on your phone.
        </h1>
        <p className="mt-2 text-slate-600">
          Start a call, tell the concierge what you&rsquo;re trying to do with
          your idle cash, and approve the transfer from a Revolut-style push on
          the dashboard.
        </p>
      </header>

      <CallSimulator />

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          <span className="font-medium text-slate-700">Live:</span> voice agent
          (Vapi), state machine, LI.FI Quote pricing.
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-medium text-slate-700">Hybrid:</span> LI.FI Earn
          APY when keyed.
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-medium text-slate-700">Mocked:</span> Intent
          Factory, Revolut approval push.
        </p>
        <p className="mt-1">
          All funds, addresses, and the Revolut push notification are simulated.
        </p>
      </footer>
    </main>
  );
}
