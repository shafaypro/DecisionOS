"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Globe, Link2Off, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";

/**
 * Share control for one decision. Public links are opt-in: nothing is public
 * until someone creates a link here, and the link can be revoked at any time.
 */
export function SharePanel({
  decisionId,
  initialUrl,
  sharingEnabled,
  isPrivate,
}: {
  decisionId: string;
  initialUrl: string | null;
  sharingEnabled: boolean;
  isPrivate: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on Esc or a click outside, like any other popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Your browser may have blocked clipboard access");
    }
  }

  function request(method: "POST" | "DELETE") {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/decisions/${decisionId}/share`, { method });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "Something went wrong.");
          return;
        }
        if (method === "POST" && data.url) {
          setUrl(data.url);
          await copy(data.url);
          toast.success("Public link created and copied");
        } else {
          setUrl(null);
          toast.success("Public link revoked. The old URL no longer works.");
        }
        router.refresh();
      } catch {
        toast.error("Could not reach the server.");
      }
    });
  }

  const blockedReason = isPrivate
    ? "This decision is private, so it can't have a public link."
    : !sharingEnabled
    ? "An admin has turned public links off for this workspace."
    : null;

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        title={url ? "Shared publicly - manage link" : "Share"}
        aria-label="Share"
        aria-expanded={open}
        icon={url ? <Globe className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
      />
      {open && (
        <div
          role="dialog"
          aria-label="Share this decision"
          className="absolute right-0 top-10 z-20 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xs bg-white p-4 shadow-soft"
        >
          <div className="flex items-center justify-between gap-2">
            <Text as="p" weight="medium">Teammates</Text>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(`${window.location.origin}/decisions/${decisionId}`)}
              icon={<Copy className="h-3.5 w-3.5" />}
            >
              Copy link
            </Button>
          </div>
          <hr className="border-slate-100" />
          <div className="space-y-2">
            <Text as="p" weight="medium">Public read-only link</Text>
            {url ? (
              <>
                <Text as="p" size="xs" color="muted">
                  Anyone with this link can read the decision without signing in.
                </Text>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={url}
                    aria-label="Public link"
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-8 min-w-0 flex-1 rounded-xs bg-slate-50 px-2 font-mono text-xs text-text-secondary"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(url)}
                    aria-label="Copy public link"
                    icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => request("DELETE")}
                  className="text-red-600 hover:text-red-700"
                  icon={<Link2Off className="h-3.5 w-3.5" />}
                >
                  Stop sharing
                </Button>
              </>
            ) : blockedReason ? (
              <Text as="p" size="xs" color="muted">{blockedReason}</Text>
            ) : (
              <>
                <Text as="p" size="xs" color="muted">
                  Off. Create a link to show this decision to someone outside the workspace. You can revoke it anytime.
                </Text>
                <Button size="sm" disabled={pending} onClick={() => request("POST")} icon={<Globe className="h-3.5 w-3.5" />}>
                  {pending ? "Creating…" : "Create public link"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
