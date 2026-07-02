"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { FileText, ChevronRight, X } from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
  defaultValues: string;
  isBuiltIn: boolean;
}

interface TemplatePickerProps {
  templates: Template[];
  onSelect: (values: Record<string, string>) => void;
  onSkip: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  engineering: "Engineering",
  product: "Product",
  hiring: "Hiring",
  business: "Business",
  operations: "Operations",
  other: "Other",
};

export function TemplatePicker({ templates, onSelect, onSkip }: TemplatePickerProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    const cat = t.category || "other";
    acc[cat] = acc[cat] ?? [];
    acc[cat].push(t);
    return acc;
  }, {});

  function applyTemplate(template: Template) {
    let values: Record<string, string> = {};
    try { values = JSON.parse(template.defaultValues); } catch { /* empty */ }
    values.category = values.category || template.category;
    onSelect(values);
  }

  return (
    <div className="bg-white rounded-xs p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <Text as="h2">Start from a template</Text>
        </div>
        <button onClick={onSkip} className="flex items-center gap-1">
          <X className="h-3.5 w-3.5" />
          <Text>Start blank</Text>
        </button>
      </div>

      <Text as="p">
        Templates pre-fill common fields for your decision type.
      </Text>

      {Object.entries(grouped).map(([category, temps]) => (
        <div key={category} className="mb-6">
          <Text as="h3">
            {CATEGORY_LABELS[category] ?? category}
          </Text>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {temps.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "rounded-xs transition-all duration-200 cursor-pointer",
                  selected === t.id ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
                )}
                onClick={() => setSelected(t.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Text as="p">{t.name}</Text>
                      {t.isBuiltIn && (
                        <Text>Built-in</Text>
                      )}
                      {t.description && (
                        <Text as="p">{t.description}</Text>
                      )}
                    </div>
                    {selected === t.id && (
                      <div className="flex-shrink-0">
                        <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <Text as="p">
          No templates configured yet. Admins can create templates in Settings.
        </Text>
      )}

      <div className="flex gap-3 mt-6">
        <Button
          disabled={!selected}
          onClick={() => {
            const t = templates.find((t) => t.id === selected);
            if (t) applyTemplate(t);
          }}
          iconRight={<ChevronRight className="h-4 w-4" />}
        >
          Use Template
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}
