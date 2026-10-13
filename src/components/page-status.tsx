export function PageStatus({ label }: { label: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -top-56 right-[6%] h-[42rem] w-[42rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(232,199,145,0.08), transparent 66%)" }}
        />
        <div
          className="absolute -bottom-64 left-[-10%] h-[46rem] w-[64rem] blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.06), transparent 62%)" }}
        />
      </div>
      <div className="relative flex flex-col items-center gap-4">
        <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
        <span className="display text-[18px] italic text-bone-mute">{label}</span>
      </div>
    </div>
  );
}
