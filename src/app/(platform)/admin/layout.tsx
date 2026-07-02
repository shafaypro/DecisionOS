import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/auth-guards";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Platform (provider) console shell. Deliberately distinct from the company
 * AppShell so a platform admin is never confused about which surface they're on.
 * Gating is layered: proxy.ts already blocks /admin for non-staff; this re-checks
 * server-side as defense in depth.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isPlatformAdmin(session.platformRole)) redirect("/decisions");

  return (
    <ToastProvider>
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-900 px-5">
        <Link href="/admin" className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <Text size="lg" weight="semibold" color="inverse" tracking="tight">
            DecisionOS Platform
          </Text>
        </Link>
        <div className="flex items-center gap-3">
          <Text size="xs" color="inverse">
            {session.email}
          </Text>
          <Button asChild variant="secondary" size="sm">
            <Link href="/decisions">Exit console</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
      </main>
    </div>
    </ToastProvider>
  );
}
