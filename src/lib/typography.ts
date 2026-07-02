/**
 * Typography tokens - mirrors Tailwind text utilities, backed by CSS vars in globals.css.
 * Line heights on the size scale are multiples of 4px (see --text-*--line-height).
 */

/** Size utilities - each bundles a 4px-grid line-height via @theme. */
export const TEXT_SIZE = {
  "2xs": "text-2xs",
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "4xl": "text-4xl",
  "5xl": "text-5xl",
  "display-1": "display-1",
  "display-2": "display-2",
} as const;

export type TextSize = keyof typeof TEXT_SIZE;

/** Responsive size overrides at the `md` breakpoint - literal classes so Tailwind can detect them. */
export const TEXT_SIZE_MD = {
  "2xs": "md:text-2xs",
  xs: "md:text-xs",
  sm: "md:text-sm",
  base: "md:text-base",
  lg: "md:text-lg",
  xl: "md:text-xl",
  "2xl": "md:text-2xl",
  "3xl": "md:text-3xl",
  "4xl": "md:text-4xl",
  "5xl": "md:text-5xl",
  "display-1": "md:display-1",
  "display-2": "md:display-2",
} as const;

/** Semantic text colors - text-text-* utilities from tokens. */
export const TEXT_COLOR = {
  primary: "text-text-primary",
  secondary: "text-text-secondary",
  muted: "text-text-muted",
  subtle: "text-text-subtle",
  faint: "text-text-faint",
  disabled: "text-text-disabled",
  brand: "text-text-brand",
  "brand-soft": "text-text-brand-soft",
  inverse: "text-text-inverse",
  danger: "text-text-danger",
  success: "text-text-success",
  warning: "text-text-warning",
  "warning-soft": "text-text-warning-soft",
  inherit: "text-inherit",
} as const;

export type TextColor = keyof typeof TEXT_COLOR;

/** font-* utilities */
export const FONT_WEIGHT = {
  thin: "font-thin",
  extralight: "font-extralight",
  light: "font-light",
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
  black: "font-black",
} as const;

export type FontWeight = keyof typeof FONT_WEIGHT;

/** leading-token-* - explicit 4px-grid line heights (px values divisible by 4). */
export const LEADING = {
  none: "leading-none",
  tight: "leading-tight",
  snug: "leading-snug",
  relaxed: "leading-relaxed",
  "4": "leading-token-4",
  "5": "leading-token-5",
  "6": "leading-token-6",
  "7": "leading-token-7",
  "8": "leading-token-8",
  "9": "leading-token-9",
  "10": "leading-token-10",
  "12": "leading-token-12",
} as const;

export type Leading = keyof typeof LEADING;

/** tracking-token-* utilities */
export const TRACKING = {
  tighter: "tracking-token-tighter",
  tight: "tracking-token-tight",
  normal: "tracking-token-normal",
  wide: "tracking-token-wide",
  wider: "tracking-token-wider",
  widest: "tracking-token-widest",
  caps: "tracking-token-caps",
} as const;

export type Tracking = keyof typeof TRACKING;

/**
 * Baked text styles - a complete look (size + weight + color + tracking) per name,
 * so a tag carries its whole style. `<Text as="h3">` resolves its variant from the
 * tag via TAG_VARIANT; pass `variant` to pick one explicitly. Individual props
 * (size/weight/color…) stay optional and override the baked value.
 */
export const VARIANT = {
  h1: "text-xl font-bold text-text-primary tracking-token-tight",
  h2: "text-base font-semibold text-text-primary tracking-token-tight",
  h3: "text-sm font-medium text-text-primary",
  h4: "text-sm font-semibold text-text-secondary",
  h5: "text-xs font-semibold text-text-primary",
  h6: "text-2xs font-semibold text-text-primary tracking-token-wide uppercase",
  body: "text-sm text-text-primary",
  "body-strong": "text-sm font-semibold text-text-primary",
  sm: "text-sm text-text-primary",
  "sm-bold": "text-sm font-semibold text-text-primary",
  xs: "text-xs text-text-secondary",
  eyebrow: "text-xs font-semibold text-text-subtle tracking-token-wide uppercase",
} as const;

export type TextVariant = keyof typeof VARIANT;

/** Default variant per semantic heading tag, so `<Text as="hN">` is fully styled. */
export const TAG_VARIANT: Record<string, TextVariant> = {
  h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6",
};
