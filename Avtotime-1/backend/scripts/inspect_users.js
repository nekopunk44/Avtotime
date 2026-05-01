import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import User from "../models/user.model.js";
import connectDb from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env") });

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run in production.");
    process.exit(1);
  }

  await connectDb();

  const users = await User.find({})
    .select("_id name userName email createdAt updatedAt")
    .sort({ createdAt: -1 })
    .lean();

  console.log(`Users in DB: ${users.length}`);
  for (const u of users) {
    console.log(
      `${u._id} | ${u.email} | ${u.userName} | ${u.name} | createdAt=${u.createdAt?.toISOString?.() ?? u.createdAt}`
    );
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
