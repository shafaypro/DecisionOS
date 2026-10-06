"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "@/lib/client-fetch";
import { Trash2 } from "lucide-react";

export function DeleteTagButton({ tagId }: { tagId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this tag? It will be removed from all decisions.")) return;
        startTransition(async () => {
          const err = await sendJson("/api/tags", "DELETE", { tagId });
          if (err) toast.error(`Could not delete tag: ${err}`);
          else router.refresh();
        });
      }}
      className="text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
      title="Delete tag"
      aria-label="Delete tag"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
