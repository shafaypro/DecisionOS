import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

interface PageProps {
  searchParams: Promise<{ saved?: string }>;
}

export default async function SsoSettingsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/settings");

  const sp = await searchParams;
  const [workspace, ssoConfig] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: session.workspaceId } }),
    prisma.workspaceSsoConfig.findUnique({ where: { workspaceId: session.workspaceId } }),
  ]);
  if (!workspace) redirect("/settings");

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const redirectUri = `${base}/api/auth/sso/${workspace.slug}/callback`;
  const loginUrl = `${base}/login?sso=${workspace.slug}`;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      </Button>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-500" />
            <Text as="span">Single Sign-On (OIDC)</Text>
          </div>
        }
        description="Connect your identity provider (Okta, Google Workspace, Azure AD, Auth0, JumpCloud)."
      />

      {sp.saved === "1" && (
        <div className="rounded-xs border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-text-success" />
          <Text>SSO configuration saved.</Text>
        </div>
      )}

      {/* Provider-side config hints */}
      <div className="rounded-xs transition-all duration-200 p-5">
        <Text as="h3">
          What to configure at your IdP
        </Text>
        <dl className="space-y-2">
          <Row k="Redirect / Callback URL" v={redirectUri} />
          <Row k="Login URL for users" v={loginUrl} />
          <Row k="Scopes" v="openid email profile" />
          <Row k="Response type" v="code" />
        </dl>
      </div>

      {/* Config form */}
      <div className="rounded-xs transition-all duration-200 p-5">
        <form action="/api/settings/sso" method="POST" className="space-y-4">
          <Input
            label="Issuer URL"
            id="issuerUrl"
            name="issuerUrl"
            required
            placeholder="https://your-tenant.okta.com"
            defaultValue={ssoConfig?.issuerUrl ?? ""}
            hint={
              <>
                The OIDC issuer. We&apos;ll fetch{" "}
                <Text as="code">
                  {"{issuer}/.well-known/openid-configuration"}
                </Text>{" "}
                to discover endpoints.
              </>
            }
          />
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Client ID"
              id="clientId"
              name="clientId"
              required
              defaultValue={ssoConfig?.clientId ?? ""}
            />
            <Input
              label="Client Secret"
              id="clientSecret"
              name="clientSecret"
              type="password"
              placeholder={ssoConfig ? "••••••• (leave blank to keep)" : "Paste from your IdP"}
            />
          </div>
          <Input
            label="Allowed email domain (optional)"
            id="allowedEmailDomain"
            name="allowedEmailDomain"
            placeholder="acme.com"
            defaultValue={ssoConfig?.allowedEmailDomain ?? ""}
            hint="If set, only users with this email domain can sign in. Others are rejected."
          />
          <label htmlFor="enforced" className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="enforced"
              name="enforced"
              defaultChecked={ssoConfig?.enforced ?? false}
            />
            <Text as="span">
              Enforce SSO (disable email/password login for this workspace)
            </Text>
          </label>
          <div>
            <Button type="submit">
              Save SSO configuration
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-3">
      <Text as="dt">{k}</Text>
      <Text as="dd">{v}</Text>
    </div>
  );
}
