"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "@/lib/client-fetch";
import { Trash2 } from "lucide-react";

export function DeleteNoteButton({ noteId, isOwner }: { noteId: string; isOwner: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  if (!isOwner) return null;

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this note?")) return;
        startTransition(async () => {
          const err = await sendJson("/api/decisions/notes", "DELETE", { noteId });
          if (err) toast.error(`Could not delete note: ${err}`);
          else router.refresh();
        });
      }}
      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-slate-400 hover:text-red-500 disabled:opacity-30"
      title="Delete note"
      aria-label="Delete note"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
