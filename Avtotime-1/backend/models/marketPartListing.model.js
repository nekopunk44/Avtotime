import mongoose from "mongoose";

const marketPartListingSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    image: { type: String, required: true },
    images: { type: [String], default: [] },
    price: { type: String, default: "" },
    // Валюта объявления. Хранится кодом: цена показывается по-разному в
    // разных местах, а вот источник у неё должен быть один.
    currency: { type: String, default: "EUR", trim: true },
    title: { type: String, required: true, trim: true },
    // Car compatibility (optional, used for filters)
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    year: { type: String, default: "" },
    // Marketplace common fields (kept compatible with frontend `Car` card shape)
    mileage: { type: String, default: "" },
    fuel: { type: String, default: "" },
    transmission: { type: String, default: "" },
    location: { type: String, default: "" },
    seller: { type: String, default: "" },
    sellerAvatar: { type: String, default: "" },
    time: { type: String, default: "" },
    views: { type: String, default: "0" },
    type: { type: String, default: "" },
    region: { type: String, default: "" },
    description: { type: String, default: "" },
    socialNickname: { type: String, default: "", trim: true },
    // Parts taxonomy
    partGroup: { type: String, default: "" },
    partCategory: { type: String, default: "" },
    partCategoryKey: { type: String, default: "", index: true },
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
    priority:    { type: Number, default: 0, index: true },
    expiresAt:   { type: Date, default: null, index: true },
    sellerBadge: { type: String, default: null },
    videoUrl:    { type: String, default: "" },
    priceNumeric: { type: Number, default: 0, index: true },
    yearNumeric:  { type: Number, default: 0, index: true },
    viewsTotal:  { type: Number, default: 0, min: 0 },
    leadsTotal:  { type: Number, default: 0, min: 0 },
    viewsByDay:  { type: Map, of: Number, default: () => new Map() },
    leadsByDay:  { type: Map, of: Number, default: () => new Map() },
  },
  { timestamps: true },
);

marketPartListingSchema.index({ moderationStatus: 1, createdAt: -1 });
marketPartListingSchema.index({ author: 1, createdAt: -1 });
// Storefront sort ({ priority: -1, createdAt: -1 }) — without this the query
// falls back to a collection scan plus an in-memory sort, which starts failing
// with "Sort exceeded memory limit" once the collection grows.
marketPartListingSchema.index({ moderationStatus: 1, priority: -1, createdAt: -1 });

const MarketPartListing = mongoose.model("MarketPartListing", marketPartListingSchema);

export default MarketPartListing;
