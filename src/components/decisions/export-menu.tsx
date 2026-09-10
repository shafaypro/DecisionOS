import { ChevronDown, Download, FileJson, FileText, Table } from "lucide-react";
import { Text } from "@/components/ui/text";

const FORMATS = [
  {
    format: "csv",
    label: "CSV",
    hint: "Spreadsheet-friendly, one row per decision",
    icon: Table,
  },
  {
    format: "json",
    label: "JSON",
    hint: "Versioned envelope for backup or migration",
    icon: FileJson,
  },
  {
    format: "md",
    label: "Markdown",
    hint: "ADR bundle to commit next to your code",
    icon: FileText,
  },
] as const;

/**
 * Export picker for the decision log.
 *
 * Built on `<details>` rather than a JS popover so it works in a server
 * component and still opens with no client bundle - the whole feature is three
 * download links.
 */
export function ExportMenu() {
  return (
    <details className="group relative">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-xs border border-slate-200 bg-white px-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <Download className="h-4 w-4 text-text-subtle" />
        <Text as="span" size="sm" color="secondary">
          Export
        </Text>
        <ChevronDown className="h-3.5 w-3.5 text-text-subtle transition-transform group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-xs border border-slate-200 bg-white shadow-lg">
        {FORMATS.map(({ format, label, hint, icon: Icon }) => (
          <a
            key={format}
            href={`/api/decisions/export?format=${format}`}
            download
            className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-subtle" />
            <span className="min-w-0">
              <Text as="span" size="sm" color="secondary">
                {label}
              </Text>
              <Text as="p" size="2xs" color="muted">
                {hint}
              </Text>
            </span>
          </a>
        ))}
      </div>
    </details>
  );
}
