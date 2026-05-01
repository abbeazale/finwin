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


export const dashboardNavItems: {
  label: string;
  icon: typeof LayoutDashboard;
  href?: string;
  disabled?: boolean;
}[] = [
  { label: "Desk", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Transactions", icon: Wallet, href: "/transactions" },
  { label: "Budgets", icon: Target, href: "/budgets" },
  { label: "Investments", icon: LineChart, href: "/investments" },
  { label: "Analytics", icon: TrendingUp, disabled: true },
  { label: "Settings", icon: Settings, href: "/settings/connections" },
];

type DashboardSidebarProps = {
  firstName: string;
  initials: string;
  isPending: boolean;
  currentPath: string;
  onLogout: () => void;
};

export function isDashboardNavItemActive(
  item: (typeof dashboardNavItems)[number],
  currentPath: string,
) {
  if (!item.href) {
    return false;
  }

  if (item.href === "/dashboard") {
    return currentPath === item.href;
  }

  return currentPath === item.href || currentPath.startsWith(`${item.href}/`);
}

type DashboardNavItemProps = {
  item: (typeof dashboardNavItems)[number];
  currentPath: string;
};

export function DashboardSidebar({
  firstName,
  initials,
  isPending,
  currentPath,
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
        {dashboardNavItems.map((item) => (
          <DashboardNavItem
            key={item.label}
            item={item}
            currentPath={currentPath}
          />
        ))}
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

function DashboardNavItem({ item, currentPath }: DashboardNavItemProps) {
  const Icon = item.icon;
  const active = isDashboardNavItemActive(item, currentPath);
  const className = `group relative flex h-10 items-center gap-3 rounded-[2px] px-3 text-left text-[12px] uppercase tracking-[0.08em] transition-all ${
    active
      ? "bg-[rgba(201,164,107,0.08)] text-brass-hi"
      : "text-bone-mute hover:bg-[var(--ink-2-solid)] hover:text-bone"
  } ${item.disabled ? "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-bone-mute" : ""}`;
  const content = (
    <>
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-brass" />
      ) : null}
      <Icon className="size-3.5" />
      <span>{item.label}</span>
      {active ? (
        <span className="ml-auto size-1.5 rounded-full bg-brass animate-pulse-dot" />
      ) : null}
    </>
  );

  return item.href ? (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  ) : (
    <button type="button" className={className} disabled={item.disabled}>
      {content}
    </button>
  );
}
