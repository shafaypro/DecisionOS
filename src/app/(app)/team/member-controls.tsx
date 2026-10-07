"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "@/lib/client-fetch";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer (read-only)" },
] as const;

/** Admin-only role picker and remove button for one membership row. */
export function MemberControls({
  membershipId,
  name,
  role,
}: {
  membershipId: string;
  name: string;
  role: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(role);

  function changeRole(next: string) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const err = await sendJson(`/api/team/${membershipId}`, "PATCH", { role: next });
      if (err) {
        setValue(previous);
        toast.error(err);
      } else {
        toast.success(`${name} is now ${next === "admin" ? "an admin" : `a ${next}`}.`);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!confirm(`Remove ${name} from this workspace? Their decisions, notes, and reviews stay.`)) return;
    startTransition(async () => {
      const err = await sendJson(`/api/team/${membershipId}`, "DELETE", undefined);
      if (err) toast.error(err);
      else {
        toast.success(`${name} was removed.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={`Role for ${name}`}
        value={value}
        disabled={pending}
        onChange={(e) => changeRole(e.target.value)}
        className="h-8 rounded-xs bg-white px-2 text-xs text-text-secondary shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={remove}
        aria-label={`Remove ${name}`}
        title={`Remove ${name}`}
        icon={<UserMinus className="h-4 w-4" />}
      />
    </div>
  );
}
