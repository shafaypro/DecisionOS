import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import { Text } from "@/components/ui/text";

/**
 * Shared frame for the public legal pages (privacy, terms): a slim top bar, a
 * readable single column, and a footer. Pages pass a title, last-updated date,
 * and their content.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={28} glow={false} />
            <Text as="span">DecisionOS</Text>
          </Link>
          <div className="flex items-center gap-4">
            <Text as={Link} href="/privacy" size="sm" color="secondary">Privacy</Text>
            <Text as={Link} href="/terms" size="sm" color="secondary">Terms</Text>
            <Text as={Link} href="/login" size="sm" color="secondary">Log in</Text>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Text as="h1" size="2xl" weight="bold" color="primary" tracking="tight">{title}</Text>
        <Text as="p" size="sm" color="muted" className="mt-1">Last updated: {updated}</Text>

        <div className="legal-body mt-8 space-y-6">{children}</div>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center">
        <Text size="sm" color="muted">
          DecisionOS, institutional memory for teams that ship.
        </Text>
      </footer>
    </div>
  );
}

/** A titled section of legal copy. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <Text as="h2" size="lg" weight="semibold" color="primary">{heading}</Text>
      {children}
    </section>
  );
}
