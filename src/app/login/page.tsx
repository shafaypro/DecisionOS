"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Text } from "@/components/ui/text";
import { AlertCircle, Lock } from "lucide-react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {});
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoSlug, setSsoSlug] = useState("");

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-4"
      style={{ background: "var(--gradient-ink)" }}
    >
      <div className="relative w-full max-w-md animate-enter">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex justify-center">
            <LogoMark size={56} />
          </div>
          <Wordmark size="3xl" />
          <Text as="p">
            Sign in to your workspace
          </Text>
        </div>

        {/* Card */}
        <div className="rounded-xs bg-white p-8 shadow-soft">
          <form action={action} className="space-y-5">
            {state?.error && (
              <div className="flex items-center gap-2 rounded-xs bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-text-danger" />
                <Text>
                  {state.error}
                </Text>
              </div>
            )}

            <Input
              label="Email address"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
            />

            <Input
              label="Password"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {/* SSO affordance */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            {!ssoOpen ? (
              <button
                type="button"
                onClick={() => setSsoOpen(true)}
                className="group w-full flex items-center justify-center gap-2 py-2 rounded-xs hover:bg-slate-50 transition-colors text-text-secondary hover:text-text-primary"
              >
                <Lock className="h-4 w-4" />
                <Text>
                  Sign in with SSO
                </Text>
              </button>
            ) : (
              <Input
                label="Workspace slug"
                id="sso-slug"
                value={ssoSlug}
                onChange={(e) => setSsoSlug(e.target.value.trim())}
                placeholder="acme"
                suffix={
                  <Button
                    type="button"
                    disabled={!ssoSlug}
                    onClick={() => {
                      window.location.href = `/api/auth/sso/${encodeURIComponent(ssoSlug)}/start`;
                    }}
                  >
                    Continue
                  </Button>
                }
              />
            )}
          </div>

          <Text as="p">
            Don&apos;t have an account?{" "}
            <Link href="/signup">
              <Text as="span">
                Create workspace
              </Text>
            </Link>
          </Text>
        </div>

        <Text as="p">
          A structured system of record for team decisions
        </Text>

        <Text as="p" size="xs" color="faint" className="mt-3 text-center">
          By continuing you agree to our{" "}
          <Text as={Link} href="/terms" size="xs" color="faint" className="underline">Terms</Text>{" "}
          and{" "}
          <Text as={Link} href="/privacy" size="xs" color="faint" className="underline">Privacy Policy</Text>.
        </Text>
      </div>
    </div>
  );
}
