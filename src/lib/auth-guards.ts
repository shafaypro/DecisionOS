/** Returns true if the role is viewer (read-only, cannot mutate). */
export function isViewer(role: string) {
  return role === "viewer";
}

/** Returns true if the role can perform write operations (admin or member). */
export function canWrite(role: string) {
  return role === "admin" || role === "member";
}

/** Returns true if the role is admin. */
export function isAdmin(role: string) {
  return role === "admin";
}

/**
 * Returns true if the session carries platform (provider) privilege. This is a
 * separate axis from the workspace `role` - a platform admin is identified by
 * `platformRole`, sourced from the PLATFORM_ADMIN_EMAILS allow-list at login.
 */
export function isPlatformAdmin(platformRole: string | undefined | null) {
  return platformRole === "superadmin";
}

export const VIEWER_ERROR = { error: "Viewers cannot perform this action." };
