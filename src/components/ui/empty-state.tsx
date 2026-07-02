import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

interface EmptyStateProps {
  /** Icon element, e.g. <Sparkles className="h-8 w-8 text-blue-400" />. */
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** Optional smaller, subtler second line under the description. */
  hint?: string;
  /** Optional call-to-action, typically a <Button>. */
  action?: React.ReactNode;
  /** Wrap the icon in a tinted tile. Default true; false renders the icon bare. */
  tile?: boolean;
  /** "lg" = hero variant (larger title, more breathing room). Default "md". */
  size?: "md" | "lg";
}

export function EmptyState({
  icon,
  title,
  description,
  hint,
  action,
  tile = true,
  size = "md",
}: EmptyStateProps) {
  const hero = size === "lg";
  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", hero ? "py-24" : "p-12")}>
      {tile ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-xs bg-blue-600/[0.08]">
          {icon}
        </div>
      ) : (
        icon
      )}
      <Text as="p">{title}</Text>
      {description && <Text as="p">{description}</Text>}
      {hint && <Text as="p">{hint}</Text>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
