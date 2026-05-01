import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/user.model.js";

dotenv.config();

const mongoUrl =
  (process.env.MONGODB_URL && process.env.MONGODB_URL.trim()) ||
  process.env.MONGODB_FALLBACK_URL ||
  "mongodb://127.0.0.1:27017/avtotime";

const targetUserName = process.argv[2] || "neko_punk";

const main = async () => {
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });
  console.log("Connected to MongoDB");

  const result = await User.updateMany(
    { userName: targetUserName },
    { $set: { isEmailVerified: true } }
  );

  if (result.modifiedCount > 0) {
    console.log(`✅ Email verified for user: ${targetUserName}`);
  } else {
    console.log(`⚠️  User not found or already verified: ${targetUserName}`);
    // Verify all users as fallback
    const all = await User.updateMany({}, { $set: { isEmailVerified: true } });
    console.log(`✅ Verified all ${all.modifiedCount} users`);
  }

  await mongoose.disconnect();
};

main().catch((e) => { console.error(e); process.exit(1); });
