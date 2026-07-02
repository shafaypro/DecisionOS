"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteTagButton({ tagId }: { tagId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this tag? It will be removed from all decisions.")) return;
        startTransition(async () => {
          await fetch("/api/tags", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagId }),
          });
          router.refresh();
        });
      }}
      className="text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
      title="Delete tag"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
