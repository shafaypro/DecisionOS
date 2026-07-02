import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

/**
 * Resolve a Slack team ID to the linked DecisionOS workspace + a decrypted
 * bot token. Returns null if no active install exists.
 */
export async function getSlackLinkByTeam(slackWorkspaceId: string) {
  const link = await prisma.slackWorkspaceLink.findUnique({
    where: { slackWorkspaceId },
  });
  if (!link || !link.isActive) return null;
  let botToken: string;
  try {
    botToken = decrypt(link.slackBotToken);
  } catch {
    return null;
  }
  return { link, botToken };
}

/**
 * Look up the DecisionOS user id for a given Slack user inside a team.
 * Returns null if the Slack user hasn't linked their DecisionOS account yet.
 */
export async function getLinkedDecisionUser(slackUserId: string, slackWorkspaceId: string) {
  const userLink = await prisma.slackUserLink.findUnique({
    where: {
      slackUserId_slackWorkspaceId: { slackUserId, slackWorkspaceId },
    },
  });
  return userLink?.decisionUserId ?? null;
}
