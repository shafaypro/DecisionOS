"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { History, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatRelativeDate } from "@/lib/utils";

interface Version {
  id: string;
  versionNum: number;
  snapshotJson: string;
  createdAt: string;
  changedBy: { id: string; name: string };
}

interface VersionSnapshot {
  title?: string;
  status?: string;
  category?: string;
  summary?: string;
  impactLevel?: string;
}

interface VersionHistoryProps {
  decisionId: string;
}

function diffLabels(snap: VersionSnapshot): string[] {
  const labels: string[] = [];
  if (snap.title) labels.push(`Title: "${snap.title}"`);
  if (snap.status) labels.push(`Status: ${snap.status}`);
  return labels;
}

export function VersionHistory({ decisionId }: VersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  function loadVersions() {
    setLoading(true);
    fetch(`/api/decisions/${decisionId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .finally(() => setLoading(false));
  }

  function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) loadVersions();
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleOpen}
        icon={<History className="h-4 w-4" />}
        iconRight={open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      >
        Version History
      </Button>

      {open && (
        <div className="rounded-xs transition-all duration-200 mt-4">
          <div className={cn("p-6 pt-0", "p-4")}>
            <div className="flex items-center justify-between mb-3">
              <Text as="h4">Edit History</Text>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <Text as="p">Loading...</Text>
            ) : versions.length === 0 ? (
              <Text as="p">No version history yet.</Text>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => {
                  let snap: VersionSnapshot = {};
                  try { snap = JSON.parse(v.snapshotJson); } catch { /* empty */ }
                  const isExpanded = expanded === v.id;
                  return (
                    <div key={v.id} className="border border-slate-100 rounded-xs p-3">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpanded(isExpanded ? null : v.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Text>v{v.versionNum}</Text>
                          <Text>by {v.changedBy.name}</Text>
                          <Text>{formatRelativeDate(v.createdAt)}</Text>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <Text as="p">Snapshot before this edit:</Text>
                          <div className="space-y-1">
                            {snap.title && <Text as="p"><Text>Title:</Text> {snap.title}</Text>}
                            {snap.status && <Text as="p"><Text>Status:</Text> {snap.status}</Text>}
                            {snap.category && <Text as="p"><Text>Category:</Text> {snap.category}</Text>}
                            {snap.impactLevel && <Text as="p"><Text>Impact:</Text> {snap.impactLevel}</Text>}
                            {snap.summary && (
                              <Text as="p"><Text>Summary:</Text> {snap.summary}</Text>
                            )}
                            {diffLabels(snap).length === 0 && (
                              <Text as="p">No displayable snapshot data</Text>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
