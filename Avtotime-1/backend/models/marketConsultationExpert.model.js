import mongoose from "mongoose";

const marketConsultationExpertSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      required: true,
    },
    socialNickname: {
      type: String,
      default: "",
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    specialties: {
      type: [String],
      default: [],
    },
    experience: {
      type: Number,
      default: 0,
      min: 0,
    },
    consultations: {
      type: Number,
      default: 0,
      min: 0,
    },
    hourlyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      required: true,
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

marketConsultationExpertSchema.index({ moderationStatus: 1, createdAt: -1 });
marketConsultationExpertSchema.index({ author: 1, createdAt: -1 });

const MarketConsultationExpert = mongoose.model(
  "MarketConsultationExpert",
  marketConsultationExpertSchema,
);

export default MarketConsultationExpert;
