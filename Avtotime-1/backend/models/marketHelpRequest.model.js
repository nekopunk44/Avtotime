import mongoose from "mongoose";
import { decryptString, encryptString } from "../services/crypto/fieldEncryption.js";

const marketHelpRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user: { type: String, required: true, trim: true },
    time: { type: String, default: "только что" },
    location: { type: String, required: true, trim: true, set: encryptString, get: decryptString },
    description: { type: String, required: true, trim: true, set: encryptString, get: decryptString },
    status: { type: String, enum: ["active", "resolved"], default: "active" },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    moderationStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "approved",
      index: true,
    },
    moderationReasons: { type: [String], default: [] },
    moderationProvider: { type: String, default: "" },
    moderationCheckedAt: { type: Date, default: null },
    moderationFlagged: { type: Boolean, default: null },
    moderationCategories: { type: mongoose.Schema.Types.Mixed, default: null },
    moderationScores: { type: mongoose.Schema.Types.Mixed, default: null },
    moderationRawId: { type: String, default: null },
    moderationRawModel: { type: String, default: null },
    moderationAttempts: { type: Number, default: 0, min: 0 },
    moderationLastError: { type: String, default: "" },
    moderationLock: { type: Date, default: null, index: true },
  },
  { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } },
);

marketHelpRequestSchema.index({ moderationStatus: 1, createdAt: -1 });
marketHelpRequestSchema.index({ author: 1, createdAt: -1 });

const MarketHelpRequest = mongoose.model("MarketHelpRequest", marketHelpRequestSchema);

export default MarketHelpRequest;
