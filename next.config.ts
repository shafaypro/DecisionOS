import type { NextConfig } from "next";

/**
 * Security headers applied to every response. Trade-offs:
 * - CSP is intentionally lenient on `style-src` because Tailwind v4 inlines
 *   styles via <style> tags during SSR. Tightening this requires nonces.
 * - `frame-ancestors 'none'` blocks iframing - supersedes X-Frame-Options on
 *   modern browsers but we keep both for older agents.
 * - HSTS is only sent in production. In dev (HTTP localhost) it would
 *   needlessly pin the browser to HTTPS.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.anthropic.com https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const productionOnlyHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  async headers() {
    const headers =
      process.env.NODE_ENV === "production"
        ? [...securityHeaders, ...productionOnlyHeaders]
        : securityHeaders;
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
