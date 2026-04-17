import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { ConnectBank } from "@/components/connect-bank";
import { RefreshTransactions } from "@/components/refresh-transactions";
import { Button } from "@/components/ui/button";
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
  onLogout: () => void;
  onRefreshed: (t: { added: number; modified: number; removed: number }) => void;
  onConnected: (result: { accountCount: number }) => void;
};

export function DashboardHeader({
  firstName,
  initials,
  isPending,
  onLogout,
  onRefreshed,
  onConnected,
}: DashboardHeaderProps) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--stroke)] bg-[var(--ink-0)]/80 px-6 py-3 smoked">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
          <span className="label-eyebrow-brass">Live · market open</span>
        </div>
        <span className="label-eyebrow hidden lg:inline">NYSE 09:41 · PST 06:41</span>
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
