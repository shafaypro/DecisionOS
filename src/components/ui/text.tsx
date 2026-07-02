import * as React from "react";
import { cn } from "@/lib/utils";
import {
  TEXT_SIZE,
  TEXT_SIZE_MD,
  TEXT_COLOR,
  FONT_WEIGHT,
  LEADING,
  TRACKING,
  VARIANT,
  TAG_VARIANT,
  type TextSize,
  type TextColor,
  type FontWeight,
  type Leading,
  type Tracking,
  type TextVariant,
} from "@/lib/typography";

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "download" | "target" | "rel"> {
  as?: React.ElementType;
  /** Baked style. Auto-selected from heading tags (h1-h6); set explicitly otherwise. */
  variant?: TextVariant;
  htmlFor?: string;
  size?: TextSize;
  sizeMd?: TextSize;
  color?: TextColor;
  weight?: FontWeight;
  leading?: Leading;
  tracking?: Tracking;
  truncate?: boolean;
  uppercase?: boolean;
  mono?: boolean;
  children?: React.ReactNode;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(function Text(
  {
    as: Component = "span",
    variant,
    size,
    sizeMd,
    color,
    weight,
    leading,
    tracking,
    truncate,
    uppercase,
    mono,
    className,
    children,
    htmlFor,
    ...props
  },
  ref,
) {
  const tag = typeof Component === "string" ? Component : undefined;
  const resolved = variant ?? (tag ? TAG_VARIANT[tag] : undefined);

  return (
    <Component
      ref={ref}
      htmlFor={htmlFor}
      className={cn(
        // Baked look: a named/heading variant carries the whole style. Otherwise the
        // plain default (span/body) stays text-sm + inherit so existing usage is unchanged.
        resolved ? VARIANT[resolved] : cn(TEXT_SIZE[size ?? "sm"], TEXT_COLOR[color ?? "inherit"]),
        // Optional overrides - applied last so tailwind-merge lets them win over the variant.
        size && TEXT_SIZE[size],
        sizeMd && TEXT_SIZE_MD[sizeMd],
        color && TEXT_COLOR[color],
        weight && FONT_WEIGHT[weight],
        leading && LEADING[leading],
        tracking && TRACKING[tracking],
        truncate && "truncate",
        uppercase && "uppercase",
        mono && "font-mono",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
});

Text.displayName = "Text";
