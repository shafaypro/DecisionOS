"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Text } from "@/components/ui/text";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface TagManagerProps {
  decisionId: string;
  appliedTags: Tag[];
  allTags: Tag[];
  readOnly?: boolean;
}

export function TagManager({ decisionId, appliedTags, allTags, readOnly }: TagManagerProps) {
  const [pending, startTransition] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const router = useRouter();

  const appliedIds = new Set(appliedTags.map((t) => t.id));
  const available = allTags.filter((t) => !appliedIds.has(t.id));

  function tagStyle(color: string | null) {
    const c = color ?? "#6366f1";
    return {
      backgroundColor: `${c}18`,
      borderColor: `${c}40`,
      color: c,
    };
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {appliedTags.map((tag) => (
          <div
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 border"
            style={tagStyle(tag.color)}
          >
            <Text>{tag.name}</Text>
            {!readOnly && (
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await fetch("/api/decisions/tags", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ decisionId, tagId: tag.id }),
                    });
                    router.refresh();
                  })
                }
                className="hover:opacity-70 disabled:opacity-30"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}

        {!readOnly && available.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowPicker((p) => !p)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border border-dashed border-slate-300 hover:border-slate-400 transition-colors"
            >
              <Plus className="h-3 w-3" />
              <Text>Add tag</Text>
            </button>
            {showPicker && (
              <div className="absolute left-0 top-7 z-10 w-44 rounded-xs bg-white shadow-soft p-1">
                {available.map((tag) => (
                  <button
                    key={tag.id}
                    disabled={pending}
                    onClick={() => {
                      setShowPicker(false);
                      startTransition(async () => {
                        await fetch("/api/decisions/tags", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ decisionId, tagId: tag.id }),
                        });
                        router.refresh();
                      });
                    }}
                    className="flex items-center gap-2 w-full rounded-xs px-2 py-1.5 hover:bg-slate-50 text-left disabled:opacity-30"
                  >
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color ?? "#6366f1" }}
                    />
                    <Text>{tag.name}</Text>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {appliedTags.length === 0 && available.length === 0 && (
        <Text as="p">No tags defined yet. Create tags in the Tags section.</Text>
      )}
    </div>
  );
}
