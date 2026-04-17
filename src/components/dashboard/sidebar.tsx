import Link from "next/link";
import {
  LayoutDashboard,
  LineChart,
  Settings,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";


const navItems: {
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  href?: string;
}[] = [
  { label: "Desk", icon: LayoutDashboard, active: true },
  { label: "Transactions", icon: Wallet, active: false, href: "/transactions" },
  { label: "Budgets", icon: Target, active: false, href: "/budgets" },
  { label: "Investments", icon: LineChart, active: false },
  { label: "Analytics", icon: TrendingUp, active: false },
  { label: "Settings", icon: Settings, active: false, href: "/settings/connections" },
];

type DashboardSidebarProps = {
  firstName: string;
  initials: string;
  isPending: boolean;
  onLogout: () => void;
};

export function DashboardSidebar({
  firstName,
  initials,
  isPending,
  onLogout,
}: DashboardSidebarProps) {
  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-[var(--stroke)] bg-[var(--ink-1)] lg:flex">
      <div className="flex items-baseline justify-between border-b border-[var(--stroke)] px-6 py-5">
        <Link href="/" className="display text-[26px] leading-none text-bone">
          Fin<span className="italic text-brass">Win</span>
        </Link>
        <span className="label-eyebrow">v0.1</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        <div className="px-3 pb-2 pt-1">
          <span className="label-eyebrow">Desk</span>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const className = `group relative flex h-10 items-center gap-3 rounded-[2px] px-3 text-left text-[12px] uppercase tracking-[0.08em] transition-all ${
            item.active
              ? "bg-[rgba(201,164,107,0.08)] text-brass-hi"
              : "text-bone-mute hover:bg-[var(--ink-2-solid)] hover:text-bone"
          }`;
          const content = (
            <>
              {item.active ? (
                <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-brass" />
              ) : null}
              <Icon className="size-3.5" />
              <span>{item.label}</span>
              {item.active ? (
                <span className="ml-auto size-1.5 rounded-full bg-brass animate-pulse-dot" />
              ) : null}
            </>
          );
          return item.href ? (
            <Link key={item.label} href={item.href} className={className}>
              {content}
            </Link>
          ) : (
            <button key={item.label} type="button" className={className}>
              {content}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[var(--stroke)] p-3">
        <div className="flex items-center gap-3 rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-0)] px-3 py-3">
          <div className="flex size-8 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.08)] text-[10px] text-brass-hi">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-bone">{firstName}</p>
            <p className="truncate text-[10px] text-bone-faint">On the desk</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="label-eyebrow h-auto shrink-0 rounded-[2px] px-1 py-0 shadow-none hover:bg-transparent hover:text-oxide-hi"
            onClick={onLogout}
            disabled={isPending}
          >
            {isPending ? "…" : "exit"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
