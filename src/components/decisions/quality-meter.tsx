import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  QUALITY_META,
  scoreDecisionQuality,
  type DecisionQualityInput,
} from "@/lib/decision-quality";

/**
 * "Will this record still be useful in six months?" - the record-quality score
 * with the highest-value gaps listed underneath, so the answer comes with a
 * next action rather than just a number.
 */
export function QualityMeter({
  decision,
  maxGaps = 3,
  className,
}: {
  decision: DecisionQualityInput;
  maxGaps?: number;
  className?: string;
}) {
  const quality = scoreDecisionQuality(decision);
  const meta = QUALITY_META[quality.grade];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5", meta.tone)}>
          <Text as="span" size="2xs" weight="medium" color="inherit">
            {meta.label}
          </Text>
        </span>
        <Text as="span" size="2xs" color="muted">
          {quality.score}/100
        </Text>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="meter"
        aria-valuenow={quality.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Record quality score"
      >
        <div className={cn("h-full rounded-full", meta.bar)} style={{ width: `${quality.score}%` }} />
      </div>

      <Text as="p" size="2xs" color="muted">
        {meta.hint}
      </Text>

      {quality.gaps.length > 0 && (
        <ul className="space-y-1 pt-1">
          {quality.gaps.slice(0, maxGaps).map((gap) => (
            <li key={gap.key} className="flex gap-1.5">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
              <Text as="span" size="2xs" color="muted">
                <Text as="span" size="2xs" weight="medium" color="secondary">
                  {gap.label}:
                </Text>{" "}
                {gap.hint}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
