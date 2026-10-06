"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Circle, FileText, Save, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { FONT_WEIGHT, TEXT_SIZE } from "@/lib/typography";
import { useToast } from "@/components/ui/toast";
import { CATEGORIES, IMPACT_LEVELS, STATUSES, cn } from "@/lib/utils";

interface SimilarMatch {
  id: string;
  title: string;
  status: string;
  ownerName: string | null;
  updatedAt: string;
  score: number;
}

function SimilarDecisionsHint({
  title,
  excludeIds = [],
}: {
  title: string;
  excludeIds?: string[];
}) {
  const [matches, setMatches] = useState<SimilarMatch[]>([]);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const trimmedTitle = title.trim();
  const dismissed = dismissedFor === trimmedTitle;

  useEffect(() => {
    if (trimmedTitle.length < 8) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(
          `/api/decisions/similar?q=${encodeURIComponent(trimmedTitle)}`,
          { signal: ac.signal },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { matches: SimilarMatch[] };
        const filtered = (json.matches ?? []).filter((m) => !excludeIds.includes(m.id));
        setMatches(filtered);
      } catch {
        // best-effort hint
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedTitle, excludeIds]);

  if (trimmedTitle.length < 8 || dismissed || matches.length === 0) return null;

  return (
    <div className="mt-2 rounded-xs border border-amber-200 bg-amber-50 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="flex-1 min-w-0">
          <Text>Have you decided this before?</Text>
          <Text as="p">
            {matches.length === 1
              ? "We found a previous decision with similar wording. Worth a look:"
              : `We found ${matches.length} previous decisions with similar wording. Worth a look:`}
          </Text>
          <ul className="mt-2 space-y-1.5">
            {matches.map((m) => (
              <Text as="li" key={m.id}>
                <Link
                  href={`/decisions/${m.id}`}
                  target="_blank"
                  className="group flex items-center gap-2 rounded-xs bg-white/70 px-2 py-1.5 hover:bg-white"
                >
                  <Text>{m.title}</Text>
                  {m.ownerName && (
                    <Text>· {m.ownerName}</Text>
                  )}
                  <Text>{m.score}% match</Text>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                </Link>
              </Text>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDismissedFor(trimmedTitle)}
            className="mt-2"
          >
            <Text>
              Different decision, dismiss
            </Text>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissedFor(trimmedTitle)}
          aria-label="Dismiss"
          className="rounded-xs p-0.5 text-text-warning hover:bg-amber-100 hover:text-text-warning"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface Member {
  id: string;
  name: string;
}

/** A template as the form needs it - `defaultValues` is a JSON-encoded field map. */
export interface FormTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
  defaultValues: string;
}

/** Fields a template may pre-fill. Anything else in its JSON is ignored. */
const TEMPLATE_FIELDS = [
  "summary",
  "category",
  "impactLevel",
  "problemStatement",
  "chosenOption",
  "rationale",
  "alternativesConsidered",
  "assumptions",
  "risks",
] as const;
type TemplateField = (typeof TEMPLATE_FIELDS)[number];

function parseTemplate(t: FormTemplate): Partial<Record<TemplateField, string>> {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(t.defaultValues) as Record<string, unknown>;
  } catch {
    // A malformed custom template still contributes its category.
  }
  const out: Partial<Record<TemplateField, string>> = {};
  for (const f of TEMPLATE_FIELDS) {
    if (typeof raw[f] === "string" && raw[f]) out[f] = raw[f] as string;
  }
  out.category ??= t.category;
  return out;
}

function TemplateChooser({
  templates,
  appliedId,
  onApply,
}: {
  templates: FormTemplate[];
  appliedId: string | null;
  onApply: (t: FormTemplate) => void;
}) {
  return (
    <div className="rounded-xs bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-blue-600" aria-hidden />
        <Text as="p">Start from a template</Text>
        <Text as="span" color="muted">
          - fills empty fields only, so nothing you typed is overwritten
        </Text>
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const applied = appliedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onApply(t)}
              title={t.description ?? undefined}
              aria-pressed={applied}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                applied
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {applied && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
              <Text>{t.name}</Text>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DecisionFormProps {
  decisionId?: string;
  supersedesId?: string;
  supersedesTitle?: string;
  defaultValues?: {
    title?: string;
    summary?: string;
    category?: string;
    impactLevel?: string;
    status?: string;
    visibility?: string;
    ownerUserId?: string;
    accountableUserId?: string;
    consultedIds?: string[];
    problemStatement?: string;
    chosenOption?: string;
    rationale?: string;
    alternativesConsidered?: string;
    assumptions?: string;
    risks?: string;
    decisionDate?: string;
    reviewDate?: string;
  };
  members: Member[];
  templates?: FormTemplate[];
  isEdit?: boolean;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <Text as="p">{children}</Text>;
}

function Disclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50"
      >
        <Text>{label}</Text>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="space-y-4 px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}

function QualityRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-slate-300" />
      )}
      <Text>{label}</Text>
    </div>
  );
}

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function DecisionForm({
  decisionId,
  supersedesId,
  supersedesTitle,
  defaultValues = {},
  members,
  templates = [],
  isEdit,
}: DecisionFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState(defaultValues.title ?? "");
  const [summary, setSummary] = useState(defaultValues.summary ?? "");
  const [category, setCategory] = useState(defaultValues.category ?? "other");
  const [impactLevel, setImpactLevel] = useState(defaultValues.impactLevel ?? "medium");
  const [status, setStatus] = useState(defaultValues.status ?? "approved");
  const [isPrivate, setIsPrivate] = useState(defaultValues.visibility === "private");
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [rationale, setRationale] = useState(defaultValues.rationale ?? "");
  const [problemStatement, setProblemStatement] = useState(defaultValues.problemStatement ?? "");
  const [chosenOption, setChosenOption] = useState(defaultValues.chosenOption ?? "");
  const [alternativesConsidered, setAlternativesConsidered] = useState(defaultValues.alternativesConsidered ?? "");
  const [assumptions, setAssumptions] = useState(defaultValues.assumptions ?? "");
  const [risks, setRisks] = useState(defaultValues.risks ?? "");
  const [consultedIds, setConsultedIds] = useState<string[]>(defaultValues.consultedIds ?? []);

  const rationaleWordCount = countWords(rationale);
  const qualityItems = [
    { label: "Decision title", done: title.trim().length >= 3 },
    { label: "Rationale captured", done: rationale.trim().length > 0 },
    { label: "Problem framed", done: problemStatement.trim().length > 0 },
    { label: "Solution clear", done: chosenOption.trim().length > 0 },
  ];
  const qualityScore = qualityItems.filter((item) => item.done).length;
  const statusHint = STATUSES.find((s) => s.value === status)?.hint;

  /** Fill only the fields that are still empty, so a template never clobbers typed text. */
  function applyTemplate(t: FormTemplate) {
    const v = parseTemplate(t);
    const fill = (current: string, next: string | undefined, set: (x: string) => void) => {
      if (next && !current.trim()) set(next);
    };
    fill(summary, v.summary, setSummary);
    fill(problemStatement, v.problemStatement, setProblemStatement);
    fill(chosenOption, v.chosenOption, setChosenOption);
    fill(rationale, v.rationale, setRationale);
    fill(alternativesConsidered, v.alternativesConsidered, setAlternativesConsidered);
    fill(assumptions, v.assumptions, setAssumptions);
    fill(risks, v.risks, setRisks);
    // Classification has no "empty" state - the template's choice wins.
    if (v.category && CATEGORIES.some((c) => c.value === v.category)) setCategory(v.category);
    if (v.impactLevel && IMPACT_LEVELS.some((i) => i.value === v.impactLevel)) setImpactLevel(v.impactLevel);
    setAppliedTemplateId(t.id);
  }

  function handleSubmit(saveAsProposed?: boolean) {
    if (pending) return;

    const ownerEl = document.getElementById("ownerUserId") as HTMLSelectElement | null;
    const dateEl = document.getElementById("decisionDate") as HTMLInputElement | null;
    const reviewDateEl = document.getElementById("reviewDate") as HTMLInputElement | null;

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!rationale.trim()) {
      setError("Rationale is required. This is the most important field.");
      return;
    }

    const accountableEl = document.getElementById("accountableUserId") as HTMLSelectElement | null;

    const data = {
      title: title.trim(),
      summary: summary.trim() || null,
      category,
      impactLevel,
      status: saveAsProposed ? "proposed" : status,
      ownerUserId: ownerEl?.value || null,
      accountableUserId: accountableEl?.value || null,
      consultedIds,
      decisionDate: dateEl?.value || null,
      reviewDate: reviewDateEl?.value || null,
      problemStatement: problemStatement || null,
      chosenOption: chosenOption || null,
      rationale: rationale || null,
      alternativesConsidered: alternativesConsidered || null,
      assumptions: assumptions || null,
      risks: risks || null,
      visibility: isPrivate ? "private" : "workspace",
    };

    setError(undefined);
    startTransition(async () => {
      const url = isEdit && decisionId ? `/api/decisions/${decisionId}` : "/api/decisions";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.error) {
        // Surface the first field-level detail so a validation failure says
        // which field is wrong instead of just "Validation failed".
        const fieldErrors = json.details?.fieldErrors as Record<string, string[]> | undefined;
        const first = fieldErrors && Object.entries(fieldErrors).find(([, v]) => v?.length);
        setError(first ? `${json.error}: ${first[0]} - ${first[1][0]}` : json.error);
        return;
      }

      const id = isEdit ? decisionId : json.id;
      if (!isEdit && id && supersedesId) {
        // The new decision is saved either way; say so if the link didn't take,
        // rather than leaving the old one silently un-superseded.
        const linked = await fetch(`/api/decisions/${supersedesId}/supersede`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toDecisionId: id }),
        })
          .then((r) => r.ok)
          .catch(() => false);
        if (!linked) {
          toast.error("Decision saved, but the earlier one could not be marked superseded. Use Supersede on it to retry.");
        }
      }
      router.push(`/decisions/${id}`);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(false);
    }
  }

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      {supersedesId && (
        <div className="rounded-xs border border-blue-200 bg-blue-50 px-4 py-3">
          <Text>
            <Text as="strong">Superseding:</Text>{" "}
            {supersedesTitle ? <Text>{supersedesTitle}</Text> : "an earlier decision"}.
            When you save, the old decision will be marked <Text>superseded</Text> and linked to this one.
          </Text>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xs border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
          <Text>{error}</Text>
        </div>
      )}

      {!isEdit && templates.length > 0 && (
        <TemplateChooser templates={templates} appliedId={appliedTemplateId} onApply={applyTemplate} />
      )}

      <div className="rounded-xs bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <Text as="p">Capture quality</Text>
            <Text as="p">
              A strong record explains why, what changed, and who owns the decision.
            </Text>
          </div>
          <div
            className="rounded-xs bg-slate-900 px-2.5 py-1"
            aria-label={`${qualityScore} of ${qualityItems.length} quality checks met`}
          >
            <Text color="inverse">
              {qualityScore}/{qualityItems.length}
            </Text>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          {qualityItems.map((item) => (
            <QualityRow key={item.label} {...item} />
          ))}
        </div>
      </div>

      <div>
        <Input
          label={<>What was decided? <Text>*</Text></>}
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Migrate to PostgreSQL for the production database"
          className={TEXT_SIZE.base}
          autoFocus
        />
        {!isEdit && (
          <SimilarDecisionsHint
            title={title}
            excludeIds={supersedesId ? [supersedesId] : []}
          />
        )}
      </div>

      <Input
        label="One-line summary"
        id="summary"
        name="summary"
        maxLength={1000}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="e.g. Replacing SQLite so production can handle concurrent writers"
        hint="Shown under the title in lists and search results."
      />

      <Textarea
        label={<>Why? (Rationale) <Text>*</Text></>}
        labelClassName={cn(TEXT_SIZE.base, FONT_WEIGHT.semibold)}
        labelAction={
          <Text>
            {rationaleWordCount} word{rationaleWordCount === 1 ? "" : "s"}
          </Text>
        }
        id="rationale"
        name="rationale"
        rows={7}
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="Why was this the right call? What made this the clear choice over alternatives? What would a new engineer joining the team in 6 months want to know?"
        className="resize-y border-blue-200 focus:ring-blue-500"
        hint="This is the field that makes DecisionOS valuable. Two or three direct sentences are enough."
      />

      <Textarea
        label="What problem were you solving?"
        id="problemStatement"
        name="problemStatement"
        rows={3}
        value={problemStatement}
        onChange={(e) => setProblemStatement(e.target.value)}
        placeholder="What situation or problem prompted this decision?"
      />

      <Textarea
        label="Solution"
        id="chosenOption"
        name="chosenOption"
        rows={2}
        value={chosenOption}
        onChange={(e) => setChosenOption(e.target.value)}
        placeholder="What exactly was decided or selected?"
      />

      <div className="grid grid-cols-1 gap-4 rounded-xs bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <NativeSelect
          label="Category"
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          label="Impact"
          id="impactLevel"
          name="impactLevel"
          value={impactLevel}
          onChange={(e) => setImpactLevel(e.target.value)}
          hint="High-impact decisions rank first in the risk register."
        >
          {IMPACT_LEVELS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          label="Owner (Responsible)"
          id="ownerUserId"
          name="ownerUserId"
          defaultValue={defaultValues.ownerUserId ?? ""}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          label="Accountable (DRI)"
          id="accountableUserId"
          name="accountableUserId"
          defaultValue={defaultValues.accountableUserId ?? ""}
          hint="The single person ultimately accountable."
        >
          <option value="">None</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>

        <fieldset className="space-y-1.5 sm:col-span-1">
          <Text as="legend">Consulted</Text>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const checked = consultedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setConsultedIds((prev) =>
                      checked ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                    )
                  }
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 transition-colors ${
                    checked
                      ? "border-blue-300 bg-blue-100"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <Text>{m.name}</Text>
                </button>
              );
            })}
          </div>
          <FieldHint>People whose input was sought.</FieldHint>
        </fieldset>

        <NativeSelect
          label="Status"
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          hint={statusHint}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value} title={s.hint}>
              {s.label}
            </option>
          ))}
        </NativeSelect>

        <Input
          label="Date decided"
          id="decisionDate"
          name="decisionDate"
          type="date"
          defaultValue={defaultValues.decisionDate}
        />
      </div>

      <label className="flex items-start gap-3 rounded-xs bg-white px-4 py-3">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="mt-1 rounded-xs border-slate-300"
        />
        <span>
          <Text as="span" weight="medium">Private</Text>
          <Text as="p" size="sm" color="muted">
            Only you can see it - useful for a sensitive call (compensation, personnel) or a draft you&apos;re not
            ready to show. You can open it to the workspace later.
          </Text>
        </span>
      </label>

      <Disclosure
        key={`alt-${appliedTemplateId}`}
        label="Alternatives (optional)"
        defaultOpen={!!alternativesConsidered}
      >
        <Textarea
          id="alternativesConsidered"
          name="alternativesConsidered"
          rows={4}
          value={alternativesConsidered}
          onChange={(e) => setAlternativesConsidered(e.target.value)}
          placeholder="What other options were evaluated? Why were they rejected or deprioritized?"
        />
      </Disclosure>

      <Disclosure label="Review reminder (optional)" defaultOpen={!!defaultValues.reviewDate}>
        <Input
          label="Review this decision on"
          id="reviewDate"
          name="reviewDate"
          type="date"
          defaultValue={defaultValues.reviewDate}
          hint="You will get a reminder to revisit whether this decision still holds."
        />
      </Disclosure>

      <Disclosure
        key={`ar-${appliedTemplateId}`}
        label="Assumptions and risks (optional)"
        defaultOpen={!!(assumptions || risks)}
      >
        <div className="space-y-4">
          <Textarea
            label="Assumptions"
            id="assumptions"
            rows={3}
            value={assumptions}
            onChange={(e) => setAssumptions(e.target.value)}
            placeholder="What must be true for this decision to work as intended?"
          />
          <Textarea
            label="Risks"
            id="risks"
            rows={3}
            value={risks}
            onChange={(e) => setRisks(e.target.value)}
            placeholder="What could go wrong? What should be monitored?"
          />
        </div>
      </Disclosure>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-1 py-4 backdrop-blur">
        <Text>Ctrl/Cmd + Enter saves with the selected status</Text>
        <div className="flex items-center gap-3">
          {!isEdit && status !== "proposed" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleSubmit(true)}
              icon={<Save className="h-4 w-4" />}
            >
              Save as proposed
            </Button>
          )}
          <Button type="button" disabled={pending} onClick={() => handleSubmit(false)} icon={<Send className="h-4 w-4" />}>
            {isEdit ? "Save changes" : `Save as ${STATUSES.find((s) => s.value === status)?.label.toLowerCase() ?? status}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
