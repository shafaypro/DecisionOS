"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";
import { Plus } from "lucide-react";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Text } from "@/components/ui/text";
import { RELATION_TYPES } from "@/lib/utils";

interface Decision {
  id: string;
  title: string;
}

interface RelationFormProps {
  decisionId: string;
  workspaceDecisions: Decision[];
}

export function RelationForm({ decisionId, workspaceDecisions }: RelationFormProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toDecisionId, setToDecisionId] = useState("");
  const [relationType, setRelationType] = useState("relates_to");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = workspaceDecisions.filter(
    (d) => d.id !== decisionId && d.title.toLowerCase().includes(search.toLowerCase())
  );

  function close() {
    setOpen(false);
    setSearch("");
    setToDecisionId("");
    setError(undefined);
  }

  function submit() {
    if (!toDecisionId) { setError("Please select a decision."); return; }
    setError(undefined);
    startTransition(async () => {
      const res = await fetch(`/api/decisions/${decisionId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toDecisionId, relationType }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        close();
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Add relation
      </Button>

      <Modal open={open} onClose={close} title="Add relation">
        <div className="space-y-4">
          <ErrorAlert error={error} />

          <NativeSelect
            label="Relation type"
            value={relationType}
            onChange={(e) => setRelationType(e.target.value)}
          >
            {RELATION_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </NativeSelect>

          <div>
            <Input
              label="Search decisions"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setToDecisionId(""); }}
              placeholder="Type to search..."
            />
            {search && (
              <div className="max-h-48 overflow-y-auto rounded-xs bg-white divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <Text as="p">No matching decisions</Text>
                ) : (
                  filtered.slice(0, 10).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => { setToDecisionId(d.id); setSearch(d.title); }}
                      className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${toDecisionId === d.id ? "bg-blue-50" : ""}`}
                    >
                      <Text>
                        {d.title}
                      </Text>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" disabled={pending || !toDecisionId} onClick={submit}>
              Add
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
