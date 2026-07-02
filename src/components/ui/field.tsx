import * as React from "react";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

export type FieldChromeProps = {
  label?: React.ReactNode;
  labelClassName?: string;
  hint?: React.ReactNode;
  hintClassName?: string;
  labelAction?: React.ReactNode;
  fieldClassName?: string;
  suffix?: React.ReactNode;
};

export function useFieldId(id?: string, label?: React.ReactNode) {
  const autoId = React.useId();
  return id ?? (label != null && label !== "" ? autoId : undefined);
}

export function FieldFrame({
  id,
  label,
  hint,
  labelAction,
  fieldClassName,
  suffix,
  children,
}: FieldChromeProps & {
  id?: string;
  children: React.ReactNode;
}) {
  const hasChrome = label != null || hint != null || labelAction != null || suffix != null;
  if (!hasChrome) return <>{children}</>;

  return (
    <div className={cn("space-y-1.5", fieldClassName)}>
      {(label != null || labelAction != null) && (
        <div className={cn("flex items-baseline justify-between gap-2", label == null && "justify-end")}>
          {label != null && (
            <Text as="label" htmlFor={id} size="sm" color="secondary" weight="medium" leading="none">
              {label}
            </Text>
          )}
          {labelAction}
        </div>
      )}
      {suffix ? (
        <div className="flex items-center gap-2">
          {children}
          {suffix}
        </div>
      ) : (
        children
      )}
      {hint != null && (
        <Text as="div" size="xs" color="subtle">
          {hint}
        </Text>
      )}
    </div>
  );
}
