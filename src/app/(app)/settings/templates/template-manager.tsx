"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Text } from "@/components/ui/text";
import { Plus, Trash2, Edit2, X, Check, AlertCircle, FileText } from "lucide-react";
import { cn, CATEGORIES } from "@/lib/utils";
import { TEXT_SIZE } from "@/lib/typography";

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
  defaultValues: string;
  isBuiltIn: boolean;
}

interface TemplateManagerProps {
  initialTemplates: Template[];
}

function defaultValuesPreview(dv: string): string {
  try {
    const parsed = JSON.parse(dv);
    const keys = Object.keys(parsed).filter((k) => parsed[k]);
    return keys.length > 0 ? `Pre-fills: ${keys.join(", ")}` : "";
  } catch {
    return "";
  }
}

export function TemplateManager({ initialTemplates }: TemplateManagerProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const [form, setForm] = useState({
    name: "",
    category: "engineering",
    description: "",
    defaultValues: "{}",
  });

  function openCreate() {
    setForm({ name: "", category: "engineering", description: "", defaultValues: "{}" });
    setEditingId(null);
    setShowForm(true);
    setError(undefined);
  }

  function openEdit(t: Template) {
    setForm({ name: t.name, category: t.category, description: t.description ?? "", defaultValues: t.defaultValues });
    setEditingId(t.id);
    setShowForm(true);
    setError(undefined);
  }

  function save() {
    let parsedDV: unknown;
    try { parsedDV = JSON.parse(form.defaultValues); } catch {
      setError("Default values must be valid JSON."); return;
    }
    setError(undefined);
    startTransition(async () => {
      const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, defaultValues: parsedDV }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      // Reload templates
      const listRes = await fetch("/api/templates");
      const listData = await listRes.json();
      setTemplates(listData.templates ?? []);
      setShowForm(false);
    });
  }

  function deleteTemplate(id: string, name: string) {
    if (!confirm(`Delete template "${name}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    });
  }

  const builtIn = templates.filter((t) => t.isBuiltIn);
  const custom = templates.filter((t) => !t.isBuiltIn);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-xs bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-text-danger" />
          <Text>{error}</Text>
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-xs transition-all duration-200">
          <div className={cn("p-6 pt-0", "p-6 space-y-4")}>
            <div className="flex items-center justify-between">
              <Text as="h3">
                {editingId ? "Edit Template" : "New Template"}
              </Text>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Engineering ADR"
              />
              <NativeSelect
                label="Category *"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </NativeSelect>
            </div>

            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Briefly describe what this template is for"
            />

            <Textarea
              label="Default Values (JSON)"
              value={form.defaultValues}
              onChange={(e) => setForm({ ...form, defaultValues: e.target.value })}
              rows={6}
              className={cn(TEXT_SIZE.xs, "font-mono")}
              placeholder={`{\n  "impactLevel": "high",\n  "problemStatement": "..."\n}`}
              hint={
                <>
                  JSON object with field names matching the decision form fields.
                  Valid fields: title, summary, category, impactLevel, problemStatement, chosenOption, rationale, alternativesConsidered, assumptions, risks.
                </>
              }
            />

            <div className="flex gap-2">
              <Button size="sm" disabled={pending || !form.name.trim()} onClick={save} icon={<Check className="h-4 w-4" />}>
                {editingId ? "Save Changes" : "Create Template"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Built-in templates */}
      {builtIn.length > 0 && (
        <div>
          <Text as="h3">
            Built-in Templates
          </Text>
          <div className="space-y-2">
            {builtIn.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xs bg-slate-50">
                <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Text>{t.name}</Text>
                  <Text>{t.category} · {defaultValuesPreview(t.defaultValues) || t.description}</Text>
                </div>
                <Text>
                  Built-in
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom templates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Text as="h3">
            Custom Templates
          </Text>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
              New Template
            </Button>
          )}
        </div>

        {custom.length === 0 ? (
          <Text as="p">
            No custom templates yet.
          </Text>
        ) : (
          <div className="space-y-2">
            {custom.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xs transition-colors">
                <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Text>{t.name}</Text>
                  <Text>{t.category}{t.description ? ` · ${t.description}` : ""}</Text>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 rounded-xs hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id, t.name)}
                    disabled={pending}
                    className="p-1.5 rounded-xs hover:bg-red-50 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
