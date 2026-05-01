import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readSecretFile = (filePath) => {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  return fs.readFileSync(absPath, "utf8").trim();
};

// Local/dev convenience: load backend/.env by default.
// Production should use hosting secrets or *_FILE secret mounts.
if (process.env.NODE_ENV !== "production") {
  const dotenvPath = process.env.DOTENV_PATH
    ? path.resolve(process.env.DOTENV_PATH)
    : path.join(__dirname, "..", ".env");
  dotenv.config({ path: dotenvPath });
}

// Generic secret-file support:
// If you set e.g. JWT_SECRET_FILE=/run/secrets/jwt_secret, we read it and populate JWT_SECRET.
for (const [key, value] of Object.entries(process.env)) {
  if (!key.endsWith("_FILE")) continue;
  if (!value) continue;

  const baseKey = key.slice(0, -5);
  if (process.env[baseKey]) continue;

  try {
    process.env[baseKey] = readSecretFile(value);
  } catch (err) {
    // Fail fast only when a dependent secret is actually used.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `Failed to read secret file for ${key}: ${err?.message || err}`,
      );
    }
  }
}

