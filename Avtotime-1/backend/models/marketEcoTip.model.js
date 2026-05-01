import mongoose from "mongoose";

const marketEcoTipSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, default: "Вождение", trim: true },
    date: { type: String, default: "" },
    image: { type: String, default: "" },
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
  { timestamps: true },
);

marketEcoTipSchema.index({ moderationStatus: 1, createdAt: -1 });
marketEcoTipSchema.index({ author: 1, createdAt: -1 });

const MarketEcoTip = mongoose.model("MarketEcoTip", marketEcoTipSchema);

export default MarketEcoTip;
