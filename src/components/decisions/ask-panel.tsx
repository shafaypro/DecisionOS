"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Search, AlertCircle, ArrowRight, FileText, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_COLORS, STATUSES, getLabelForValue, cn } from "@/lib/utils";

interface Source {
  index: number;
  id: string;
  title: string;
  status: string;
  category: string;
  snippet: string;
}

interface AskResponse {
  mode: "answer" | "search" | "empty";
  answer: string | null;
  citedIndices: number[];
  sources: Source[];
  model?: string;
  error?: string;
}

interface AskResult extends AskResponse {
  question: string;
}

const EXAMPLE_QUESTIONS = [
  "Why did we move off our previous auth provider?",
  "What database did we standardize on, and why?",
  "Which decisions are still unproven or risky?",
  "What did we decide about pricing?",
];

export function AskPanel({ aiEnabled, hasDecisions }: { aiEnabled: boolean; hasDecisions: boolean }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function ask(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setError("Please enter a question (at least 3 characters).");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/decisions/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed }),
        });
        const json = (await res.json()) as AskResponse;
        if (!res.ok) {
          setError(json.error ?? "Something went wrong. Please try again.");
          return;
        }
        setResult({ ...json, question: trimmed });
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  function submitExample(q: string) {
    setQuestion(q);
    ask(q);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ask box */}
      <div className="rounded-xs border border-slate-200 bg-white p-2 shadow-[var(--card-shadow)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                ask(question);
              }
            }}
            rows={2}
            placeholder="Ask anything about your team's decisions…"
            className="min-h-[3rem] flex-1 resize-none rounded-xs bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <Button
            type="button"
            onClick={() => ask(question)}
            disabled={pending || question.trim().length < 3}
            className="gap-2"
          >
            {pending ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                Thinking…
              </>
            ) : (
              <>
                Ask
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            {aiEnabled ? (
              <>
                <Sparkles className="h-3 w-3 text-blue-500" />
                Grounded in your decision log. Answers cite the records they use.
              </>
            ) : (
              <>
                <Search className="h-3 w-3" />
                Semantic search across your decisions. Add an Anthropic key in Settings → Integrations for synthesized answers.
              </>
            )}
          </span>
          <span className="hidden items-center gap-1 text-[11px] text-slate-300 sm:inline-flex">
            <CornerDownLeft className="h-3 w-3" />
            ⌘↵ to ask
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xs border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Example questions - shown until the first answer */}
      {!result && !pending && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            {hasDecisions ? "Try asking" : "Once you've logged a few decisions, try"}
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={!hasDecisions}
                onClick={() => submitExample(q)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {pending && (
        <div className="animate-pulse rounded-xs border border-slate-200 bg-white p-6">
          <div className="mb-3 h-3 w-1/3 rounded-full bg-slate-100" />
          <div className="mb-2 h-3 w-full rounded-full bg-slate-100" />
          <div className="mb-2 h-3 w-11/12 rounded-full bg-slate-100" />
          <div className="h-3 w-2/3 rounded-full bg-slate-100" />
        </div>
      )}

      {result && !pending && <AnswerBlock result={result} />}
    </div>
  );
}

function AnswerBlock({ result }: { result: AskResult }) {
  const { mode, answer, sources, citedIndices } = result;

  if (mode === "empty" || sources.length === 0) {
    return (
      <div className="rounded-xs border border-slate-200 bg-white p-6 text-center">
        <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">No matching decisions found</p>
        <p className="mt-1 text-sm text-slate-500">
          Nothing in your decision log matches “{result.question}”. Try different words, or log the
          decision so it’s searchable next time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Synthesized answer */}
      {mode === "answer" && answer && (
        <div className="rounded-xs border border-blue-200 bg-blue-50/60 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Answer</span>
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
            {renderAnswerWithCitations(answer)}
          </p>
        </div>
      )}

      {/* Retrieval-only banner */}
      {mode === "search" && (
        <div className="flex items-center gap-2 rounded-xs border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          <Search className="h-3.5 w-3.5 flex-shrink-0" />
          Showing the most relevant decisions. Add an Anthropic key in Settings → Integrations to get a
          synthesized, cited answer.
        </div>
      )}

      {/* Sources */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          {mode === "answer" ? "Sources" : "Most relevant decisions"}
        </p>
        <div className="flex flex-col gap-2">
          {sources.map((s) => {
            const cited = citedIndices.includes(s.index);
            return (
              <Link
                key={s.id}
                id={`source-${s.index}`}
                href={`/decisions/${s.id}`}
                className={cn(
                  "group block rounded-xs border bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow-hover)]",
                  cited ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      cited ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {s.index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                        {s.title}
                      </span>
                      <span
                        className={cn(
                          "flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          STATUS_COLORS[s.status] ?? "border-slate-200 bg-slate-100 text-slate-600",
                        )}
                      >
                        {getLabelForValue(STATUSES, s.status)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{s.snippet}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Render an answer string, turning bracketed citations like "[2]" into small
 * anchors that jump to the matching source card.
 */
function renderAnswerWithCitations(answer: string) {
  const parts = answer.split(/(\[\d{1,3}\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d{1,3})\]$/);
    if (!m) return <span key={i}>{part}</span>;
    const n = m[1];
    return (
      <a
        key={i}
        href={`#source-${n}`}
        className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 align-text-top text-[10px] font-bold text-white no-underline hover:bg-blue-700"
      >
        {n}
      </a>
    );
  });
}
