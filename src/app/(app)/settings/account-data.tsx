"use client";

import { useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/**
 * GDPR self-serve controls: download a copy of your personal data, delete the
 * whole workspace (admin), and delete your account. Deletions require typing a
 * confirmation phrase and hit the REST routes; on success the session is gone so
 * we send the user to /login.
 */
export function AccountData({ isAdmin, workspaceName }: { isAdmin: boolean; workspaceName: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<null | "account" | "workspace">(null);
  const [confirmText, setConfirmText] = useState("");

  const phrase = deleting === "workspace" ? workspaceName : "DELETE";

  async function runDelete() {
    if (confirmText !== phrase) {
      toast.error(`Type "${phrase}" to confirm.`);
      return;
    }
    const url = deleting === "workspace" ? "/api/settings/workspace" : "/api/account";
    setBusy(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Request failed");
      window.location.assign("/login");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  function openDelete(which: "account" | "workspace") {
    setConfirmText("");
    setDeleting(which);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Text as="p" weight="medium">Download your data</Text>
          <Text as="p" color="muted">A machine-readable JSON copy of your account and contributions.</Text>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={() => window.location.assign("/api/account/export")}
        >
          Download my data
        </Button>
      </div>

      <div className="rounded-xs border border-red-200 bg-red-50/50 p-4 space-y-3">
        <Text as="p" weight="semibold" className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Danger zone
        </Text>
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Text as="p" color="muted">Permanently delete this workspace and all of its decisions and members.</Text>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => openDelete("workspace")}>
              Delete workspace
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text as="p" color="muted">Permanently delete your account and personal data.</Text>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => openDelete("account")}>
            Delete my account
          </Button>
        </div>
      </div>

      <Modal
        open={deleting !== null}
        onClose={() => !busy && setDeleting(null)}
        title={deleting === "workspace" ? "Delete workspace" : "Delete account"}
      >
        <Text as="p">
          This is permanent and cannot be undone. {deleting === "workspace"
            ? "All decisions, members, and data in this workspace will be erased."
            : "Your account and all your personal data will be erased."}
        </Text>
        <Text as="p" color="muted">
          Type <Text as="span" weight="semibold" mono>{phrase}</Text> to confirm.
        </Text>
        <Input
          aria-label="Confirmation"
          value={confirmText}
          disabled={busy}
          onChange={(e) => setConfirmText(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="destructive" size="sm" disabled={busy || confirmText !== phrase} onClick={runDelete}>
            {busy ? "Deleting…" : "Permanently delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
