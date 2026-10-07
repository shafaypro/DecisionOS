/**
 * Invitation and password-reset links: mint the link, email it when SMTP is
 * configured, and set a new password from a link.
 */
import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { sendMail, getBaseUrl } from "./email";
import { escapeHtml } from "./markdown";
import {
  signPasswordToken,
  readPasswordToken,
  tokenMatchesPassword,
  type PasswordTokenPurpose,
} from "./password-token";

export const MIN_PASSWORD_LENGTH = 8;

/** The page a link opens; the token travels in the path. */
export function passwordLinkUrl(token: string): string {
  return `${getBaseUrl().replace(/\/$/, "")}/set-password/${encodeURIComponent(token)}`;
}

/**
 * Email an invitation to set a password and join `workspaceName`.
 * Returns the link and whether it was emailed. When it wasn't (no SMTP, or a
 * send failure), the inviting admin gets the link to pass on themselves -
 * otherwise the invitee would have no way in.
 */
export async function sendInviteLink(opts: {
  user: { id: string; email: string; passwordHash: string };
  workspaceName: string;
  inviterName: string;
}): Promise<{ url: string; emailed: boolean }> {
  const url = passwordLinkUrl(await signPasswordToken(opts.user, "invite"));
  const workspace = escapeHtml(opts.workspaceName);
  const inviter = escapeHtml(opts.inviterName);
  const emailed = await sendMail({
    to: opts.user.email,
    subject: `${opts.inviterName} invited you to ${opts.workspaceName} on DecisionOS`,
    html:
      `<p>${inviter} invited you to the <strong>${workspace}</strong> decision log on DecisionOS.</p>` +
      `<p><a href="${url}">Set your password and sign in &rarr;</a></p>` +
      `<p style="color:#64748b">This link works once and expires in 7 days.</p>`,
    text:
      `${opts.inviterName} invited you to the ${opts.workspaceName} decision log on DecisionOS.\n\n` +
      `Set your password and sign in: ${url}\n\nThis link works once and expires in 7 days.`,
  });
  return { url, emailed };
}

/** Email a one-hour reset link. Silent about whether the address exists. */
export async function sendResetLink(user: { id: string; email: string; passwordHash: string }): Promise<{
  url: string;
  emailed: boolean;
}> {
  const url = passwordLinkUrl(await signPasswordToken(user, "reset"));
  const emailed = await sendMail({
    to: user.email,
    subject: "Reset your DecisionOS password",
    html:
      `<p>Someone asked to reset the password for this DecisionOS account.</p>` +
      `<p><a href="${url}">Choose a new password &rarr;</a></p>` +
      `<p style="color:#64748b">The link works once and expires in 1 hour. If you didn't ask for this, ignore this email - your password stays the same.</p>`,
    text:
      `Someone asked to reset the password for this DecisionOS account.\n\n` +
      `Choose a new password: ${url}\n\n` +
      `The link works once and expires in 1 hour. If you didn't ask for this, ignore this email.`,
  });
  return { url, emailed };
}

export type PasswordLinkCheck =
  | { ok: true; user: { id: string; email: string; name: string }; purpose: PasswordTokenPurpose }
  | { ok: false; reason: "invalid" | "used" };

/** Validate a link without consuming it - for rendering the set-password page. */
export async function checkPasswordLink(token: string): Promise<PasswordLinkCheck> {
  const claims = await readPasswordToken(token);
  if (!claims) return { ok: false, reason: "invalid" };
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user) return { ok: false, reason: "invalid" };
  if (!tokenMatchesPassword(claims, user.passwordHash)) return { ok: false, reason: "used" };
  return { ok: true, user: { id: user.id, email: user.email, name: user.name }, purpose: claims.purpose };
}

/**
 * Set a new password from a link. Changing the hash invalidates this link and
 * every other outstanding one for the user. An invitee may also fix up the
 * display name, which the invite derived from their email address.
 */
export async function setPasswordFromLink(
  token: string,
  password: string,
  name?: string,
): Promise<{ ok: true; userId: string; purpose: PasswordTokenPurpose } | { ok: false; error: string }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  const check = await checkPasswordLink(token);
  if (!check.ok) {
    return {
      ok: false,
      error:
        check.reason === "used"
          ? "This link has already been used. Ask for a new one."
          : "This link is invalid or has expired. Ask for a new one.",
    };
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const trimmedName = name?.trim();
  await prisma.user.update({
    where: { id: check.user.id },
    data: { passwordHash, ...(trimmedName ? { name: trimmedName.slice(0, 100) } : {}) },
  });
  return { ok: true, userId: check.user.id, purpose: check.purpose };
}
