"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Text } from "@/components/ui/text";

export function InviteMemberForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value?.trim();
    const role = (form.elements.namedItem("role") as HTMLSelectElement)?.value || "member";

    if (!email) {
      setError("Email is required");
      return;
    }

    setError(undefined);
    setSuccess(undefined);

    startTransition(async () => {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      setSuccess(data.success);
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
      {error && (
        <div className="flex items-center gap-2 rounded-xs border border-red-200 bg-red-50 px-3 py-2 lg:col-span-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-text-danger" />
          <Text>{error}</Text>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xs border border-emerald-200 bg-emerald-50 px-3 py-2 lg:col-span-3">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-text-success" />
          <Text>{success}</Text>
        </div>
      )}

      <Input
        label="Email address"
        id="email"
        name="email"
        type="email"
        placeholder="teammate@company.com"
        required
        className="h-10"
        fieldClassName="min-w-0 space-y-2"
      />

      <NativeSelect
        label="Role"
        id="role"
        name="role"
        defaultValue="member"
        className="h-10 font-medium"
        fieldClassName="space-y-2"
      >
        <option value="member">Member</option>
        <option value="viewer">Viewer (read-only)</option>
        <option value="admin">Admin</option>
      </NativeSelect>

      <div className="flex lg:justify-end">
        <Button type="submit" disabled={pending} className="h-10 w-full px-4 lg:w-auto">
          <UserPlus className="h-4 w-4" />
          {pending ? "Inviting..." : "Invite"}
        </Button>
      </div>
    </form>
  );
}
