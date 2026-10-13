import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, LogOut, Menu, Settings } from "lucide-react";
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
  actions?: ReactNode;
};

export function DashboardHeader({
  firstName,
  initials,
  isPending,
  currentPath,
  onLogout,
  actions,
}: DashboardHeaderProps) {
  const currentItem = dashboardNavItems.find((item) =>
    isDashboardNavItemActive(item, currentPath),
  );

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--stroke)] bg-[rgba(10,10,9,0.8)] px-6 py-3 backdrop-blur-xl backdrop-saturate-150 lg:px-10">
      <div className="flex items-center gap-4">
        <div className="lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-[10px] border border-[var(--stroke-2)] text-bone-mute shadow-none hover:border-[var(--stroke-3)] hover:text-bone"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-56 rounded-[14px] border-[var(--stroke-2)] bg-[var(--ink-1)] p-1.5 text-bone shadow-2xl"
            >
              <DropdownMenuLabel className="display px-2 py-2 text-[18px] font-normal text-bone">
                Fin<span className="italic text-brass">Win</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--stroke)]" />
              <DropdownMenuGroup>
                {dashboardNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isDashboardNavItemActive(item, currentPath);
                  const className = `gap-3 rounded-[10px] px-2.5 py-2.5 text-[14px] ${
                    active
                      ? "bg-[rgba(201,164,107,0.08)] text-brass-hi focus:bg-[rgba(201,164,107,0.08)] focus:text-brass-hi"
                      : "text-bone-mute focus:bg-[var(--ink-2-solid)] focus:text-bone"
                  }`;

                  return (
                    <DropdownMenuItem key={item.label} asChild className={className}>
                      <Link href={item.href} aria-current={active ? "page" : undefined}>
                        <Icon className="size-3.5" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Link
          href="/"
          className="display text-[23px] leading-none text-bone lg:hidden"
        >
          Fin<span className="italic text-brass">Win</span>
        </Link>
        <span className="display hidden text-[16px] italic leading-none text-bone-faint lg:inline">
          {currentItem?.label ?? "FinWin"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-[38px] gap-1.5 rounded-full border border-[var(--stroke-2)] pl-1 pr-2.5 text-bone-mute shadow-none hover:border-[var(--stroke-3)] hover:text-bone"
              aria-label="Account menu"
            >
              <span className="flex size-7 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.08)] text-[10.5px] font-medium text-brass-hi">
                {initials}
              </span>
              <ChevronDown className="size-3.5 text-bone-mute" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48 rounded-[14px] p-1.5">
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
