import "server-only";

/**
 * Minimal OIDC helper. We don't pull in an OpenID client - we only need:
 *   - fetch discovery doc at {issuer}/.well-known/openid-configuration
 *   - redirect to authorization_endpoint with code flow + PKCE-free (client_secret)
 *   - exchange code at token_endpoint for an id_token
 *   - verify id_token signature using jwks_uri via `jose.createRemoteJWKSet`
 *
 * This supports any standard OIDC IdP: Okta, Google Workspace, Azure AD,
 * Auth0, Ping, JumpCloud, etc.
 */

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

const discoveryCache = new Map<string, { data: OidcDiscovery; expires: number }>();

export async function discoverOidc(issuerUrl: string): Promise<OidcDiscovery> {
  const now = Date.now();
  const cached = discoveryCache.get(issuerUrl);
  if (cached && cached.expires > now) return cached.data;

  const url = issuerUrl.replace(/\/$/, "") + "/.well-known/openid-configuration";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`OIDC discovery failed at ${url}: ${res.status}`);
  const data = (await res.json()) as OidcDiscovery;
  discoveryCache.set(issuerUrl, { data, expires: now + 15 * 60 * 1000 }); // 15 min
  return data;
}

export async function exchangeCodeForTokens(args: {
  tokenEndpoint: string;
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ id_token?: string; access_token?: string; error?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
  });
  const res = await fetch(args.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as { id_token?: string; access_token?: string; error?: string };
}
