"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseFilterFromParams,
  patchFilter,
  serializeFilter,
} from "@/lib/filter";
import type { FilterState } from "@/lib/types";

type Ctx = {
  filter: FilterState;
  setFilter: (patch: Partial<FilterState>) => void;
  resetFilter: () => void;
};

const FilterCtx = createContext<Ctx | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => parseFilterFromParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilter = useCallback(
    (patch: Partial<FilterState>) => {
      const next = patchFilter(filter, patch);
      const qs = serializeFilter(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filter, pathname, router],
  );

  const resetFilter = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const value = useMemo(
    () => ({ filter, setFilter, resetFilter }),
    [filter, setFilter, resetFilter],
  );

  return <FilterCtx.Provider value={value}>{children}</FilterCtx.Provider>;
}

export function useFilter(): Ctx {
  const ctx = useContext(FilterCtx);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
