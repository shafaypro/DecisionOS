"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "@/lib/client-fetch";

export function RemoveRelationButton({ decisionId, relationId }: { decisionId: string; relationId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this relation?")) return;
        startTransition(async () => {
          const err = await sendJson(`/api/decisions/${decisionId}/relations`, "DELETE", { relationId });
          if (err) toast.error(`Could not remove relation: ${err}`);
          else router.refresh();
        });
      }}
      aria-label="Remove relation"
      title="Remove relation"
      className="ml-1 inline-flex align-middle text-slate-400 opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
    >
      <X className="h-3 w-3" />
    </button>
  );
}
