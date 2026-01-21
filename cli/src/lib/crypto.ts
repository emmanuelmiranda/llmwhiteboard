import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(data: Buffer, keyHex: string): Buffer<ArrayBuffer> {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: IV (16 bytes) + Auth Tag (16 bytes) + Encrypted Data
  return Buffer.concat([iv, authTag, encrypted]) as Buffer<ArrayBuffer>;
}

export function decrypt(encryptedData: Buffer, keyHex: string): Buffer<ArrayBuffer> {
  const key = Buffer.from(keyHex, "hex");

  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]) as Buffer<ArrayBuffer>;
}

export function computeChecksum(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
