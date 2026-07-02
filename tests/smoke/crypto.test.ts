import { createCipheriv, randomBytes, scryptSync } from "crypto";
import { encrypt, decrypt } from "../../src/lib/crypto";
import { getSessionSecret } from "../../src/lib/env";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// Reproduce the pre-hardening "fixed salt, 3-segment" ciphertext so we can prove
// decrypt() still reads data written before per-record salts existed.
const LEGACY_SALT = "decisonos-integration-salt";
function legacyEncrypt(plaintext: string): string {
  const key = scryptSync(getSessionSecret(), LEGACY_SALT, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

export const cryptoTests = {
  "round-trips plaintext": () => {
    const secret = "xoxb-super-secret-slack-bot-token-1234567890";
    assert(decrypt(encrypt(secret)) === secret, "decrypt(encrypt(x)) must equal x");
  },

  "current format is salt:iv:authTag:ciphertext (4 segments)": () => {
    const out = encrypt("hello");
    assert(out.split(":").length === 4, "new ciphertext must have 4 colon-separated segments");
  },

  "per-record salt makes ciphertext non-deterministic": () => {
    assert(encrypt("same") !== encrypt("same"), "two encryptions of the same input must differ");
  },

  "decrypts legacy 3-segment (fixed-salt) ciphertext": () => {
    const secret = "legacy-stored-integration-secret";
    const legacy = legacyEncrypt(secret);
    assert(legacy.split(":").length === 3, "legacy ciphertext should have 3 segments");
    assert(decrypt(legacy) === secret, "must decrypt legacy fixed-salt ciphertext");
  },

  "rejects malformed ciphertext": () => {
    let threw = false;
    try {
      decrypt("not-a-valid-ciphertext");
    } catch {
      threw = true;
    }
    assert(threw, "malformed ciphertext must throw");
  },
};
