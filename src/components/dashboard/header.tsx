import Link from "next/link";
import { ChevronDown, LogOut, Menu, Settings } from "lucide-react";
import { ConnectBank, type ConnectBankResult } from "@/components/connect-bank";
import { RefreshTransactions, type RefreshResult } from "@/components/refresh-transactions";
import { Button } from "@/components/ui/button";
import {
  dashboardNavItems,
  isDashboardNavItemActive,
} from "@/components/dashboard/nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DashboardHeaderProps = {
  firstName: string;
  initials: string;
  isPending: boolean;
  currentPath: string;
  onLogout: () => void;
  onRefreshed: (t: RefreshResult) => void;
  onConnected: (result: ConnectBankResult) => void;
};

export function DashboardHeader({
  firstName,
  initials,
  isPending,
  currentPath,
  onLogout,
  onRefreshed,
  onConnected,
}: DashboardHeaderProps) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--stroke)] bg-[var(--ink-0)]/80 px-6 py-3 smoked">
      <div className="flex items-center gap-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="btn-ghost flex size-9 rounded-[2px] border-[var(--stroke-2)] p-0 shadow-none lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-56 border-[var(--stroke-2)] bg-[var(--ink-1)] p-1 text-bone shadow-2xl"
          >
            <DropdownMenuLabel className="label-eyebrow px-2 py-2 font-normal">
              FinWin
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[var(--stroke)]" />
            <DropdownMenuGroup>
              {dashboardNavItems.map((item) => {
                const Icon = item.icon;
                const active = isDashboardNavItemActive(item, currentPath);
                const className = `gap-3 rounded-[2px] px-2 py-2 text-[11px] uppercase tracking-[0.12em] ${
                  active
                    ? "bg-[rgba(201,164,107,0.08)] text-brass-hi focus:bg-[rgba(201,164,107,0.08)] focus:text-brass-hi"
                    : "text-bone-mute focus:bg-[var(--ink-2-solid)] focus:text-bone"
                }`;

                return (
                  <DropdownMenuItem key={item.label} asChild className={className}>
                    <Link href={item.href} aria-current={active ? "page" : undefined}>
                      <Icon className="size-3.5" />
                      {item.label}
                      {active ? (
                        <span className="ml-auto size-1.5 rounded-full bg-brass animate-pulse-dot" />
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
          <span className="label-eyebrow-brass">Live · Plaid-backed</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <RefreshTransactions onRefreshed={onRefreshed} />
        <ConnectBank onConnected={onConnected} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="btn-ghost flex h-9 items-center gap-2 rounded-[2px] px-1.5 shadow-none"
              aria-label="Account menu"
            >
              <span className="flex size-7 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.08)] text-[10px] text-brass-hi">
                {initials}
              </span>
              <ChevronDown className="size-3.5 text-bone-mute" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <span className="truncate text-bone">{firstName}</span>
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/settings/connections">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={isPending}
                onSelect={() => {
                  onLogout();
                }}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
