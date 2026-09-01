import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.join(__dirname, "..");

let memoryServer;

/**
 * Boots one in-memory MongoDB for the whole run and hands its URI to the
 * workers. `process.env` is inherited by the forked pool, and `provide` covers
 * pools that do not inherit it.
 */
export default async function setup({ provide }) {
  const downloadDir =
    process.env.MONGOMS_DOWNLOAD_DIR || path.join(backendRoot, ".mongo-binaries");
  const tmpDir = process.env.MONGOMS_TMP_DIR || path.join(backendRoot, ".mongo-tmp");
  fs.mkdirSync(downloadDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  process.env.MONGOMS_DOWNLOAD_DIR = downloadDir;
  process.env.MONGOMS_TMP_DIR = tmpDir;

  memoryServer = await MongoMemoryServer.create({
    instance: { dbName: "avtotime_test", ip: "127.0.0.1" },
    binary: { downloadDir },
  });

  const uri = memoryServer.getUri("avtotime_test");
  process.env.MONGODB_URL = uri;
  process.env.MONGO_IN_MEMORY = "true";
  provide?.("MONGODB_URL", uri);

  return async () => {
    await memoryServer?.stop();
    memoryServer = undefined;
  };
}
