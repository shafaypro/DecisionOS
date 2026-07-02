"use client";

import { useState } from "react";
import { DecisionForm } from "../_forms/decision-form";
import { TemplatePicker } from "./template-picker";

interface Member { id: string; name: string }

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
  defaultValues: string;
  isBuiltIn: boolean;
}

interface NewDecisionClientProps {
  members: Member[];
  templates: Template[];
  today: string;
}

export function NewDecisionClient({ members, templates, today }: NewDecisionClientProps) {
  const [phase, setPhase] = useState<"pick" | "form">(templates.length > 0 ? "pick" : "form");
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>({ decisionDate: today });

  function handleTemplateSelect(values: Record<string, string>) {
    setDefaultValues({ ...values, decisionDate: today });
    setPhase("form");
  }

  if (phase === "pick") {
    return (
      <TemplatePicker
        templates={templates}
        onSelect={handleTemplateSelect}
        onSkip={() => setPhase("form")}
      />
    );
  }

  return <DecisionForm members={members} defaultValues={defaultValues} />;
}
