"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OUTCOME_COLORS, cn } from "@/lib/utils";

interface InlineReviewButtonsProps {
  decisionId: string;
}

export function InlineReviewButtons({ decisionId }: InlineReviewButtonsProps) {
  const [done, setDone] = useState<"successful" | "mixed" | "unsuccessful" | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(outcomeStatus: "successful" | "mixed" | "unsuccessful", summary: string) {
    startTransition(async () => {
      const res = await fetch("/api/decisions/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, outcomeStatus, summary }),
      });
      if (res.ok) {
        setDone(outcomeStatus);
        router.refresh();
      }
    });
  }

  if (done) {
    const doneMeta = {
      successful: { label: "Marked as still valid", icon: CheckCircle2 },
      mixed: { label: "Marked as assumptions changed", icon: AlertTriangle },
      unsuccessful: { label: "Marked as didn't hold up", icon: XCircle },
    }[done];
    const DoneIcon = doneMeta.icon;
    return (
      <div className="mt-3">
        <Badge className={OUTCOME_COLORS[done]} icon={<DoneIcon className="h-3 w-3" />}>
          {doneMeta.label}
        </Badge>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Badge
        onClick={() => submit("successful", "Still valid, confirmed inline.")}
        disabled={pending}
        className={cn(OUTCOME_COLORS.successful, "hover:bg-green-100")}
        icon={<CheckCircle2 className="h-3 w-3" />}
      >
        Still valid
      </Badge>
      <Badge
        onClick={() => submit("mixed", "Assumptions have changed.")}
        disabled={pending}
        className={cn(OUTCOME_COLORS.mixed, "hover:bg-amber-100")}
        icon={<AlertTriangle className="h-3 w-3" />}
      >
        Assumptions changed
      </Badge>
      <Badge
        onClick={() => submit("unsuccessful", "Decision did not hold up.")}
        disabled={pending}
        className={cn(OUTCOME_COLORS.unsuccessful, "hover:bg-red-100")}
      >
        Didn&apos;t hold up
      </Badge>
    </div>
  );
}
