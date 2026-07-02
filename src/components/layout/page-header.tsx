import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

export function PageHeader({
  title,
  description,
  icon,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          {typeof title === "string" ? (
            <Text as="h1" size="xl" weight="bold" color="primary">
              {title}
            </Text>
          ) : (
            title
          )}
          {description != null && (
            <Text as="p" size="sm" color="muted">
              {description}
            </Text>
          )}
          {children}
        </div>
      </div>
      {actions}
    </div>
  );
}
