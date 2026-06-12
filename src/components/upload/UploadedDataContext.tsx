"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UploadedDatasetKey } from "@/lib/upload-templates";

const LS_PREFIX = "ghn:upload:";

type Store = Record<UploadedDatasetKey, unknown[] | undefined>;

const EMPTY_STORE: Store = {
  "ops-scorecard": undefined,
  "cost-by-category": undefined,
  "lane-perf": undefined,
  "ktc-status": undefined,
};

type Ctx = {
  store: Store;
  set: <T>(key: UploadedDatasetKey, rows: T[]) => void;
  clear: (key: UploadedDatasetKey) => void;
  clearAll: () => void;
  // Helper accessor with generic return type.
  get: <T>(key: UploadedDatasetKey) => T[] | undefined;
};

const UploadCtx = createContext<Ctx | null>(null);

function readFromLocalStorage(): Store {
  if (typeof window === "undefined") return EMPTY_STORE;
  const next: Store = { ...EMPTY_STORE };
  (Object.keys(EMPTY_STORE) as UploadedDatasetKey[]).forEach((k) => {
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + k);
      if (raw) next[k] = JSON.parse(raw);
    } catch {
      // ignore parse errors
    }
  });
  return next;
}

export function UploadedDataProvider({ children }: { children: ReactNode }) {
  // SSR: start with empty store so server + client render the same tree.
  // Hydration: after mount, read from localStorage.
  const [store, setStore] = useState<Store>(EMPTY_STORE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(readFromLocalStorage());
    setHydrated(true);

    // Sync across tabs.
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith(LS_PREFIX)) return;
      setStore(readFromLocalStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = useCallback<Ctx["set"]>((key, rows) => {
    setStore((prev) => {
      const next = { ...prev, [key]: rows };
      try {
        window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(rows));
      } catch {
        // localStorage full / unavailable — ignore
      }
      return next;
    });
  }, []);

  const clear = useCallback<Ctx["clear"]>((key) => {
    setStore((prev) => {
      const next = { ...prev, [key]: undefined };
      try {
        window.localStorage.removeItem(LS_PREFIX + key);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearAll = useCallback<Ctx["clearAll"]>(() => {
    setStore(EMPTY_STORE);
    try {
      (Object.keys(EMPTY_STORE) as UploadedDatasetKey[]).forEach((k) =>
        window.localStorage.removeItem(LS_PREFIX + k),
      );
    } catch {
      // ignore
    }
  }, []);

  const get = useCallback<Ctx["get"]>(
    <T,>(key: UploadedDatasetKey) =>
      hydrated ? (store[key] as T[] | undefined) : undefined,
    [store, hydrated],
  );

  const value = useMemo<Ctx>(
    () => ({ store, set, clear, clearAll, get }),
    [store, set, clear, clearAll, get],
  );

  return <UploadCtx.Provider value={value}>{children}</UploadCtx.Provider>;
}

export function useUploadedData(): Ctx {
  const ctx = useContext(UploadCtx);
  if (!ctx)
    throw new Error("useUploadedData must be used within UploadedDataProvider");
  return ctx;
}

/** Convenience hook — returns uploaded rows or undefined. */
export function useUploadedRows<T>(key: UploadedDatasetKey): T[] | undefined {
  const { get } = useUploadedData();
  return get<T>(key);
}
