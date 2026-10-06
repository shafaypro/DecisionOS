import { randomBytes } from "node:crypto";
import { getBaseUrl } from "./email";

/** 144 random bits, URL-safe. Unguessable, and unrelated to the decision id. */
export function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Absolute URL of a decision's public read-only page. */
export function shareUrl(token: string): string {
  return `${getBaseUrl().replace(/\/$/, "")}/share/${token}`;
}
