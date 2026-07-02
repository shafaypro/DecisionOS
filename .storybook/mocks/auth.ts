/**
 * Storybook stub for src/actions/auth.ts.
 *
 * The real module is a "use server" file that imports Prisma (and through it
 * the `pg` driver, which needs Node's `net`) - none of which can run in the
 * browser bundle Storybook builds. Components only use `logout`, so this
 * provides browser-safe no-ops. main.ts aliases @/actions/auth here.
 */
export type AuthState = { error?: string; success?: boolean };

export async function logout(): Promise<void> {
  // no-op in Storybook
  console.log("[storybook] logout() called");
}

export async function login(): Promise<AuthState> {
  return { error: "login is mocked in Storybook" };
}

export async function signup(): Promise<AuthState> {
  return { error: "signup is mocked in Storybook" };
}
