"use client";

import { useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Persistent bar shown while a platform admin is "entered" into a company. Makes
 * the impersonation unmistakable and offers a one-click way back to the console.
 */
export function ImpersonationBanner({ workspaceName }: { workspaceName: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();

  function exit() {
    start(async () => {
      try {
        const res = await fetch("/api/platform/exit", { method: "POST" });
        if (!res.ok) throw new Error("Could not exit");
        window.location.assign("/admin");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-1.5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-950" />
        <Text size="xs" weight="medium" className="text-amber-950">
          Viewing <strong>{workspaceName}</strong> as platform admin
        </Text>
      </div>
      <Button variant="secondary" size="sm" disabled={pending} onClick={exit}>
        Exit to console
      </Button>
    </div>
  );
}
