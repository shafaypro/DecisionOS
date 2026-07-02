import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { FileSearch } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <FileSearch className="h-16 w-16 text-slate-300 mb-4" />
      <Text as="h1">
        Not Found
      </Text>
      <Text as="p">
        This resource doesn&apos;t exist or you don&apos;t have access to it.
      </Text>
      <Button asChild>
        <Link href="/decisions">
          Back to Decisions
        </Link>
      </Button>
    </div>
  );
}
