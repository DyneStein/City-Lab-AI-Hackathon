import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * AES-256-GCM helpers. Format: base64(iv[12] | tag[16] | ciphertext).
 *
 * In development, if DATA_ENCRYPTION_KEY is not set, a random key is generated once
 * and written to DATA_DIR/.dev-key (mode 600). Production must set the env var.
 */
function loadKey(): Buffer {
  if (env.DATA_ENCRYPTION_KEY) {
    const k = Buffer.from(env.DATA_ENCRYPTION_KEY, "base64");
    if (k.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    return k;
  }
  if (env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY is required in production");
  const dir = path.resolve(env.DATA_DIR);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, ".dev-key");
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
}

const g = globalThis as unknown as { __nuskhaKey?: Buffer };
const key = () => (g.__nuskhaKey ??= loadKey());

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function decryptBuffer(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}

export const encryptText = (s: string) => encryptBuffer(Buffer.from(s, "utf8")).toString("base64");
export const decryptText = (s: string) => decryptBuffer(Buffer.from(s, "base64")).toString("utf8");
export const encryptJson = (v: unknown) => encryptText(JSON.stringify(v));
export const decryptJson = <T>(s: string): T => JSON.parse(decryptText(s)) as T;

export const sha256 = (data: string | Buffer) => crypto.createHash("sha256").update(data).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

/* ── Encrypted blob storage on local disk ── */

const blobDir = () => {
  const d = path.resolve(env.DATA_DIR, "blobs");
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
};

export function putBlob(storageKey: string, data: Buffer) {
  if (!/^[A-Za-z0-9_-]+$/.test(storageKey)) throw new Error("invalid storage key");
  fs.writeFileSync(path.join(blobDir(), storageKey), encryptBuffer(data), { mode: 0o600 });
}

export function getBlob(storageKey: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(storageKey)) throw new Error("invalid storage key");
  return decryptBuffer(fs.readFileSync(path.join(blobDir(), storageKey)));
}

export function deleteBlob(storageKey: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(storageKey)) return;
  fs.rmSync(path.join(blobDir(), storageKey), { force: true });
}
