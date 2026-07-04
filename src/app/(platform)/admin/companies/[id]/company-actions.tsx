"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

/**
 * Per-company controls on the detail page: rename, enter (impersonate), and
 * suspend / reactivate. All hit the same platform routes the overview uses.
 */
export function CompanyActions({
  workspaceId,
  name,
  slug,
  suspended,
}: {
  workspaceId: string;
  name: string;
  slug: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftSlug, setDraftSlug] = useState(slug);
  const [, startTransition] = useTransition();

  async function enter() {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/workspaces/${workspaceId}/enter`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Request failed");
      window.location.assign("/decisions");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  function patch(body: Record<string, string>, onOk: () => void) {
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/platform/workspaces/${workspaceId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Request failed");
        onOk();
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    });
  }

  function toggleSuspend() {
    // Suspending locks EVERY member of this company out of the app (they're
    // redirected to /suspended). Confirm the blast radius before doing it;
    // reactivating is safe, so it needs no guard.
    if (
      !suspended &&
      !window.confirm(
        `Suspend ${name}? Every member of this company will be locked out until you reactivate it.`,
      )
    ) {
      return;
    }
    patch({ status: suspended ? "active" : "suspended" }, () =>
      toast.success(suspended ? `${name} reactivated` : `${name} suspended`),
    );
  }

  function cancelEdit() {
    setDraftName(name);
    setDraftSlug(slug);
    setEditing(false);
  }

  function saveDetails() {
    const nextName = draftName.trim();
    const nextSlug = draftSlug.trim().toLowerCase();
    if (!nextName) {
      toast.error("Name is required");
      return;
    }
    if (!nextSlug || !/^[a-z0-9-]+$/.test(nextSlug)) {
      toast.error("Slug must contain only lowercase letters, numbers, and hyphens");
      return;
    }
    const body: Record<string, string> = {};
    if (nextName !== name) body.name = nextName;
    if (nextSlug !== slug) body.slug = nextSlug;
    if (Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }
    patch(body, () => {
      toast.success("Company updated");
      setEditing(false);
    });
  }

  function onFieldKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") saveDetails();
    if (e.key === "Escape") cancelEdit();
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Company name"
          value={draftName}
          maxLength={100}
          disabled={busy}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={onFieldKey}
        />
        <Input
          aria-label="Company slug"
          value={draftSlug}
          maxLength={60}
          disabled={busy}
          onChange={(e) => setDraftSlug(e.target.value)}
          onKeyDown={onFieldKey}
        />
        <Button size="sm" disabled={busy} onClick={saveDetails}>
          Save
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={cancelEdit}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} disabled={busy} onClick={() => setEditing(true)}>
        Rename
      </Button>
      <Button variant="secondary" size="sm" icon={<LogIn className="h-3.5 w-3.5" />} disabled={busy} onClick={enter}>
        Enter company
      </Button>
      <Button
        variant={suspended ? "outline" : "destructive"}
        size="sm"
        disabled={busy}
        onClick={toggleSuspend}
      >
        {suspended ? "Reactivate" : "Suspend"}
      </Button>
    </div>
  );
}
