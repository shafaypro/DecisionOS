"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Network, ChevronDown, ChevronUp, X, Trash2 } from "lucide-react";
import { cn, RELATION_TYPES, getLabelForValue } from "@/lib/utils";

interface RelatedDecision {
  id: string;
  title: string;
  status: string;
  category: string;
}

interface Relation {
  id: string;
  relationType: string;
  createdByUserId: string;
  fromDecision?: RelatedDecision;
  toDecision?: RelatedDecision;
}

interface RelationGraphProps {
  decisionId: string;
  currentUserId: string;
  isAdmin: boolean;
}

export function RelationGraph({ decisionId, currentUserId, isAdmin }: RelationGraphProps) {
  const [open, setOpen] = useState(false);
  const [fromRelations, setFromRelations] = useState<Relation[]>([]);
  const [toRelations, setToRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function loadRelations() {
    setLoading(true);
    fetch(`/api/decisions/${decisionId}/relations`)
      .then((r) => r.json())
      .then((data) => {
        setFromRelations(data.fromRelations ?? []);
        setToRelations(data.toRelations ?? []);
      })
      .finally(() => setLoading(false));
  }

  async function deleteRelation(relationId: string) {
    setDeleting(relationId);
    await fetch(`/api/decisions/${decisionId}/relations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationId }),
    });
    setDeleting(null);
    loadRelations();
  }

  const totalCount = fromRelations.length + toRelations.length;
  function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) loadRelations();
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleOpen}
        icon={<Network className="h-4 w-4" />}
        iconRight={open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      >
        Relations {totalCount > 0 && totalCount}
      </Button>

      {open && (
        <div className="rounded-xs transition-all duration-200 mt-4">
          <div className={cn("p-6 pt-0", "p-4")}>
            <div className="flex items-center justify-between mb-4">
              <Text as="h4">Decision Relations</Text>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <Text as="p">Loading...</Text>
            ) : totalCount === 0 ? (
              <Text as="p">No relations yet. Add one below.</Text>
            ) : (
              <div className="space-y-4">
                {fromRelations.length > 0 && (
                  <div>
                    <Text as="p">This decision…</Text>
                    <div className="space-y-2">
                      {fromRelations.map((rel) => (
                        <div key={rel.id} className="flex items-center gap-2 group">
                          <Text>
                            {getLabelForValue(RELATION_TYPES, rel.relationType)}
                          </Text>
                          <Link
                            href={`/decisions/${rel.toDecision!.id}`}
                            className="flex-1 min-w-0 group/link text-text-secondary group-hover/link:text-text-brand"
                          >
                            <Text>{rel.toDecision!.title}</Text>
                          </Link>
                          <Text>
                            {rel.toDecision!.status}
                          </Text>
                          {(rel.createdByUserId === currentUserId || isAdmin) && (
                            <button
                              onClick={() => deleteRelation(rel.id)}
                              disabled={deleting === rel.id}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {toRelations.length > 0 && (
                  <div>
                    <Text as="p">Referenced by…</Text>
                    <div className="space-y-2">
                      {toRelations.map((rel) => (
                        <div key={rel.id} className="flex items-center gap-2">
                          <Link
                            href={`/decisions/${rel.fromDecision!.id}`}
                            className="flex-1 min-w-0 group/link text-text-secondary group-hover/link:text-text-brand"
                          >
                            <Text>{rel.fromDecision!.title}</Text>
                          </Link>
                          <Text>
                            {getLabelForValue(RELATION_TYPES, rel.relationType)} this
                          </Text>
                          <Text>
                            {rel.fromDecision!.status}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
