"use client";

import { useTransition, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { LINK_TYPES } from "@/lib/utils";
import { AlertCircle, Plus, X } from "lucide-react";
import { Text } from "@/components/ui/text";

interface LinkFormProps {
  decisionId: string;
}

export function LinkForm({ decisionId }: LinkFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full" icon={<Plus className="h-3.5 w-3.5" />}>
        Add Link
      </Button>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const label = (form.elements.namedItem("label") as HTMLInputElement)?.value?.trim();
    const url = (form.elements.namedItem("url") as HTMLInputElement)?.value?.trim();
    const linkType = (form.elements.namedItem("linkType") as HTMLSelectElement)?.value || "other";
    if (!label || !url) { setError("Label and URL are required."); return; }
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/decisions/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, label, url, linkType }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xs p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <Text>Add Resource Link</Text>
        <button type="button" onClick={() => setOpen(false)}>
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
          <Text>{error}</Text>
        </div>
      )}

      <Input
        label="Label"
        fieldClassName="space-y-1"
        name="label"
        placeholder="PR #123 - Feature branch"
        required
        className="h-8"
      />
      <Input
        label="URL"
        fieldClassName="space-y-1"
        name="url"
        type="url"
        placeholder="https://…"
        required
        className="h-8"
      />
      <NativeSelect
        label="Type"
        fieldClassName="space-y-1"
        name="linkType"
        defaultValue="other"
        className="h-8 px-2"
      >
        {LINK_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </NativeSelect>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending} className="flex-1">
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}
