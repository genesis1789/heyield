"use client";

/**
 * "Call is live" state, before the agent has a recommendation. A minimal
 * waveform-ish pulse keeps the audience oriented without competing with the
 * voice conversation for attention.
 */
export function StageListening() {
  return (
    <main className="stage-shell flex flex-col items-center justify-center text-center">
      <div className="flex h-14 items-end justify-center gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span
            key={i}
            className="inline-block w-1.5 rounded-full bg-[#6D5CF5]"
            style={{
              height: `${18 + ((i * 7) % 30)}px`,
              animation: `wave 1.1s ease-in-out ${i * 0.08}s infinite`,
            }}
          />
        ))}
      </div>

      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-[#6D5CF5]">
        Listening
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        Tell me what you&rsquo;re trying to do.
      </h1>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
        Speak naturally. I&rsquo;ll handle the rest.
      </p>

      <style jsx>{`
        @keyframes wave {
          0%,
          100% {
            transform: scaleY(0.6);
            opacity: 0.6;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}
