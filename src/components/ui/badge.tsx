import Link from "next/link";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline";
  icon?: React.ReactNode;
  href?: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function Badge({
  children,
  className,
  variant = "outline",
  icon,
  href,
  title,
  onClick,
  disabled,
}: BadgeProps) {
  const classes = cn(
    "inline-flex h-6 items-center tracking-tighter gap-1 rounded-full border px-2",
    variant === "outline"
      ? "bg-transparent"
      : "bg-blue-50 text-blue-700 border-blue-100",
    onClick && "cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    className
  );

  const label =
    typeof children === "string" || typeof children === "number" ? (
      <span className="caps-label">{children}</span>
    ) : (
      children
    );

  const content = (
    <>
      {icon}
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} title={title} className={cn(classes, "hover:underline")}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={classes}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={classes} title={title}>
      {content}
    </span>
  );
}

/** A colored dot - an icon you drop into `Badge`'s `icon` slot. */
export function Dot({ className }: { className?: string }) {
  return <div className={cn("h-1.5 w-1.5 rounded-full", className)} aria-hidden />;
}
