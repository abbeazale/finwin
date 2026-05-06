import {
  LayoutDashboard,
  LineChart,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

export const dashboardNavItems: DashboardNavItem[] = [
  { label: "Desk", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Transactions", icon: Wallet, href: "/transactions" },
  { label: "Budgets", icon: Target, href: "/budgets" },
  { label: "Investments", icon: LineChart, href: "/investments" },
  { label: "Settings", icon: Settings, href: "/settings/connections" },
];

export function isDashboardNavItemActive(
  item: DashboardNavItem,
  currentPath: string,
) {
  if (item.href === "/dashboard") {
    return currentPath === item.href;
  }

  return currentPath === item.href || currentPath.startsWith(`${item.href}/`);
}
