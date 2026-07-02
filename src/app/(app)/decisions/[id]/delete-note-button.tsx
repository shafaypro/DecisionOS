"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteNoteButton({ noteId, isOwner }: { noteId: string; isOwner: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!isOwner) return null;

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this note?")) return;
        startTransition(async () => {
          await fetch("/api/decisions/notes", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteId }),
          });
          router.refresh();
        });
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 disabled:opacity-30"
      title="Delete note"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
