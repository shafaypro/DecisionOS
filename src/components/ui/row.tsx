import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";
import { type TextSize } from "@/lib/typography";

// size → vertical padding. Row height = content + padding (not a fixed h-*),
// so top-aligned slots stay coherent across subtitle states.
const rowPadding = { sm: "py-1.5", md: "py-2.5" };

interface RowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightText?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  hover?: boolean;
  wrap?: boolean;
  /** Cross-axis alignment of the row's slots. Default "start" keeps top-aligned multi-line rows coherent. */
  align?: "start" | "center";
  size?: "sm" | "md";
  titleSize?: TextSize;
  /** Extra classes on the title cell - e.g. asymmetric padding to optically nudge the label. */
  titleClassName?: string;
  onClick?: () => void;
  className?: string;
  /** When true, title uses brand color (e.g. keyboard-selected palette row). */
  active?: boolean;
}

export const Row = forwardRef<
  HTMLDivElement,
  RowProps & Omit<ComponentPropsWithoutRef<"div">, keyof RowProps>
>(function Row({
  title, subtitle, rightText, leading, trailing,
  selected = false, disabled = false, hover, wrap = false, align = "start", size = "sm", titleSize = "sm", titleClassName, onClick, className,
  active = false, ...rest
}, ref) {
  const interactive = !!onClick;
  const showHover = hover ?? interactive;

  return (
    <div
      ref={ref}
      onClick={disabled ? undefined : onClick}
      {...rest}
      className={cn(
        "flex px-2 transition-colors",
        align === "center" ? "items-center" : "items-start",
        rowPadding[size],
        showHover && "group hover:bg-slate-50",
        interactive && "cursor-pointer",
        selected && "bg-slate-100",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {leading && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center [&>*]:m-0">{leading}</div>
      )}

      <div className={cn("min-w-0 flex-1 px-2", titleClassName)}>
        <Text as="div" size={titleSize} color="inherit" weight={active ? "medium" : undefined} truncate={!wrap}>
          {title}
        </Text>
        {subtitle != null && <Text as="div" size="xs" color="subtle" truncate={!wrap}>{subtitle}</Text>}
      </div>

      {rightText && (
        <Text as="span" size="xs" color="subtle">
          {rightText}
        </Text>
      )}

      {trailing && (
        <div className="flex h-6 shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {trailing}
        </div>
      )}
    </div>
  );
});
