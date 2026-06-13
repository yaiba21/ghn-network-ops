"use client";

import { Menu, Bell } from "lucide-react";
import { Logo } from "../Logo";
import { useSidebar } from "./SidebarContext";

export function TopBar() {
  const { toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-30 h-14 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-3 gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle sidebar"
        className="p-2 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)]"
      >
        <Menu className="w-4 h-4" />
      </button>

      <Logo />

      <div className="ml-3 pl-3 border-l border-[var(--color-border)] text-sm font-medium text-[var(--color-text)]">
        Network Ops
      </div>

      <div className="flex-1" />

      <button
        type="button"
        aria-label="Notifications"
        className="relative p-2 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)]"
      >
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-ghn-red)]" />
      </button>

      <div className="w-8 h-8 rounded-full bg-[var(--color-ghn-red)] text-white text-xs font-semibold flex items-center justify-center">
        VP
      </div>
    </header>
  );
}
