"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { signup } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Text } from "@/components/ui/text";
import { AlertCircle } from "lucide-react";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const [state, action, pending] = useActionState(signup, {});

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
            Create your team workspace
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
              label="Workspace name"
              id="workspaceName"
              name="workspaceName"
              type="text"
              required
              placeholder="Acme Inc"
              hint="Your company or team name"
            />

            <Input
              label="Your name"
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Jane Smith"
            />

            <Input
              label="Email address"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="jane@company.com"
            />

            <Input
              label="Password"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Min. 8 characters"
            />

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating workspace…" : "Create workspace"}
            </Button>
          </form>

          <Text as="p">
            Already have an account?{" "}
            <Link href="/login">
              <Text as="span">
                Sign in
              </Text>
            </Link>
          </Text>
        </div>

        <Text as="p">
          You&apos;ll be set up as workspace admin
        </Text>

        <Text as="p" size="xs" color="faint" className="mt-3 text-center">
          By creating a workspace you agree to our{" "}
          <Text as={Link} href="/terms" size="xs" color="faint" className="underline">Terms</Text>{" "}
          and{" "}
          <Text as={Link} href="/privacy" size="xs" color="faint" className="underline">Privacy Policy</Text>.
        </Text>
      </div>
    </div>
  );
}
