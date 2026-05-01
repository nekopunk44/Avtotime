import crypto from "node:crypto";

const PREFIX = "enc:v1:";

const parseKey = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return null;

  // base64 (preferred)
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length === 32) return buf;
  } catch {
    // ignore
  }

  // hex
  try {
    const buf = Buffer.from(value, "hex");
    if (buf.length === 32) return buf;
  } catch {
    // ignore
  }

  // utf8 fallback (must be exactly 32 bytes)
  const buf = Buffer.from(value, "utf8");
  if (buf.length === 32) return buf;

  return null;
};

const getKey = () => {
  const key = parseKey(process.env.APP_ENC_KEY);
  if (!key) {
    throw new Error(
      "Field encryption is enabled but APP_ENC_KEY is missing/invalid (must be 32 bytes, base64/hex recommended).",
    );
  }
  return key;
};

export const isFieldEncryptionEnabled = () => {
  if (String(process.env.FIELD_ENCRYPTION_ENABLED).toLowerCase() === "true") return true;
  if (process.env.NODE_ENV === "production" && process.env.APP_ENC_KEY) return true;
  return false;
};

export const encryptString = (plain) => {
  if (!isFieldEncryptionEnabled()) return plain;
  if (plain == null) return plain;

  const text = String(plain);
  if (!text) return text;
  if (text.startsWith(PREFIX)) return text;

  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
};

export const decryptString = (value) => {
  if (!isFieldEncryptionEnabled()) return value;
  if (value == null) return value;

  const text = String(value);
  if (!text.startsWith(PREFIX)) return text;

  const payload = text.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return value;

  try {
    const key = getKey();
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // If key changed or data is corrupted, don't crash responses.
    return value;
  }
};

