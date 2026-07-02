"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Plus } from "lucide-react";
import { ErrorAlert } from "@/components/ui/error-alert";

interface NoteFormProps {
  decisionId: string;
}

export function NoteForm({ decisionId }: NoteFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const content = (form.elements.namedItem("content") as HTMLTextAreaElement)?.value?.trim();
    if (!content) { setError("Note content is required."); return; }
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/decisions/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, content }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Add note
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add note">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ErrorAlert error={error} />
          <Textarea
            name="content"
            placeholder="Add a note or comment…"
            rows={4}
            required
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add Note"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
