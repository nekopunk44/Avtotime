import mongoose from "mongoose";

const marketDryCleaningListingSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    socialNickname: { type: String, default: "", trim: true },
    category: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviews: { type: Number, default: 0, min: 0 },
    price: { type: Number, required: true, min: 0 },
    // Валюта объявления. Хранится кодом: цена показывается по-разному в
    // разных местах, а вот источник у неё должен быть один.
    currency: { type: String, default: "EUR", trim: true },
    image: { type: String, required: true },
    // Первый кадр — обложка; он же лежит в image ради старых экранов.
    images: { type: [String], default: [] },
    badge: { type: String, default: "", trim: true },
    tags: { type: [String], default: [] },
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
    appealMessage: { type: String, default: "" },
    appealedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

marketDryCleaningListingSchema.index({ moderationStatus: 1, createdAt: -1 });
marketDryCleaningListingSchema.index({ author: 1, createdAt: -1 });

const MarketDryCleaningListing = mongoose.model("MarketDryCleaningListing", marketDryCleaningListingSchema);

export default MarketDryCleaningListing;
