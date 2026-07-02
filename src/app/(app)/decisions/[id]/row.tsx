import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

/**
 * The decision-detail row: label (2/9) beside content (7/9). The whole row is a
 * hover group so the label darkens when any part is hovered. A string label gets
 * the standard heading style; pass a node for a custom (e.g. interactive) label.
 */
export const Row = forwardRef<
  HTMLDivElement,
  { label: React.ReactNode; children: React.ReactNode } & ComponentPropsWithoutRef<"div">
>(function Row({ label, children, className, ...rest }, ref) {
  return (
    <div ref={ref} {...rest} className={cn("group lg:grid lg:grid-cols-9 lg:gap-8 lg:items-start", className)}>
      {typeof label === "string" ? (
        <Text
          as="h3"
          size="base"
          weight="semibold"
          color="secondary"
          className="lg:col-span-2 lg:pl-9 transition-colors group-hover:text-text-primary"
        >
          {label}
        </Text>
      ) : (
        <div className="lg:col-span-2">{label}</div>
      )}
      <div className="space-y-6 lg:col-span-7">{children}</div>
    </div>
  );
});
