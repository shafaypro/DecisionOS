import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { FileSearch } from "lucide-react";

/**
 * Root 404 for routes outside the authenticated (app) group (landing, login,
 * signup, share, legal, and any unmatched top-level path). Links home rather
 * than to /decisions, since the visitor may not be signed in.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[70vh] text-center p-8">
      <FileSearch className="h-16 w-16 text-slate-300 mb-4" />
      <Text as="h1">Page not found</Text>
      <Text as="p">
        This page doesn&apos;t exist or may have moved.
      </Text>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
