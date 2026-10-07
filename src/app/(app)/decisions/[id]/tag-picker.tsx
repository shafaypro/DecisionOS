"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Text } from "@/components/ui/text";
import { sendJson } from "@/lib/client-fetch";

interface TagOption {
  id: string;
  name: string;
  color: string | null;
}

const DEFAULT_COLOR = "#6366f1";

/** Same tinted-chip treatment as the Tags page, so a tag looks the same everywhere. */
function chipStyle(color: string | null) {
  const c = color ?? DEFAULT_COLOR;
  return { backgroundColor: `${c}18`, borderColor: `${c}40`, color: c };
}

/**
 * Applied tags as removable chips plus an "Add tag" picker of the workspace's
 * remaining tags. Admins create tags on /tags; any writer can apply them here.
 */
export function TagPicker({
  decisionId,
  applied,
  available,
  readOnly,
}: {
  decisionId: string;
  applied: TagOption[];
  available: TagOption[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  // Optimistic copy so a chip appears/disappears immediately.
  const [tags, setTags] = useState(applied);
  const [prevApplied, setPrevApplied] = useState(applied);
  if (applied !== prevApplied) {
    setPrevApplied(applied);
    setTags(applied);
  }

  const appliedIds = new Set(tags.map((t) => t.id));
  const addable = available.filter((t) => !appliedIds.has(t.id));

  function mutate(method: "POST" | "DELETE", tag: TagOption) {
    const before = tags;
    setTags(method === "POST" ? [...tags, tag] : tags.filter((t) => t.id !== tag.id));
    startTransition(async () => {
      const err = await sendJson("/api/decisions/tags", method, { decisionId, tagId: tag.id });
      if (err) {
        setTags(before);
        toast.error(`Could not ${method === "POST" ? "add" : "remove"} tag: ${err}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {tags.map((t) => (
            <li
              key={t.id}
              className="inline-flex h-6 items-center gap-1 rounded-full border pl-2 pr-1"
              style={chipStyle(t.color)}
            >
              <Text as="span" size="xs" color="inherit">{t.name}</Text>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => mutate("DELETE", t)}
                  disabled={pending}
                  aria-label={`Remove tag ${t.name}`}
                  className="rounded-full p-0.5 opacity-70 hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Text as="p" size="xs" color="subtle">No tags yet.</Text>
      )}

      {!readOnly &&
        (available.length === 0 ? (
          <Text as="p" size="xs" color="subtle">
            <Link href="/tags" className="underline hover:text-text-primary">Create workspace tags</Link> to start
            slicing decisions by team, system, or initiative.
          </Text>
        ) : (
          addable.length > 0 && (
            <select
              aria-label="Add tag"
              value=""
              disabled={pending}
              onChange={(e) => {
                const tag = addable.find((t) => t.id === e.target.value);
                if (tag) mutate("POST", tag);
              }}
              className="h-7 w-full rounded-xs bg-white px-2 text-xs text-text-secondary shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">+ Add tag…</option>
              {addable.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )
        ))}
    </div>
  );
}
