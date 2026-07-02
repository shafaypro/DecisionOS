import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { getSessionSecret } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
// Pre-hardening fixed salt. Retained ONLY so ciphertext written before the
// per-record-salt change still decrypts (legacy 3-segment format below).
const LEGACY_SALT = "decisonos-integration-salt";

function deriveKey(salt: Buffer | string): Buffer {
  return scryptSync(getSessionSecret(), salt, 32);
}

/**
 * Encrypts plaintext using AES-256-GCM with a per-record random salt.
 * Returns a colon-separated string: salt:iv:authTag:ciphertext (all hex).
 */
export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    salt.toString("hex"),
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a string produced by encrypt().
 *
 * Accepts two formats for backward compatibility:
 *   - salt:iv:authTag:ciphertext  (current - per-record random salt)
 *   - iv:authTag:ciphertext       (legacy - fixed salt, pre-hardening data)
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");

  let salt: Buffer | string;
  let ivHex: string | undefined;
  let authTagHex: string | undefined;
  let dataHex: string | undefined;

  if (parts.length === 4) {
    salt = Buffer.from(parts[0], "hex");
    [, ivHex, authTagHex, dataHex] = parts;
  } else if (parts.length === 3) {
    salt = LEGACY_SALT;
    [ivHex, authTagHex, dataHex] = parts;
  } else {
    throw new Error("Invalid ciphertext format");
  }

  if (!ivHex || !authTagHex || !dataHex) throw new Error("Invalid ciphertext format");

  const key = deriveKey(salt);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
