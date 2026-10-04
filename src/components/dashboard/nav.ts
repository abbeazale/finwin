import {
  LayoutDashboard,
  LineChart,
  FlaskConical,
  Settings,
  Target,
  ScanLine,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  /** Path prefix that marks the item active, when wider than `href`. */
  match?: string;
};

export const dashboardNavItems: DashboardNavItem[] = [
  { label: "Desk", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Transactions", icon: Wallet, href: "/transactions" },
  { label: "Budgets", icon: Target, href: "/budgets" },
  { label: "Investments", icon: LineChart, href: "/investments" },
  { label: "Screener", icon: ScanLine, href: "/screener" },
  { label: "Sandbox", icon: FlaskConical, href: "/sandbox" },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings/connections",
    match: "/settings",
  },
];

export function isDashboardNavItemActive(
  item: DashboardNavItem,
  currentPath: string,
) {
  if (item.href === "/dashboard") {
    return currentPath === item.href;
  }

  const base = item.match ?? item.href;
  return currentPath === base || currentPath.startsWith(`${base}/`);
}
