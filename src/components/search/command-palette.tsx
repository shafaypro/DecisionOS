"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardCheck, FileText, Plus, Search, Zap } from "lucide-react";
import { Row } from "@/components/ui/row";
import { Text } from "@/components/ui/text";
import { TEXT_COLOR, TEXT_SIZE } from "@/lib/typography";
import { cn } from "@/lib/utils";

interface DecisionResult {
  id: string;
  title: string;
  status: string;
  rationale: string | null;
  updatedAt: string;
  owner: { name: string } | null;
}

function StatusPill({ status }: { status: string }) {
  return (
    <Text as="span" size="2xs" weight="medium" color="inherit">
      {status.replace("_", " ")}
    </Text>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DecisionResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const rationaleRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Quick-capture inline state
  const [quickMode, setQuickMode] = useState(false);
  const [quickRationale, setQuickRationale] = useState("");
  const [quickPending, startQuickTransition] = useTransition();
  const [quickError, setQuickError] = useState<string | undefined>();

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setQuickMode(false);
    setQuickRationale("");
    setQuickError(undefined);
  }, []);

  const enterQuickMode = useCallback(() => {
    setQuickMode(true);
    setQuickRationale("");
    setQuickError(undefined);
    setTimeout(() => rationaleRef.current?.focus(), 30);
  }, []);

  function submitQuickCapture() {
    if (quickPending) return;
    const title = query.trim();
    if (title.length < 3) { setQuickError("Title must be at least 3 characters."); return; }
    if (!quickRationale.trim()) { setQuickError("Rationale is required."); return; }
    setQuickError(undefined);
    startQuickTransition(async () => {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          rationale: quickRationale.trim(),
          status: "approved",
          visibility: "workspace",
        }),
      });
      const json = await res.json();
      if (json.error) { setQuickError(json.error); return; }
      closePalette();
      router.push(`/decisions/${json.id}`);
    });
  }

  const fetchResults = useCallback((q: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/decisions/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setResults([]);
        setActiveIndex(0);
        return;
      }

      const data = await res.json();
      setResults(data.decisions ?? []);
      setActiveIndex(0);
    });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          setOpen(true);
        }
      }
      if (e.key === "Escape") closePalette();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePalette, open]);

  useEffect(() => {
    if (!open) return;

    const timeout = setTimeout(() => {
      inputRef.current?.focus();
      fetchResults("");
    }, 30);

    return () => clearTimeout(timeout);
  }, [fetchResults, open]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (quickMode) setQuickMode(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(val), 180);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Tab" && query.trim().length >= 3) {
      e.preventDefault();
      enterQuickMode();
      return;
    }
    if (e.key === "Escape" && quickMode) {
      setQuickMode(false);
      return;
    }
    onKeyDown(e as unknown as React.KeyboardEvent);
  }

  const quickActions = [
    { label: "New decision", icon: Plus, href: "/decisions/new" },
    { label: "Needs review", icon: ClipboardCheck, href: "/decisions?review=due" },
    { label: "All decisions", icon: FileText, href: "/decisions" },
  ];

  const itemOffset = query ? 0 : quickActions.length;
  const totalItems = itemOffset + results.length;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (totalItems === 0) return;
      setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activateItem(activeIndex);
    }
  }

  function activateItem(index: number) {
    if (query) {
      const d = results[index];
      if (d) navigate(`/decisions/${d.id}`);
      return;
    }

    if (index < quickActions.length) {
      navigate(quickActions[index].href);
      return;
    }

    const d = results[index - quickActions.length];
    if (d) navigate(`/decisions/${d.id}`);
  }

  function navigate(href: string) {
    closePalette();
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={closePalette}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl bg-white rounded-xs shadow-soft overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleInputKeyDown}
            placeholder="Search decisions… or type a title and press Tab to quick-log"
            aria-label="Search decisions"
            className={cn("flex-1 bg-transparent outline-none placeholder:text-text-subtle", TEXT_SIZE.sm, TEXT_COLOR.primary)}
          />
          <Text as="kbd" size="2xs" color="subtle" mono>
            Esc
          </Text>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {/* Quick-capture inline panel */}
          {quickMode && (
            <div className="border-b border-blue-100 bg-blue-50/60 px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-3.5 w-3.5 text-blue-500" />
                <Text as="p" size="xs" weight="semibold" color="brand">
                  Quick log:{" "}
                  <Text as="span" size="xs" weight="normal" color="brand">
                    &ldquo;{query}&rdquo;
                  </Text>
                </Text>
                <button type="button" onClick={() => setQuickMode(false)} className="ml-auto text-text-subtle hover:text-text-brand">
                  <Text as="span" size="2xs" color="inherit">
                    Cancel
                  </Text>
                </button>
              </div>
              <textarea
                ref={rationaleRef}
                value={quickRationale}
                onChange={(e) => setQuickRationale(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitQuickCapture(); }
                  if (e.key === "Escape") { e.stopPropagation(); setQuickMode(false); }
                }}
                placeholder="Why was this the right call? (required)"
                rows={3}
                className={cn(
                  "w-full resize-none rounded-xs border border-blue-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-text-subtle",
                  TEXT_SIZE.sm,
                  TEXT_COLOR.primary,
                )}
              />
              {quickError && (
                <Text as="p" size="xs" color="danger">
                  {quickError}
                </Text>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <Text as="span" size="2xs" color="subtle">
                  <Text as="kbd" size="2xs" color="inherit" mono>
                    Ctrl/Cmd + Enter
                  </Text>{" "}
                  to save
                </Text>
                <button
                  type="button"
                  disabled={quickPending}
                  onClick={submitQuickCapture}
                  className="inline-flex items-center gap-1.5 rounded-xs bg-blue-600 px-3 py-1.5 hover:bg-blue-500 disabled:opacity-50"
                >
                  <Zap className="h-3 w-3 text-white" />
                  <Text size="xs" weight="semibold" color="inverse">
                    {quickPending ? "Logging…" : "Log decision"}
                  </Text>
                </button>
              </div>
            </div>
          )}

          {!query && (
            <div>
              <Text as="span" size="2xs" color="subtle" weight="semibold" tracking="widest" uppercase>
                Quick actions
              </Text>
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                const isActive = activeIndex === i;
                return (
                  <div key={action.href} onMouseEnter={() => setActiveIndex(i)}>
                    <Row
                      size="md"
                      hover
                      active={isActive}
                      title={action.label}
                      leading={
                        <Icon className={cn("h-4 w-4", isActive ? "text-text-brand-soft" : "text-text-subtle")} />
                      }
                      trailing={
                        isActive ? <ArrowRight className="h-3.5 w-3.5 text-text-brand-soft" /> : undefined
                      }
                      onClick={() => navigate(action.href)}
                      className={cn("px-4!", isActive && "bg-blue-50")}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {results.length > 0 && (
            <div>
              <Text as="span" size="2xs" color="subtle" weight="semibold" tracking="widest" uppercase>
                {query ? "Decisions" : "Recent decisions"}
              </Text>
              {results.map((d, i) => {
                const idx = i + itemOffset;
                const isActive = activeIndex === idx;
                return (
                  <div key={d.id} onMouseEnter={() => setActiveIndex(idx)}>
                    <Row
                      size="md"
                      hover
                      active={isActive}
                      title={d.title}
                      subtitle={d.rationale ?? d.owner?.name ?? "No rationale captured yet"}
                      leading={<FileText className="h-4 w-4 text-text-faint" />}
                      trailing={<StatusPill status={d.status} />}
                      onClick={() => navigate(`/decisions/${d.id}`)}
                      className={cn("px-4!", isActive && "bg-blue-50")}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {isPending && (
            <div className="px-4 py-3">
              <Text size="xs" color="subtle">
                Searching decisions...
              </Text>
            </div>
          )}

          {query && !isPending && results.length === 0 && !quickMode && (
            <div className="flex flex-col items-center py-10 text-center">
              <Search className="h-8 w-8 text-slate-200 mb-3" />
              <Text size="sm" color="muted">No decisions match &ldquo;{query}&rdquo;</Text>
              <div className="mt-3 flex items-center gap-3">
                {query.trim().length >= 3 && (
                  <button
                    onClick={enterQuickMode}
                    className="inline-flex items-center gap-1.5 rounded-xs bg-blue-600 px-3 py-1.5 hover:bg-blue-500"
                  >
                    <Zap className="h-3 w-3 text-white" />
                    <Text size="xs" weight="semibold" color="inverse">
                      Quick-log this decision
                    </Text>
                  </button>
                )}
                <button
                  onClick={() => navigate("/decisions/new")}
                  className="hover:underline"
                >
                  <Text as="span" size="xs" weight="medium" color="brand">
                    Full form →
                  </Text>
                </button>
              </div>
            </div>
          )}

          {(results.length > 0 || !query) && (
            <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50">
              <Text size="2xs" color="subtle">
                <Text as="kbd" size="2xs" color="inherit" mono>↑↓</Text>{" "}navigate
              </Text>
              <Text size="2xs" color="subtle">
                <Text as="kbd" size="2xs" color="inherit" mono>Enter</Text> open
              </Text>
              <Text size="2xs" color="subtle">
                <Text as="kbd" size="2xs" color="inherit" mono>Tab</Text> quick-log
              </Text>
              <Text as="span" size="2xs" color="subtle">
                <Text as="kbd" size="2xs" color="inherit" mono>Esc</Text> close
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
