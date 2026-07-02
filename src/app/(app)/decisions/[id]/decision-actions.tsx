"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import {
  Quote, Check, Share2, GitBranch, AlertCircle, Archive, History,
} from "lucide-react";

interface DecisionLite {
  id: string;
  title: string;
}

interface Props {
  decisionId: string;
  title: string;
  rationale: string | null;
  capturedBy: string;
  capturedOn: string; // already-formatted date string from the server
  status: string;
  workspaceDecisions: DecisionLite[];
}

/**
 * The decision-detail header action bar: Cite why, Share, Supersede, Archive,
 * History, Edit. One client component because every action needs browser-only
 * behavior (clipboard, modal state, navigation) that can't live in the server
 * page.
 */
export function DecisionActions({
  decisionId,
  title,
  rationale,
  capturedBy,
  capturedOn,
  status,
  workspaceDecisions,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [citeCopied, setCiteCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [supersedeOpen, setSupersedeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toDecisionId, setToDecisionId] = useState("");
  const [supersedeError, setSupersedeError] = useState<string | undefined>();
  const [supersedePending, startSupersede] = useTransition();

  const [archivePending, startArchive] = useTransition();

  const canSupersede = status !== "archived" && status !== "superseded";
  const canArchive = status !== "archived";
  const hasRationale = Boolean(rationale?.trim());

  function buildCitation(): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/share/${decisionId}`;
    const lines: string[] = [];
    lines.push(`> **Why:** ${title}`);
    lines.push(">");
    if (rationale?.trim()) {
      for (const line of rationale.trim().split(/\r?\n/)) {
        lines.push(`> ${line}`);
      }
      lines.push(">");
    } else {
      lines.push("> _(no rationale captured yet)_");
      lines.push(">");
    }
    lines.push(`> Captured by ${capturedBy} on ${capturedOn} · [view decision](${url})`);
    return lines.join("\n");
  }

  async function handleCite() {
    try {
      await navigator.clipboard.writeText(buildCitation());
      setCiteCopied(true);
      toast.success("Why citation copied. Paste into Linear, PRs, docs");
      setTimeout(() => setCiteCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Your browser may have blocked clipboard access");
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${decisionId}`);
      setShareCopied(true);
      toast.success("Share link copied to clipboard");
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Your browser may have blocked clipboard access");
    }
  }

  function submitSupersede() {
    if (!toDecisionId) {
      setSupersedeError("Pick the decision that replaces this one.");
      return;
    }
    setSupersedeError(undefined);
    startSupersede(async () => {
      const res = await fetch(`/api/decisions/${decisionId}/supersede`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toDecisionId }),
      });
      const json = await res.json();
      if (json.error) {
        setSupersedeError(json.error);
        toast.error(json.error);
      } else {
        toast.success("Decision marked superseded");
        window.location.reload();
      }
    });
  }

  function handleArchive() {
    if (!confirm("Archive this decision? It will be hidden from active views.")) return;
    startArchive(async () => {
      await fetch("/api/decisions/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId }),
      });
      router.push("/decisions");
    });
  }

  const supersedeCandidates = workspaceDecisions.filter(
    (d) => d.id !== decisionId && d.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex flex-wrap items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCite}
        title={
          hasRationale
            ? "Copy a Markdown citation of this decision's rationale."
            : "This decision has no rationale yet, so a citation will be copied but will note that it is empty."
        }
        icon={citeCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Quote className="h-4 w-4" />}
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        title="Copy share link"
        icon={shareCopied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
      />

      {canSupersede && (
        <Button variant="ghost" size="sm" onClick={() => setSupersedeOpen(true)} title="Supersede" icon={<GitBranch className="h-4 w-4" />} />
      )}

      {canArchive && (
        <Button
          variant="ghost"
          size="sm"
          disabled={archivePending}
          onClick={handleArchive}
          title="Archive"
          className="text-slate-500 hover:text-red-600"
          icon={<Archive className="h-4 w-4" />}
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/decisions/${decisionId}/history`)}
        title="History"
        aria-label="History"
        icon={<History className="h-4 w-4" />}
      />

      {supersedeOpen && (
        <div className="absolute right-0 top-10 z-20 w-96 rounded-xs p-4 bg-white shadow-soft space-y-3">
          <div>
            <Text as="h5">Supersede this decision</Text>
            <Text as="p">
              Pick the decision that replaces it. This one will be marked <Text>superseded</Text>.
            </Text>
          </div>

          {supersedeError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xs p-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <Text>{supersedeError}</Text>
            </div>
          )}

          <div className="space-y-1.5">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setToDecisionId("");
              }}
              placeholder="Search decisions…"
              autoFocus
            />
            {search && (
              <div className="max-h-48 overflow-y-auto rounded-xs bg-white divide-y divide-slate-100">
                {supersedeCandidates.length === 0 ? (
                  <Text as="p">No matching decisions</Text>
                ) : (
                  supersedeCandidates.slice(0, 10).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setToDecisionId(d.id);
                        setSearch(d.title);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${
                        toDecisionId === d.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <Text>{d.title}</Text>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link href={`/decisions/new?supersedes=${decisionId}`} className="hover:underline">
              <Text>or log a brand-new decision →</Text>
            </Link>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSupersedeOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={supersedePending || !toDecisionId} onClick={submitSupersede}>
                {supersedePending ? "Superseding…" : "Supersede"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
