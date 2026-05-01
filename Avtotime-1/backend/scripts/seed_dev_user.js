import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

dotenv.config();

const mongoUrl =
  (process.env.MONGODB_URL && process.env.MONGODB_URL.trim()) ||
  process.env.MONGODB_FALLBACK_URL ||
  "mongodb://127.0.0.1:27017/avtotime";

const seedUserName = process.env.DEV_SEED_USERNAME || "neko_punk";
const seedEmail = (process.env.DEV_SEED_EMAIL || "neko_punk@example.com").toLowerCase();
const seedName = process.env.DEV_SEED_NAME || "neko_punk";
const seedPassword = process.env.DEV_SEED_PASSWORD || "neko_punk123";
const seedForce = String(process.env.DEV_SEED_FORCE || "").toLowerCase() === "true";

const main = async () => {
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });

  const existing = await User.findOne({
    $or: [{ userName: seedUserName }, { email: seedEmail }],
  });

  if (!seedPassword || seedPassword.length < 6) {
    throw new Error("DEV_SEED_PASSWORD must be at least 6 characters.");
  }

  const hashedPassword = await bcrypt.hash(seedPassword, 10);

  if (existing) {
    if (!seedForce) {
      console.log(
        `Dev user already exists: userName="${existing.userName}" email="${existing.email}". ` +
          `Set DEV_SEED_FORCE=true to reset password.`,
      );
      await mongoose.disconnect();
      return;
    }

    existing.name = seedName;
    existing.userName = seedUserName;
    existing.email = seedEmail;
    existing.password = hashedPassword;
    existing.isEmailVerified = true;
    await existing.save();

    console.log(
      `Updated dev user: userName="${existing.userName}" email="${existing.email}"`,
    );
    await mongoose.disconnect();
    return;
  }

  const user = await User.create({
    name: seedName,
    userName: seedUserName,
    email: seedEmail,
    password: hashedPassword,
    isEmailVerified: true,
  });

  console.log(`Created dev user: userName="${user.userName}" email="${user.email}"`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("seed_dev_user failed:", error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
