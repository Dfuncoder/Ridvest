/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REVERSIBLE ENCRYPTION for the few fields that must be stored but must not be
 * readable from the database alone — today, NIN and BVN numbers.
 *
 * AES-256-GCM, with the key held in KYC_ENCRYPTION_KEY and nowhere in the
 * database. That is the whole point: a leaked backup, a dumped table or a
 * read-only Postgres credential yields ciphertext and nothing else. Only the
 * running app, holding the environment variable, can turn it back into a
 * number.
 *
 * GCM is authenticated, so tampering is detected rather than silently
 * decrypting to rubbish. Each record is also bound to its owner through the
 * additional-authenticated-data argument: a ciphertext copied onto another
 * user's row fails to decrypt instead of quietly verifying the wrong person.
 *
 * ⚠ If KYC_ENCRYPTION_KEY is lost or changed, previously stored numbers can
 *   never be read again. Back the key up somewhere other than this repo and
 *   other than the database.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Bump this if the scheme ever changes, so old records stay readable. */
const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
/** 96 bits is the size GCM is specified around. */
const IV_BYTES = 12;
const KEY_BYTES = 32;

function secretKey(): Buffer {
  const raw = process.env.KYC_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("KYC_ENCRYPTION_KEY is not set — cannot encrypt or decrypt ID numbers");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `KYC_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}) — generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
  return key;
}

/** True when the app is configured to store encrypted values at all. */
export function encryptionConfigured(): boolean {
  try {
    secretKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts a value, bound to `context` — pass something that identifies the
 * row's owner, and pass the same value back to decryptSecret.
 *
 * Returns a single self-describing string: version.iv.tag.ciphertext, all
 * base64url, safe to keep in a text column.
 */
export function encryptSecret(plaintext: string, context: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, secretKey(), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Reverses encryptSecret. Throws if the key is wrong, the value was tampered
 * with, or `context` does not match the one it was encrypted under — never
 * returns a wrong answer in place of an error.
 */
export function decryptSecret(payload: string, context: string): string {
  const [version, ivPart, tagPart, ciphertextPart] = payload.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Unrecognised ciphertext format");
  }

  const decipher = createDecipheriv(ALGORITHM, secretKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
