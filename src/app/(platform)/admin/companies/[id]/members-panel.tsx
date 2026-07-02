"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, User } from "lucide-react";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

export interface MemberRow {
  membershipId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
}

const ROLE_TONE: Record<string, string> = {
  admin: "bg-blue-50 text-blue-700 border-blue-200",
  viewer: "bg-amber-50 text-amber-700 border-amber-200",
  member: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/**
 * Company member roster for the platform console, styled to match the in-app
 * Team page. Removal goes through the platform API (last-admin guarded + audited).
 */
export function MembersPanel({ workspaceId, members }: { workspaceId: string; members: MemberRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(m: MemberRow) {
    if (!window.confirm(`Remove ${m.name} from this workspace?`)) return;
    setBusy(m.membershipId);
    try {
      const res = await fetch(`/api/platform/workspaces/${workspaceId}/members/${m.membershipId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      toast.success("Member removed.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="divide-y divide-slate-100">
      {members.map((m) => (
        <div
          key={m.membershipId}
          className="group flex flex-col gap-4 px-6 py-4 transition-colors duration-200 hover:bg-slate-50/80 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#dbeafe] shadow-soft">
              <Text size="base" weight="semibold" color="brand">
                {m.name.charAt(0).toUpperCase()}
              </Text>
            </div>
            <div className="min-w-0">
              <Text size="sm" weight="medium" color="primary">
                {m.name}
              </Text>
              <Text as="p" size="sm" color="muted">
                {m.email}
              </Text>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Text size="2xs" color="muted">
              Joined {formatDate(m.joinedAt)}
            </Text>
            <Badge className={ROLE_TONE[m.role] ?? ROLE_TONE.member}>
              {m.role === "admin" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {m.role}
            </Badge>
            <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => remove(m)}>
              {busy === m.membershipId ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
