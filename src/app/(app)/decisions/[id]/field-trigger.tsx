"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/**
 * The "Add …" affordance used by the inline decision fields (Why, Alternatives…),
 * reused here so Reviews / Notes / Relations open their modal with the same look:
 * a ghost icon button + a muted heading-styled label.
 */
export function FieldTrigger({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="group flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        aria-label={label}
        className="group-hover:bg-slate-100"
        icon={
          <span className="flex h-5 w-5 items-center justify-center">
            <Plus className="h-4 w-4 text-slate-400 transition-colors group-hover:text-slate-600" />
          </span>
        }
      />
      <button type="button" onClick={onClick} className="text-left">
        <Text as="h3" size="base" weight="semibold" color="secondary" className="group-hover:text-text-primary">
          {label}
        </Text>
      </button>
    </div>
  );
}
