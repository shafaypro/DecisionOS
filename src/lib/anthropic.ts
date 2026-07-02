import "server-only";

import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { logger } from "./logger";

/** Default model used when a workspace hasn't configured one explicitly. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";

/** Placeholder sent as the API key when a custom endpoint needs no auth. */
const NO_AUTH_PLACEHOLDER = "not-required";

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  /** Optional custom endpoint (self-hosted / Anthropic-compatible proxy). */
  baseUrl?: string;
}

/**
 * Resolve the Anthropic API key + model (+ optional base URL) for a workspace.
 *
 * Precedence: the workspace's encrypted `anthropic` integration row, then the
 * `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` environment variables, then `null`
 * (AI features off).
 *
 * A configured base URL is enough to enable AI on its own - local / self-hosted
 * gateways often need no key - so the resolver returns a config when *either* a
 * key or a base URL is present, substituting a placeholder key for the SDK.
 *
 * Shared by every AI feature (decision drafting, Ask DecisionOS) so the
 * resolution rules stay in one place.
 */
export async function resolveAnthropicConfig(
  workspaceId: string,
): Promise<AnthropicConfig | null> {
  const row = await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: "anthropic" } },
  });

  if (row?.isActive) {
    try {
      const cfg = JSON.parse(decrypt(row.configJson)) as {
        apiKey?: string;
        model?: string;
        baseUrl?: string;
      };
      const baseUrl = cfg.baseUrl?.trim() || undefined;
      const apiKey = cfg.apiKey?.trim() || "";
      if (apiKey || baseUrl) {
        return {
          apiKey: apiKey || NO_AUTH_PLACEHOLDER,
          model: cfg.model?.trim() || DEFAULT_ANTHROPIC_MODEL,
          baseUrl,
        };
      }
    } catch (err) {
      // A corrupt/unreadable config shouldn't take down the feature - fall through.
      logger.warn("anthropic_config_unreadable", { workspaceId, err: err instanceof Error ? err.message : String(err) });
    }
  }

  // Deployment-level fallback. Unlike the per-workspace config (where a custom
  // base URL alone can enable a no-auth self-hosted gateway), the env fallback
  // requires a key: `ANTHROPIC_BASE_URL` is only an endpoint override and must
  // not, on its own, flip AI on for every workspace.
  const envKey = process.env.ANTHROPIC_API_KEY?.trim() || "";
  if (envKey) {
    return {
      apiKey: envKey,
      model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
    };
  }

  return null;
}

/** Whether any AI feature is available for this workspace (no secret exposed). */
export async function isAIConfigured(workspaceId: string): Promise<boolean> {
  return (await resolveAnthropicConfig(workspaceId)) !== null;
}
