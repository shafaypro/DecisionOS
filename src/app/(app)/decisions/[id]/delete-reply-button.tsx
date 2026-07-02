"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

interface DeleteReplyButtonProps {
  replyId: string;
  isOwner: boolean;
}

export function DeleteReplyButton({ replyId, isOwner }: DeleteReplyButtonProps) {
  const [pending, startTransition] = useTransition();

  if (!isOwner) return null;

  function handleDelete() {
    startTransition(async () => {
      await fetch("/api/decisions/notes/replies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId }),
      });
      window.location.reload();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-xs hover:bg-red-50 text-slate-400 hover:text-red-500"
      title="Delete reply"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
