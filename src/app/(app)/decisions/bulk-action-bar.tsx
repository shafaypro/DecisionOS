"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Archive, Download, X, CheckSquare } from "lucide-react";
import { Text } from "@/components/ui/text";

interface Decision {
  id: string;
  title: string;
  status: string;
  category: string;
  impactLevel: string;
  summary: string | null;
}

interface BulkActionBarProps {
  selectedIds: string[];
  decisions: Decision[];
  onClear: () => void;
  onDone: () => void;
}

export function BulkActionBar({ selectedIds, decisions, onClear, onDone }: BulkActionBarProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function archive() {
    if (!confirm(`Archive ${selectedIds.length} decision(s)?`)) return;
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/decisions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", ids: selectedIds }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      onDone();
    });
  }

  function exportSelected() {
    const selected = decisions.filter((d) => selectedIds.includes(d.id));
    // Build CSV
    const headers = ["id", "title", "status", "category", "impactLevel", "summary"];
    const rows = selected.map((d) =>
      headers.map((h) => {
        const val = (d as unknown as Record<string, unknown>)[h] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decisions-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 rounded-xs shadow-soft px-5 py-3">
      <CheckSquare className="h-4 w-4 text-blue-400" />
      <Text>{selectedIds.length} selected</Text>
      <div className="h-4 w-px bg-slate-600" />
      <Button
        size="sm"
        variant="ghost"
        className="text-white hover:text-white hover:bg-slate-700"
        disabled={pending}
        onClick={archive}
        icon={<Archive className="h-4 w-4" />}
      >
        Archive
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-white hover:text-white hover:bg-slate-700"
        onClick={exportSelected}
        icon={<Download className="h-4 w-4" />}
      >
        Export CSV
      </Button>
      {error && <Text>{error}</Text>}
      <button onClick={onClear} aria-label="Clear selection" className="text-slate-400 hover:text-white ml-2">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
