import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env") });

const CANDIDATE_URIS = [
  process.env.MONGODB_INSPECT_URI,
  process.env.MONGODB_URL,
  // Common local MongoDB defaults
  "mongodb://127.0.0.1:27017/avtotime",
  "mongodb://127.0.0.1:27017/test",
].filter(Boolean);

async function tryConnect(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1200 });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to inspect DB in production.");
    process.exit(1);
  }

  let connected = false;
  for (const uri of CANDIDATE_URIS) {
    // eslint-disable-next-line no-await-in-loop
    connected = await tryConnect(uri);
    if (connected) break;
  }

  if (!connected) {
    console.error(
      "Cannot connect to MongoDB. Set MONGODB_INSPECT_URI or ensure local MongoDB is running on 127.0.0.1:27017."
    );
    process.exit(1);
  }

  const db = mongoose.connection.db;
  console.log(`Connected: ${mongoose.connection.host}:${mongoose.connection.port}/${db.databaseName}`);

  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name).sort((a, b) => a.localeCompare(b));

  console.log(`Collections (${names.length}):`);
  for (const name of names) {
    // eslint-disable-next-line no-await-in-loop
    const count = await db.collection(name).estimatedDocumentCount().catch(() => null);
    // eslint-disable-next-line no-await-in-loop
    const doc = await db.collection(name).findOne({}, { projection: { _id: 1 } }).catch(() => null);
    // eslint-disable-next-line no-await-in-loop
    const fullDoc = await db.collection(name).findOne({ _id: doc?._id }).catch(() => null);
    const keys = fullDoc ? Object.keys(fullDoc).sort((a, b) => a.localeCompare(b)) : [];

    console.log(`- ${name}${typeof count === "number" ? ` (${count})` : ""}`);
    if (keys.length) {
      console.log(`  keys: ${keys.join(", ")}`);
    } else {
      console.log("  keys: (empty)");
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err?.stack || err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

