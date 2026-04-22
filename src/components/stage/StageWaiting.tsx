"use client";

/**
 * Pre-call idle screen. Audience sees a calm, deliberate "ready to listen"
 * state before the phone rings. No buttons — the operator triggers the call
 * from the laptop console.
 */
export function StageWaiting() {
  return (
    <main className="stage-shell flex flex-col items-center justify-center text-center">
      <div className="relative mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/80 shadow-[0_12px_48px_-12px_rgba(109,92,245,0.4)] ring-1 ring-slate-200">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#6D5CF5]/20" />
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-8 w-8 text-[#6D5CF5]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.48-1.48a2 2 0 0 1 2.11-.45c.83.29 1.7.5 2.6.62A2 2 0 0 1 22 16.92z" />
        </svg>
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Voice Earn Concierge
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        I&rsquo;m ready whenever you are.
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
        Your phone will ring in a moment. Just tell me what you&rsquo;re
        trying to do with your cash.
      </p>
    </main>
  );
}
