import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "desk-panel min-w-0",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-4 px-6 pb-4 pt-6">
        <h2 className="display text-[26px] leading-none text-bone">{title}</h2>
        {meta ? (
          <span className="text-[13px] text-bone-mute">{meta}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function PanelStatus({ label }: { label: string }) {
  return (
    <div className="px-6 py-12 text-center text-[13px] text-bone-mute">
      {label}
    </div>
  );
}

export function MiniPill({
  label,
  tone = "bone",
}: {
  label: string;
  tone?: "bone" | "amber" | "oxide";
}) {
  const className =
    tone === "oxide"
      ? "border-[rgba(194,106,72,0.35)] text-oxide-hi"
      : tone === "amber"
        ? "border-[rgba(212,154,74,0.35)] text-amber"
        : "border-[var(--stroke-2)] text-bone-mute";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section className="desk-panel px-6 py-16 text-center">
      <p className="display text-[28px] leading-tight text-bone">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-[14px] leading-[1.7] text-bone-mute">
        {body}
      </p>
      <Link
        href={actionHref}
        className="btn-brass-fill mt-7 h-11 px-5"
      >
        {actionLabel}
      </Link>
    </section>
  );
}
