"use client";
import { getFactStats } from "@/lib/mock-data";
import { useMemo } from "react";

export default function DebugPage() {
  const stats = useMemo(() => getFactStats(), []);
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Phase 1 — Fact Stats</h1>
      <pre className="bg-gray-100 p-4 rounded font-mono text-xs overflow-auto">
        {JSON.stringify(stats, null, 2)}
      </pre>
    </div>
  );
}
