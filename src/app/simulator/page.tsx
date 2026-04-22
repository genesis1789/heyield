import { CallSimulator } from "@/components/CallSimulator";

export default function SimulatorPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-brand" />
          Operator console
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Voice Earn Concierge · controls
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Run the demo from here. The audience-facing experience lives on{" "}
          <a
            href="/stage"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand hover:text-brand-700"
          >
            /stage
          </a>
          {" "}— scan the QR with the phone you&rsquo;re screen-sharing, then
          trigger the call from here.
        </p>
      </header>

      <CallSimulator />
    </main>
  );
}
