import mongoose from "mongoose";

const marketCarListingSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    image: { type: String, required: true },
    images: { type: [String], default: [] },
    price: { type: String, default: "" },
    title: { type: String, required: true, trim: true },
    mileage: { type: String, default: "" },
    fuel: { type: String, default: "" },
    transmission: { type: String, default: "" },
    year: { type: String, default: "" },
    location: { type: String, default: "" },
    seller: { type: String, default: "" },
    sellerAvatar: { type: String, default: "" },
    time: { type: String, default: "" },
    views: { type: String, default: "0" },
    type: { type: String, default: "" },
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    bodyType: { type: String, default: "" },
    driveType: { type: String, default: "" },
    engineVolume: { type: String, default: "" },
    seats: { type: String, default: "" },
    registrationPlace: { type: String, default: "" },
    region: { type: String, default: "" },
    description: { type: String, default: "" },
    socialNickname: { type: String, default: "", trim: true },
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
    priority:    { type: Number, default: 0, index: true },  // 0=free, 1=pro, 2=business
    expiresAt:   { type: Date, default: null, index: true }, // null = не истекает
    sellerBadge: { type: String, default: null }, // 'pro' | 'business' | null
    videoUrl:    { type: String, default: "" },   // YouTube/Vimeo URL (доступно для pro/business)
    priceNumeric:   { type: Number, default: 0, index: true },
    yearNumeric:    { type: Number, default: 0, index: true },
    mileageNumeric: { type: Number, default: 0, index: true },
    viewsTotal:  { type: Number, default: 0, min: 0 },
    leadsTotal:  { type: Number, default: 0, min: 0 },
    viewsByDay:  { type: Map, of: Number, default: () => new Map() },
    leadsByDay:  { type: Map, of: Number, default: () => new Map() },
  },
  { timestamps: true },
);

marketCarListingSchema.index({ moderationStatus: 1, createdAt: -1 });
marketCarListingSchema.index({ author: 1, createdAt: -1 });

const MarketCarListing = mongoose.model("MarketCarListing", marketCarListingSchema);

export default MarketCarListing;
