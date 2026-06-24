// BYOK key encryption (AES-256-GCM, Node built-in crypto only — no deps).
// The master key wraps each user's own provider API key before it touches the DB;
// the backend stores ciphertext only. Plaintext keys and the master key itself are
// NEVER logged anywhere in this file.

import crypto from 'node:crypto';

// Fail fast at module load: a missing/short/invalid master key must crash the
// server on startup, not silently fall back to a weak or empty key. 32 bytes for
// AES-256, supplied as 64 hex chars in MASTER_ENCRYPTION_KEY.
const KEY_HEX = process.env.MASTER_ENCRYPTION_KEY;
if (!KEY_HEX) {
  throw new Error('MASTER_ENCRYPTION_KEY is not set — refusing to start.');
}
if (!/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
  throw new Error('MASTER_ENCRYPTION_KEY must be 64 hex chars (32 bytes) — refusing to start.');
}
const MASTER_KEY = Buffer.from(KEY_HEX, 'hex');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length

// Encrypt a plaintext key into a single string safe for one varchar column.
// Format: iv:authTag:ciphertext (all hex). A fresh random IV every call.
export function encryptKey(plaintext) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

// Reverse encryptKey. Throws on a malformed string or if the auth tag fails to
// verify (tampered/corrupted ciphertext) — callers should treat a throw as "no
// usable key", never as empty plaintext.
export function decryptKey(stored) {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('malformed ciphertext');
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
