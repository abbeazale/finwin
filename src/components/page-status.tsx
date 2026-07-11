export function PageStatus({ label }: { label: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -top-32 right-[14%] h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)" }}
        />
      </div>
      <div className="relative flex flex-col items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
        <span className="label-eyebrow-brass">{label}</span>
      </div>
    </div>
  );
}
