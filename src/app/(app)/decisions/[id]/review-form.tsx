"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";
import { OUTCOME_STATUSES } from "@/lib/utils";
import { Plus } from "lucide-react";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Text } from "@/components/ui/text";

interface ReviewFormProps {
  decisionId: string;
}

export function ReviewForm({ decisionId }: ReviewFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const outcomeStatus = (form.elements.namedItem("outcomeStatus") as HTMLSelectElement)?.value;
    const summary = (form.elements.namedItem("summary") as HTMLTextAreaElement)?.value?.trim() || null;
    const lessonsLearned = (form.elements.namedItem("lessonsLearned") as HTMLTextAreaElement)?.value?.trim() || null;
    const followUpAction = (form.elements.namedItem("followUpAction") as HTMLTextAreaElement)?.value?.trim() || null;

    if (!outcomeStatus) { setError("Outcome status is required."); return; }
    setError(undefined);

    startTransition(async () => {
      const res = await fetch("/api/decisions/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, outcomeStatus, summary, lessonsLearned, followUpAction }),
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
        Submit review
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Submit review">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ErrorAlert error={error} />

          <NativeSelect
            label={<>Outcome <Text>*</Text></>}
            id="outcomeStatus"
            name="outcomeStatus"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select outcome…
            </option>
            {OUTCOME_STATUSES.filter((o) => o.value !== "unknown").map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>

          <Textarea
            label="What happened?"
            id="summary"
            name="summary"
            rows={3}
            placeholder="Summarize how the decision played out in practice"
          />

          <Textarea
            label="Lessons Learned"
            id="lessonsLearned"
            name="lessonsLearned"
            rows={2}
            placeholder="What would you do differently? What worked well?"
          />

          <Textarea
            label="Follow-up Action"
            id="followUpAction"
            name="followUpAction"
            rows={2}
            placeholder="Any follow-on decisions or actions needed?"
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit Review"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
