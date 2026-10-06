import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  dashboardNavItems,
  isDashboardNavItemActive,
  type DashboardNavItem,
} from "@/components/dashboard/nav";

type DashboardSidebarProps = {
  firstName: string;
  initials: string;
  isPending: boolean;
  currentPath: string;
  onLogout: () => void;
};

type DashboardNavItemProps = {
  item: DashboardNavItem;
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
    <aside
      className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-[var(--stroke)] lg:flex"
      style={{
        background:
          "linear-gradient(180deg, var(--ink-1) 0%, rgba(17,17,16,0.6) 100%)",
      }}
    >
      <div className="px-7 pb-6 pt-7">
        <Link href="/" className="display text-[27px] leading-none text-bone">
          Fin<span className="italic text-brass">Win</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-4">
        {dashboardNavItems.map((item) => (
          <DashboardNavItem
            key={item.label}
            item={item}
            currentPath={currentPath}
          />
        ))}
      </nav>

      <div className="p-4">
        <div className="flex items-center gap-3 rounded-[14px] border border-[var(--stroke-2)] bg-[var(--ink-0)] px-3 py-3 cove">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.08)] text-[11px] font-medium text-brass-hi">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-bone">{firstName}</p>
            <p className="truncate text-[11.5px] text-bone-faint">Signed in</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-auto shrink-0 rounded-[8px] px-2 py-1 text-[12px] font-normal text-bone-mute shadow-none hover:bg-transparent hover:text-oxide-hi"
            onClick={onLogout}
            disabled={isPending}
          >
            {isPending ? "…" : "Sign out"}
          </Button>
        </div>
      </div>
    </aside>
  );
}

function DashboardNavItem({ item, currentPath }: DashboardNavItemProps) {
  const Icon = item.icon;
  const active = isDashboardNavItemActive(item, currentPath);
  const className = `group flex h-11 items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px] transition-all ${
    active
      ? "bg-[rgba(201,164,107,0.09)] text-brass-hi shadow-[inset_0_0_0_1px_var(--stroke-brass)]"
      : "text-bone-mute hover:bg-[rgba(232,225,210,0.04)] hover:text-bone"
  }`;
  const content = (
    <>
      <Icon
        className={`size-4 ${active ? "text-brass" : "text-bone-faint group-hover:text-bone-mute"}`}
      />
      <span>{item.label}</span>
    </>
  );

  return (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}
