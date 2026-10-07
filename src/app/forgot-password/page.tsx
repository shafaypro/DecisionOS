"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "@/actions/auth";
import { AuthCard } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  return (
    <AuthCard subtitle="Reset your password">
      {state?.success ? (
        <div className="space-y-5">
          <div className="flex items-start gap-2 rounded-xs bg-emerald-50 border border-emerald-200 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-success" />
            <Text>{state.message}</Text>
          </div>
          <Text as="p" size="sm" color="muted">
            No email? Check spam, or ask a workspace admin - if your server has no email configured,
            they can share the link from the server log.
          </Text>
        </div>
      ) : (
        <form action={action} className="space-y-5">
          {state?.error && (
            <div className="flex items-center gap-2 rounded-xs bg-red-50 border border-red-200 px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-text-danger" />
              <Text>{state.error}</Text>
            </div>
          )}
          <Text as="p" size="sm" color="muted">
            Enter the email you sign in with. Invited but never set a password? This works for you too.
          </Text>
          <Input
            label="Email address"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state?.values?.email}
            placeholder="you@company.com"
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Text as="p" size="sm" className="mt-6 text-center">
        <Link href="/login" className="hover:underline">Back to sign in</Link>
      </Text>
    </AuthCard>
  );
}
