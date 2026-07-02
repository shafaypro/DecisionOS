import { Text } from "@/components/ui/text";
import type { TextSize } from "@/lib/typography";

/**
 * DecisionOS brand mark - two rounded pillars, blue and red.
 *
 * Shared component so the landing, login, signup, and pricing surfaces render
 * one identical, on-brand logo. Server-safe (no hooks).
 */

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Render the soft glow behind the mark. */
  glow?: boolean;
}

export function LogoMark({ size = 36, className, glow = true }: LogoMarkProps) {
  return (
    <div className={className} style={{ position: "relative", lineHeight: 0 }}>
      {glow && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "30%",
            background: "rgba(0,100,255,0.40)",
            filter: "blur(8px)",
            transform: "scale(1.4)",
          }}
        />
      )}
      <svg
        className="relative"
        width={size}
        height={size}
        viewBox="0 0 168 168"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="DecisionOS"
      >
        <path d="M80 128C80 150.091 62.0914 168 40 168C17.9086 168 6.44344e-08 150.091 0 128V88H80V128Z" fill="#0064FF" />
        <path d="M40 0C62.0914 0 80 17.9086 80 40V80H0V40C0 17.9086 17.9086 0 40 0Z" fill="#0064FF" />
        <path d="M168 128C168 150.091 150.091 168 128 168C105.909 168 88 150.091 88 128V88H168V128Z" fill="#FE0000" />
        <path d="M128 0C150.091 0 168 17.9086 168 40V80H88V40C88 17.9086 105.909 0 128 0Z" fill="#FE0000" />
      </svg>
    </div>
  );
}

/** Gradient "DecisionOS" wordmark. Pair with <LogoMark/> for the full lockup. */
export function Wordmark({ size = "base" }: { size?: TextSize }) {
  return (
    <Text
      as="span"
      style={{
        background: "#2563eb",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
      size={size}
      color="inherit"
      weight="extrabold"
      tracking="tight"
    >
      DecisionOS
    </Text>
  );
}
