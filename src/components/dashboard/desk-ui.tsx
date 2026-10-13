import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonthHeading, shiftMonthStart } from "@/lib/date";

/** Serif page title with an italic kicker line, as on the dashboard. */
export function PageHeading({
  kicker,
  title,
  description,
  aside,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-8 animate-fade-slide">
      <div className="min-w-0">
        {kicker ? (
          <p className="display mb-4 text-[15px] italic leading-none text-bone-faint">
            {kicker}
          </p>
        ) : null}
        <h1 className="display text-[clamp(2.4rem,4vw,3.5rem)] leading-[1.02] text-bone">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-xl text-[15px] leading-[1.7] text-bone-mute">
            {description}
          </p>
        ) : null}
      </div>
      {aside}
    </header>
  );
}

/** Title row at the top of a `.desk-panel`. */
export function PanelHeading({
  title,
  detail,
  action,
}: {
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
      <div className="min-w-0">
        <h2 className="display text-[26px] leading-none text-bone">{title}</h2>
        {detail ? (
          <p className="mt-2 text-[13px] text-bone-mute">{detail}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export const panelLinkClass =
  "shrink-0 pt-1 text-[13px] text-bone-mute transition-colors hover:text-brass-hi";

export function EmptyPanel({
  children,
  className = "min-h-[260px]",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-[14px] border border-dashed border-[var(--stroke-2)] bg-[rgba(10,10,9,0.5)] px-6 text-center text-[13px] text-bone-mute ${className}`}
    >
      {children}
    </div>
  );
}

const noticeTones = {
  error:
    "border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.07)] text-oxide-hi",
  warn: "border-[rgba(212,154,74,0.32)] bg-[rgba(212,154,74,0.06)] text-amber",
  brass:
    "border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] text-brass-hi",
  good: "border-[rgba(122,154,126,0.3)] bg-[rgba(122,154,126,0.07)] text-sage-hi",
} as const;

/** A soft one-line banner for errors and notes above page content. */
export function Notice({
  tone,
  icon,
  children,
  className = "mb-6",
}: {
  tone: keyof typeof noticeTones;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[14px] border px-4 py-3 text-[13px] leading-[1.6] [&>svg]:mt-[3px] [&>svg]:size-3.5 [&>svg]:shrink-0 ${noticeTones[tone]} ${className}`}
    >
      {icon ?? <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Rounded month picker with previous and next buttons. */
export function MonthSwitcher({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const buttonClass =
    "size-9 rounded-full text-bone-mute hover:bg-[var(--ink-2-solid)] hover:text-bone";

  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--stroke-2)] bg-[var(--ink-1)] p-1 cove">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={buttonClass}
        onClick={() => onChange(shiftMonthStart(month, -1))}
      >
        <ArrowLeft className="size-4" />
        <span className="sr-only">Previous month</span>
      </Button>
      <div className="display min-w-[9.5rem] px-2 text-center text-[18px] leading-none text-bone">
        {formatMonthHeading(month)}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={buttonClass}
        onClick={() => onChange(shiftMonthStart(month, 1))}
      >
        <ArrowRight className="size-4" />
        <span className="sr-only">Next month</span>
      </Button>
    </div>
  );
}

/** Quiet loading line for inside the app shell. */
export function ShellLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4">
      <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
      <span className="display text-[18px] italic text-bone-mute">{label}</span>
    </div>
  );
}

const settingsTabs = [
  { key: "connections", label: "Connections", href: "/settings/connections" },
  { key: "security", label: "Security", href: "/settings/security" },
] as const;

/** Rounded tab switcher shared by the settings pages. */
export function SettingsTabs({
  active,
}: {
  active: (typeof settingsTabs)[number]["key"];
}) {
  return (
    <nav
      aria-label="Settings"
      className="mb-8 inline-flex rounded-full border border-[var(--stroke-2)] bg-[var(--ink-1)] p-1"
    >
      {settingsTabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={`rounded-full px-5 py-2 text-[13px] font-medium transition-colors ${
              selected
                ? "bg-gradient-to-b from-[var(--brass-hi)] via-[var(--brass)] to-[var(--brass-lo)] text-[#1a1408] shadow-[inset_0_1px_0_rgba(255,244,214,0.45)]"
                : "text-bone-mute hover:text-bone"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
