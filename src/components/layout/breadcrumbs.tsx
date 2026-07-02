"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { Text } from "@/components/ui/text";

// Human labels for known path segments. Anything not listed is treated as a
// dynamic id and rendered with a context-aware fallback (see below).
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Health",
  decisions: "Decisions",
  new: "New",
  edit: "Edit",
  history: "History",
  graph: "Graph",
  board: "Board",
  reviews: "Reviews",
  analytics: "Analytics",
  team: "Team",
  tags: "Tags",
  "my-work": "My Work",
  settings: "Settings",
  integrations: "Integrations",
  sso: "SSO",
  templates: "Templates",
};

// cuid-style ids are long, alphanumeric, and have no label. When we hit one we
// label it from its parent segment instead of dumping the raw id.
const PARENT_ID_LABEL: Record<string, string> = {
  decisions: "Decision",
};

function isDynamicId(segment: string) {
  return !SEGMENT_LABELS[segment] && /^[a-z0-9]{12,}$/i.test(segment);
}

interface Crumb {
  label: string;
  href: string;
  isLast: boolean;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: Crumb[] = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const parent = segments[i - 1];
    const label = isDynamicId(segment)
      ? PARENT_ID_LABEL[parent] ?? "Detail"
      : SEGMENT_LABELS[segment] ?? segment;
    return { label, href, isLast: i === segments.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
      <Link
        href="/decisions"
        className="flex items-center text-text-subtle transition-colors hover:text-text-secondary"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map((crumb) => (
        <div key={crumb.href} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden />
          {crumb.isLast ? (
            <Text
              as="span"
              size="xs"
              color="secondary"
              weight="semibold"
              truncate
              aria-current="page"
            >
              {crumb.label}
            </Text>
          ) : (
            <Link
              href={crumb.href}
              className="min-w-0 truncate text-text-muted transition-colors hover:text-text-primary"
            >
              <Text as="span" size="xs" color="inherit" truncate>
                {crumb.label}
              </Text>
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
