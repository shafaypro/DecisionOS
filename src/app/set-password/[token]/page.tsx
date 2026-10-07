import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AuthCard } from "@/components/layout/auth-card";
import { Text } from "@/components/ui/text";
import { checkPasswordLink } from "@/lib/password-links";
import { SetPasswordForm } from "./set-password-form";

export const metadata = { title: "Set your password", robots: { index: false } };

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SetPasswordPage({ params }: PageProps) {
  const { token } = await params;
  const link = await checkPasswordLink(decodeURIComponent(token));

  if (!link.ok) {
    return (
      <AuthCard subtitle="This link can't be used">
        <div className="flex items-start gap-2 rounded-xs bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-warning" />
          <Text>
            {link.reason === "used"
              ? "This link was already used to set a password. Links work once."
              : "This link is invalid or has expired."}
          </Text>
        </div>
        <Text as="p" size="sm" className="mt-6 text-center">
          <Link href="/forgot-password" className="underline">Get a new link</Link>
          {" · "}
          <Link href="/login" className="underline">Sign in</Link>
        </Text>
      </AuthCard>
    );
  }

  const isInvite = link.purpose === "invite";
  return (
    <AuthCard subtitle={isInvite ? "Welcome - set a password to join your team" : "Choose a new password"}>
      <SetPasswordForm
        token={decodeURIComponent(token)}
        email={link.user.email}
        defaultName={link.user.name}
        isInvite={isInvite}
      />
    </AuthCard>
  );
}
