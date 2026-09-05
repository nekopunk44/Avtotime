import mongoose from "mongoose";
import { MARKET_KIND_KEYS } from "../config/marketKinds.js";

// Stable keys, not display text: the label belongs to the client, and a stored
// Russian string would have to be migrated the day a second language appears.
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "violence",
  "sexual",
  "illegal",
  "scam",
  "misinformation",
  "copyright",
  "other",
];

export const REPORT_TARGET_TYPES = ["post", "loop", "comment", "user", "listing"];

export const REPORT_STATUSES = ["open", "actioned", "dismissed"];

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Only for targetType "listing": the marketplace has six kinds living in
    // six collections, so the id alone does not say where to look.
    targetKind: { type: String, enum: ["", ...MARKET_KIND_KEYS], default: "" },
    // Captured when the report is filed. Content gets deleted — often by the
    // author, precisely because it was reported — and without this the moderator
    // is left with a complaint about nobody.
    targetAuthor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    comment: { type: String, default: "", maxlength: 1000, trim: true },
    status: { type: String, enum: REPORT_STATUSES, default: "open", index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: "", maxlength: 1000, trim: true },
  },
  { timestamps: true },
);

// One report per person per target: without this a single user can bury the
// moderation queue under thousands of rows about one post.
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });
// The moderator's queue: oldest open first is what "within 24 hours" needs.
reportSchema.index({ status: 1, createdAt: 1 });
// "How much has been reported about this?" — the signal that matters more than
// any single complaint.
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ targetAuthor: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);
export default Report;
