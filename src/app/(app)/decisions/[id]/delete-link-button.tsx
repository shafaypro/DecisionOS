"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteLinkButton({ linkId, isOwner }: { linkId: string; isOwner: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!isOwner) return null;

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this link?")) return;
        startTransition(async () => {
          await fetch("/api/decisions/links", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ linkId }),
          });
          router.refresh();
        });
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 disabled:opacity-30 flex-shrink-0 ml-1"
      title="Remove link"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
