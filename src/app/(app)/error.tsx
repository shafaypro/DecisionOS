"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { AlertTriangle } from "lucide-react";

/**
 * Error boundary for the authenticated app. Every (app) page is a server
 * component that queries Prisma directly, so a DB hiccup or a thrown error would
 * otherwise fall through to Next's unstyled framework fallback. This keeps the
 * app shell and offers a retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it in the console for local debugging; server logs capture the rest.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <AlertTriangle className="h-16 w-16 text-slate-300 mb-4" />
      <Text as="h1">Something went wrong</Text>
      <Text as="p">
        We couldn&apos;t load this page. Try again — if it keeps happening, contact
        your workspace admin.
      </Text>
      {error?.digest && (
        <Text as="p" size="xs" color="subtle">
          Reference: {error.digest}
        </Text>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
