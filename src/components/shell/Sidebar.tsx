"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import {
  LayoutDashboard,
  Route,
  Truck,
  BarChart3,
  Settings,
  PackageSearch,
  Bus,
  Target,
  Map,
  Waypoints,
  ChevronDown,
  ChevronRight,
  type LucideProps,
} from "lucide-react";
import { useSidebar } from "./SidebarContext";

type Icon = ComponentType<LucideProps>;

type NavChild = { label: string; href: string };
type NavItem = {
  label: string;
  href?: string;
  icon: Icon;
  children?: NavChild[];
};

const NAV: NavItem[] = [
  { label: "Tổng Quan", href: "/", icon: LayoutDashboard },
  { label: "Hành Trình Đơn", href: "/journey", icon: PackageSearch },
  { label: "Gán đơn", href: "/routing", icon: Route },
  { label: "Mạng lưới BC", href: "/network", icon: Truck },
  { label: "Phạm vi BC", href: "/coverage", icon: Map },
  { label: "Tuyến Tải", href: "/transport", icon: Bus },
  { label: "Bản đồ chuyến tải", href: "/route-map", icon: Waypoints },
  { label: "Quản lý mục tiêu", href: "/targets", icon: Target },
  {
    label: "Báo cáo",
    icon: BarChart3,
    children: [
      { label: "Daily ops", href: "/reports/daily" },
      { label: "Weekly KPI", href: "/reports/weekly" },
    ],
  },
  {
    label: "Cài đặt",
    icon: Settings,
    children: [
      { label: "Tải dữ liệu", href: "/settings/upload" },
    ],
  },
];

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Báo cáo": false,
  });

  return (
    <aside
      className={[
        "shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]",
        "transition-[width] duration-150 ease-out",
        collapsed ? "w-14" : "w-60",
      ].join(" ")}
    >
      <nav className="py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const hasChildren = !!item.children?.length;
          const active = isActive(pathname, item.href);
          const groupOpen = openGroups[item.label] ?? false;
          const childActive = item.children?.some((c) =>
            isActive(pathname, c.href),
          );

          if (!hasChildren) {
            return (
              <Link
                key={item.label}
                href={item.href ?? "#"}
                className={[
                  "flex items-center gap-3 px-4 py-2.5 text-sm",
                  "border-l-2",
                  active
                    ? "bg-[var(--color-ghn-red-soft)] text-[var(--color-ghn-red)] border-[var(--color-ghn-red)] font-medium"
                    : "border-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]",
                ].join(" ")}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          }

          return (
            <div key={item.label}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((s) => ({ ...s, [item.label]: !groupOpen }))
                }
                className={[
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm",
                  "border-l-2 border-transparent",
                  childActive
                    ? "text-[var(--color-ghn-red)] font-medium"
                    : "text-[var(--color-text)] hover:bg-[var(--color-hover)]",
                ].join(" ")}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">
                      {item.label}
                    </span>
                    {groupOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    )}
                  </>
                )}
              </button>

              {!collapsed && groupOpen && (
                <div className="pb-1">
                  {item.children!.map((child) => {
                    const cActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={[
                          "flex items-center pl-12 pr-4 py-2 text-sm border-l-2",
                          cActive
                            ? "bg-[var(--color-ghn-red-soft)] text-[var(--color-ghn-red)] border-[var(--color-ghn-red)] font-medium"
                            : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                        ].join(" ")}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
