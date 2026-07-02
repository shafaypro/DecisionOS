import { AlertCircle } from "lucide-react";
import { Text } from "@/components/ui/text";

/** Inline form error: red icon + message in a tinted box. Renders nothing when empty. */
export function ErrorAlert({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 rounded-xs border border-red-200 bg-red-50 px-3 py-2">
      <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
      <Text color="danger">{error}</Text>
    </div>
  );
}
