import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let memoryServer;
let cleanupInstalled = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const installMemoryCleanup = () => {
  if (cleanupInstalled) return;
  cleanupInstalled = true;

  const cleanup = async () => {
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }

    try {
      await memoryServer?.stop();
    } catch {
      // ignore
    }
  };

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });
};

const connectInMemory = async () => {
  const dbName = process.env.MONGO_DB_NAME || "avtotime";
  const downloadDir =
    process.env.MONGOMS_DOWNLOAD_DIR || path.join(__dirname, "..", ".mongo-binaries");
  const tmpDir = process.env.MONGOMS_TMP_DIR || path.join(__dirname, "..", ".mongo-tmp");
  const configuredPort = Number(process.env.MONGO_MEMORY_PORT);
  const port = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : undefined;
  const persist = String(process.env.MONGO_MEMORY_PERSIST).toLowerCase() === "true";
  const dbPathEnv = (process.env.MONGO_MEMORY_DB_PATH || "").trim();
  const dbPath = persist
    ? path.resolve(__dirname, "..", dbPathEnv || ".mongo-data")
    : undefined;

  const maybeResetDbPath = (error) => {
    if (!dbPath) return false;
    if (!persist) return false;
    const msg = String(error?.message || "");
    // Exit code 62 on Windows commonly indicates startup aborted due to incompatible data files
    // (for example "Wrong mongod version"/invalid featureCompatibilityVersion).
    if (!msg.includes('code "62"')) return false;
    if (!fs.existsSync(dbPath)) return false;

    const backup = `${dbPath}.broken-${Date.now()}`;
    try {
      fs.renameSync(dbPath, backup);
      fs.mkdirSync(dbPath, { recursive: true });
      console.warn(`In-memory MongoDB dbPath was incompatible; moved "${dbPath}" -> "${backup}"`);
      return true;
    } catch (renameError) {
      console.warn(
        `Failed to move incompatible in-memory MongoDB dbPath "${dbPath}": ${renameError?.message || renameError}`,
      );
      return false;
    }
  };

  // Ensure mongodb-memory-server can write within the repo (useful for sandboxed/dev environments).
  fs.mkdirSync(downloadDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  if (dbPath) {
    fs.mkdirSync(dbPath, { recursive: true });
  }
  process.env.MONGOMS_DOWNLOAD_DIR = downloadDir;
  process.env.MONGOMS_TMP_DIR = tmpDir;

  // If a fixed port is configured, first try to connect to an already-running mongod.
  // This avoids "DBPathInUse" when a previous mongodb-memory-server instance is still alive
  // (for example after a crash/restart or when MongoDB Compass is connected).
  if (port) {
    const reuseUrl = `mongodb://127.0.0.1:${port}/${dbName}`;
    try {
      await mongoose.connect(reuseUrl, { serverSelectionTimeoutMS: 800 });
      process.env.MONGO_IN_MEMORY = "true";
      console.log(`Connected to existing MongoDB on ${reuseUrl}`);
      return;
    } catch {
      try {
        await mongoose.connection.close();
      } catch {
        // ignore
      }
    }
  }

  if (!memoryServer) {
    const options = {
      instance: {
        dbName,
        ...(port ? { port } : {}),
        ...(dbPath ? { dbPath } : {}),
        ip: "127.0.0.1",
      },
      binary: { downloadDir },
    };

    try {
      memoryServer = await MongoMemoryServer.create(options);
    } catch (error) {
      if (maybeResetDbPath(error)) {
        memoryServer = await MongoMemoryServer.create(options);
      } else {
        throw error;
      }
    }
    installMemoryCleanup();
  }

  const mongoUrl = memoryServer.getUri();
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });
  process.env.MONGO_IN_MEMORY = "true";
  console.log(`Connected to in-memory MongoDB: ${mongoUrl}`);
};

const connectDb = async () => {
  try {
    const isProd = process.env.NODE_ENV === "production";

    // Opt-in: allow forcing in-memory mongo for local/dev runs.
    // - MONGO_IN_MEMORY=true
    // - MONGODB_URL="" (empty)
    const shouldUseInMemory =
      String(process.env.MONGO_IN_MEMORY).toLowerCase() === "true" ||
      (typeof process.env.MONGODB_URL === "string" && process.env.MONGODB_URL.trim() === "");

    if (!isProd && shouldUseInMemory) {
      await connectInMemory();
      return;
    }

    // Primary: connect to configured MongoDB (default is local daemon).
    // Configure with MONGODB_URL in backend/.env (default: mongodb://127.0.0.1:27017/avtotime).
    const mongoUrl =
      (process.env.MONGODB_URL && process.env.MONGODB_URL.trim()) ||
      process.env.MONGODB_FALLBACK_URL ||
      "mongodb://127.0.0.1:27017/avtotime";

    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 50),
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 10),
      maxIdleTimeMS: 60000,
      family: 4,
    });
    process.env.MONGO_IN_MEMORY = "false";

    console.log(`Connected to local MongoDB: ${mongoUrl}`);
  } catch (error) {
    const isProd = process.env.NODE_ENV === "production";
    const allowFallback =
      !isProd && String(process.env.MONGO_FALLBACK_TO_MEMORY).toLowerCase() === "true";

    if (allowFallback) {
      console.warn(
        `db error: ${error?.message || error}. Falling back to in-memory MongoDB (mongodb-memory-server) because MONGO_FALLBACK_TO_MEMORY=true.`
      );
      await connectInMemory();
      return;
    }

    console.error("db error:", error?.message || error);
    throw error;
  }
};

export default connectDb;
