"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SidebarCtx = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

const Ctx = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Ctx.Provider
      value={{
        collapsed,
        toggle: () => setCollapsed((v) => !v),
        setCollapsed,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
