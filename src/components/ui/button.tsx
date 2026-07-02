import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

// Make an icon-only button square: width matches the cva height, padding removed.
const ICON_ONLY_SIZE = {
  sm: "w-7 px-0",
  md: "w-8 px-0",
  lg: "w-10 px-0",
} as const;

// Text size/weight live ONLY here, on the button element - every child (plain
// string or asChild element) inherits it. Single source of truth.
const buttonVariants = cva(
  cn(
    "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded [--shadow-highlight:rgb(255_255_255_/_0.3)] [--shadow-lowlight:rgb(from_var(--color-slate-900)_r_g_b_/_0.15)] transition-all duration-200",
    "caps-label",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  ),
  {
    variants: {
      variant: {
        default: "bg-blue-600 bg-linear-to-b from-white/15 to-black/10 text-text-inverse shadow-soft hover:bg-blue-700",
        destructive: "bg-red-600 bg-linear-to-b from-white/10 to-black/2 text-text-inverse shadow-soft hover:bg-red-700",
        outline: "border border-slate-300/40 text-text-secondary hover:bg-slate-100",
        secondary: "bg-white bg-linear-to-b from-white/10 to-black/2 text-text-secondary shadow-soft hover:bg-slate-50",
        ghost: "text-text-secondary hover:bg-slate-100 hover:text-text-primary",
        link: "text-text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-7 px-3",
        md: "h-8 px-3",
        lg: "h-10 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Icon before the label. Icon-only (no children) auto-squares. Ignored when asChild - embed the icon in the child instead. */
  icon?: React.ReactNode;
  /** Icon after the label. Ignored when asChild. */
  iconRight?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, icon, iconRight, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const hasLabel = React.Children.count(children) > 0;
    const iconOnly = !asChild && !hasLabel && (!!icon || !!iconRight);
    // Padding base is 3; the side opposite an icon gets +1 (text breathes, icon hugs the edge).
    const padX = hasLabel && !iconOnly && (icon || iconRight)
      ? cn(icon ? "pl-3" : "pl-4", iconRight ? "pr-3" : "pr-4")
      : null;

    const content = asChild ? (
      children
    ) : (
      // Content sits a touch quieter at rest, full strength on hover.
      <span className="inline-flex items-center gap-2 opacity-80 transition-opacity duration-200 group-hover:opacity-100">
        {icon}
        {children}
        {iconRight}
      </span>
    );

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          // Leading/trailing icons sit one tone quieter than the label, lifting on hover.
          // Icon-only buttons are exempt below - the icon IS the content.
          "[&_svg]:opacity-55 [&_svg]:transition-opacity hover:[&_svg]:opacity-75",
          padX,
          iconOnly && cn(ICON_ONLY_SIZE[size ?? "md"], "rounded-full", "[&_svg]:opacity-100 hover:[&_svg]:opacity-100"),
          className,
        )}
        ref={ref}
        {...props}
      >
        {content}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
