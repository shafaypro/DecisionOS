"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";

/**
 * Toggle whether the current user watches this decision. Watchers get an in-app
 * notification (and email, if SMTP is configured) whenever the decision changes.
 */
export function WatchButton({
  decisionId,
  initialWatching,
}: {
  decisionId: string;
  initialWatching: boolean;
}) {
  const [watching, setWatching] = useState(initialWatching);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await fetch(`/api/decisions/${decisionId}/watch`, {
        method: watching ? "DELETE" : "POST",
      });
      if (res.ok) {
        const json = await res.json();
        setWatching(Boolean(json.watching));
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={toggle}
      title={watching ? "You'll be emailed when this decision changes" : "Get notified when this decision changes"}
      className={watching ? "text-blue-600 border-blue-300 hover:text-blue-700" : "text-slate-500"}
    >
      {watching ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      {watching ? "Watching" : "Watch"}
    </Button>
  );
}
