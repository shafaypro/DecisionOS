import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Text } from "@/components/ui/text";
import {
  Zap,
  Search,
  Bell,
  Shield,
  ArrowRight,
  MessageSquare,
  Check,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "DecisionOS: institutional memory for teams that ship",
  description:
    "Capture why decisions were made, in under 15 seconds, from Slack or the web. Close the loop with automatic review reminders. For VP Eng at 25-150 person SaaS companies.",
};

export default async function LandingPage() {
  // Authenticated visitors go straight to their decision log.
  const session = await getSession();
  if (session) redirect("/decisions");

  return (
    <div className="min-h-screen bg-white">
      {/* ================= Hero band (dark, on-brand) ================= */}
      <div
        className="relative overflow-hidden text-white"
        style={{ background: "var(--gradient-ink)" }}
      >
        {/* Top bar */}
        <header className="relative">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark size={32} />
              <Wordmark size="lg" />
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="https://github.com/shafaypro/DecisionOS"
                className="rounded-xs px-3 py-1.5 transition-colors text-text-faint hover:text-text-inverse"
              >
                <Text>
                  GitHub
                </Text>
              </Link>
              <Link
                href="/login"
                className="rounded-xs px-3 py-1.5 transition-colors text-text-faint hover:text-text-inverse"
              >
                <Text>
                  Log in
                </Text>
              </Link>
              <Link
                href="/signup"
                className="ml-1 rounded-xs px-4 py-2 transition-all hover:-translate-y-0.5"
                style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-brand)" }}
              >
                <Text>
                  Get started
                </Text>
              </Link>
            </nav>
          </div>
          <div className="shimmer-line h-px w-full" />
        </header>

        {/* Hero */}
        <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-28">
          <div className="animate-enter">
            <span
              className="eyebrow inline-flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ background: "rgba(99,102,241,0.14)", border: "1px solid rgba(129,140,248,0.25)" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <Text>
                Institutional memory, not another doc tool
              </Text>
            </span>
            <Text as="h1">
              Your team forgets{" "}
              <Text as="span">
                why
              </Text>
              .<br />
              DecisionOS remembers.
            </Text>
            <Text as="p">
              Capture why the decision was made, in 15 seconds, from Slack or the web. Close the loop
              with automatic review reminders. Built for VP Eng and PM leaders at 25-150 person SaaS
              companies.
            </Text>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xs px-6 py-3 transition-all hover:-translate-y-0.5"
                style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-brand-lg)" }}
              >
                <Text>
                  Get started, it&apos;s free
                </Text>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="https://github.com/shafaypro/DecisionOS"
                className="inline-flex items-center gap-2 rounded-xs px-6 py-3 transition-colors glass-dark text-text-faint hover:text-text-inverse"
              >
                <Text>
                  View on GitHub
                </Text>
              </Link>
            </div>
            <Text as="p">
              Free and open source. Self-host it - unlimited members and decisions, no plans, no limits.
            </Text>
          </div>

          {/* Product visual - a real-shaped decision record on a glass panel */}
          <div className="mt-14 lg:mt-0 lg:self-center">
            <div className="animate-enter animate-enter-delay-2 relative">
              <div className="glass-dark relative rounded-xs p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1">
                    <div className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                    <Text>
                      Approved
                    </Text>
                  </span>
                  <Text>
                    Reviewed in 90 days
                  </Text>
                </div>
                <Text as="h3">
                  Move auth from Auth0 to a custom JWT layer
                </Text>
                <Text as="p">
                  Full control of the session payload and no per-MAU pricing as we scale past 50k users.
                </Text>
                <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                  <Row label="Rationale" value="Cost + payload control beat vendor lock-in" />
                  <Row label="Alternatives" value="Stay on Auth0 · Clerk · WorkOS" />
                  <Row label="Owner" value="Priya, VP Engineering" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {["Engineering", "High impact"].map((t) => (
                    <Text key={t} as="span">
                      {t}
                    </Text>
                  ))}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <Text>
                      Captured from Slack
                    </Text>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ================= The pain ================= */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          <Pain title="&quot;Why did we pick this auth provider?&quot;">
            The engineer who decided left 4 months ago. The Slack thread is gone. The Notion page is a
            graveyard.
          </Pain>
          <Pain title="&quot;Should we revisit this?&quot;">
            You set a 90-day review in a calendar and nobody clicked it. Nothing followed up. The
            assumption quietly broke.
          </Pain>
          <Pain title="&quot;We just re-decided the same thing.&quot;">
            Two quarters, two architecture debates, same outcome. Nobody remembered the first one.
          </Pain>
        </div>
      </section>

      {/* ================= How it works ================= */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <Text as="h2">
            Capture in Slack. Find it in 2 seconds. Review when it matters.
          </Text>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <Step
              icon={MessageSquare}
              step="01"
              title="Capture"
              body="Type /decisionos log in any Slack channel. A modal pops up asking title, rationale, and optional review date. Submit. Done in under 15 seconds."
            />
            <Step
              icon={Search}
              step="02"
              title="Retrieve"
              body="Press ⌘K anywhere in the app. Search title, rationale, problem statement, or Solution. Everything is indexed. Share read-only links with stakeholders."
            />
            <Step
              icon={Bell}
              step="03"
              title="Review"
              body="Set a review date when you capture. At the 90-day mark we email the owner: ✓ Still valid · ⚠ Assumptions changed · Didn't hold up. One click closes the loop."
            />
          </div>
        </div>
      </section>

      {/* ================= Feature grid ================= */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <Text as="h2">
          Built narrow on purpose
        </Text>
        <Text as="p">
          We do one thing: remember why. Not project management, not a wiki, not a whiteboard.
        </Text>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Feature
            icon={Zap}
            title="Slack capture bot"
            body="The must-have integration. /decisionos log works from any channel. Users run it, not admins, so there's zero barrier."
          />
          <Feature
            icon={Bell}
            title="Review reminders with one-click responses"
            body="Signed magic links let the owner mark a decision valid or broken from email, without opening the app."
          />
          <Feature
            icon={Search}
            title="Full-text search over rationale"
            body="⌘K palette searches title, rationale, problem, Solution. The thing that actually matters when you're looking for a past decision."
          />
          <Feature
            icon={Shield}
            title="SSO, audit log, and self-hosting"
            body="OIDC SSO (Okta, Google, Azure AD, Auth0), an immutable audit log, and encrypted secrets at rest - all included. Self-host on your own infrastructure."
          />
        </div>
      </section>

      {/* ================= Positioning ================= */}
      <section
        className="relative overflow-hidden py-20 text-white"
        style={{ background: "var(--gradient-ink)" }}
      >
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <Text as="p">
            &ldquo;Notion is where your docs go to die. Linear is for what you&apos;re doing. DecisionOS is for
            <Text as="em"> why you did it.</Text>
            &rdquo;
          </Text>
          <Text as="p">
            How we pitch it in 60 seconds
          </Text>
        </div>
      </section>

      {/* ================= Final CTA ================= */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Text as="h2">
          Ship with memory.
        </Text>
        <Text as="p">
          Free and open source. Install the Slack bot in 3 minutes. Your team will thank you in
          6 months.
        </Text>
        <ul className="mt-8 inline-flex flex-col gap-2 text-left">
          <CheckRow>Open source - self-host it anywhere</CheckRow>
          <CheckRow>Unlimited members and decisions</CheckRow>
          <CheckRow>Slack capture works day one</CheckRow>
          <CheckRow>Export everything as CSV anytime</CheckRow>
        </ul>
        <div className="mt-8">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xs px-7 py-3 transition-all hover:-translate-y-0.5"
            style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-brand-lg)" }}
          >
            <Text>
              Create your workspace
            </Text>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={20} glow={false} />
            <Text>
              DecisionOS
            </Text>
          </div>
          <div className="flex items-center gap-4">
            <Link href="https://github.com/shafaypro/DecisionOS" className="text-text-subtle hover:text-text-muted">
              <Text>
                GitHub
              </Text>
            </Link>
            <Link href="/login" className="text-text-subtle hover:text-text-muted">
              <Text>
                Log in
              </Text>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 flex-shrink-0">
        <Text as="span">
          {label}
        </Text>
      </span>
      <Text as="span">
        {value}
      </Text>
    </div>
  );
}

function Pain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lift-card rounded-xs bg-white p-5">
      <Text as="h3">
        {title}
      </Text>
      <Text as="p">
        {children}
      </Text>
    </div>
  );
}

function Step({
  icon: Icon,
  step,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xs text-white"
          style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-brand)" }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <Text>
          {step}
        </Text>
      </div>
      <Text as="h3">
        {title}
      </Text>
      <Text as="p">
        {body}
      </Text>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="lift-card flex gap-4 rounded-xs bg-white p-6">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xs bg-blue-50 text-blue-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <Text as="h3">
          {title}
        </Text>
        <Text as="p">
          {body}
        </Text>
      </div>
    </div>
  );
}

function CheckRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 text-text-success" />
      <Text>
        {children}
      </Text>
    </li>
  );
}
