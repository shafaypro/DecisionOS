import { sparklinePoints } from "@/lib/trends";
import { cn } from "@/lib/utils";

/**
 * A dependency-free inline sparkline.
 *
 * A trend needs a shape, not a charting library: this is one polyline plus an
 * optional fill, sized by props and driven by `sparklinePoints` (where the
 * scaling edge cases live and are unit-tested).
 */
export function Sparkline({
  values,
  width = 120,
  height = 28,
  className,
  stroke = "var(--color-blue-500, #3b82f6)",
  fill = true,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  fill?: boolean;
  /** Accessible description; without it the graphic is hidden from screen readers. */
  label?: string;
}) {
  if (values.length === 0) return null;
  const points = sparklinePoints(values, width, height, 2);
  const areaPoints = `${points} ${width - 2},${height} 2,${height}`;
  const last = values[values.length - 1];
  // Read the end cap off the generated points - a single-value series is
  // centered rather than pinned to the right edge.
  const [lastX, lastY] = points.split(" ").pop()!.split(",").map(Number);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="none"
    >
      {fill && values.length > 1 && (
        <polygon points={areaPoints} fill={stroke} opacity={0.1} />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last > 0 && <circle cx={lastX} cy={lastY} r={2} fill={stroke} />}
    </svg>
  );
}
