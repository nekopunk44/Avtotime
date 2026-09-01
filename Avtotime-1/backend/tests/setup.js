import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, inject } from "vitest";

const resolveUri = () => {
  if (process.env.MONGODB_URL?.trim()) return process.env.MONGODB_URL.trim();
  try {
    return inject("MONGODB_URL");
  } catch {
    return undefined;
  }
};

beforeAll(async () => {
  const uri = resolveUri();
  if (!uri) {
    throw new Error("MONGODB_URL was not provided by tests/globalSetup.js");
  }

  // A stray connection to the developer's real database would be wiped by the
  // afterEach cleanup below, so refuse anything the global setup did not hand us.
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.close();
});
