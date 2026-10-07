"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { setPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

export function SetPasswordForm({
  token,
  email,
  defaultName,
  isInvite,
}: {
  token: string;
  email: string;
  defaultName: string;
  isInvite: boolean;
}) {
  const [state, action, pending] = useActionState(setPassword, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <div className="flex items-center gap-2 rounded-xs bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-text-danger" />
          <Text>{state.error}</Text>
        </div>
      )}
      <Input label="Email address" id="email" type="email" value={email} readOnly autoComplete="username" />
      {isInvite && (
        <Input
          label="Your name"
          id="name"
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          defaultValue={state?.values?.name ?? defaultName}
          hint="How teammates will see you on decisions and reviews."
        />
      )}
      <Input
        label={isInvite ? "Choose a password" : "New password"}
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder="Min. 8 characters"
      />
      <Input
        label="Confirm password"
        id="confirm"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : isInvite ? "Join workspace" : "Set new password"}
      </Button>
    </form>
  );
}
