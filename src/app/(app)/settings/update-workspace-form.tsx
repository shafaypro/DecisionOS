"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";

interface UpdateWorkspaceFormProps {
  currentName: string;
  currentSlug: string;
}

export function UpdateWorkspaceForm({ currentName, currentSlug }: UpdateWorkspaceFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value?.trim();
    const slug = (form.elements.namedItem("slug") as HTMLInputElement)?.value?.trim().toLowerCase();
    if (!name || !slug) { setError("Name and slug are required"); return; }
    setError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(data.success);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xs px-4 py-3">
          <AlertCircle className="h-4 w-4 text-text-danger" />
          <Text>{error}</Text>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xs px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-text-success" />
          <Text>{success}</Text>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Workspace Name"
          id="name"
          name="name"
          defaultValue={currentName}
          required
        />
        <Input
          label="Slug"
          id="slug"
          name="slug"
          defaultValue={currentSlug}
          required
          pattern="[a-z0-9-]+"
          hint="Lowercase letters, numbers, and hyphens only"
        />
      </div>

      <Button type="submit" disabled={pending} icon={<Save className="h-4 w-4" />}>
        {pending ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  );
}
