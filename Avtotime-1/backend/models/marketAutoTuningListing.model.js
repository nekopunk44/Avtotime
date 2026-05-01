import mongoose from "mongoose";

const marketAutoTuningListingSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      required: true,
    },
    badge: {
      type: String,
      default: "",
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    socialNickname: {
      type: String,
      default: "",
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
    appealMessage: { type: String, default: "" },
    appealedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

marketAutoTuningListingSchema.index({ moderationStatus: 1, createdAt: -1 });
marketAutoTuningListingSchema.index({ author: 1, createdAt: -1 });

const MarketAutoTuningListing = mongoose.model(
  "MarketAutoTuningListing",
  marketAutoTuningListingSchema,
);

export default MarketAutoTuningListing;
