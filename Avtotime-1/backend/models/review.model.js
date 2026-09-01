import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
    },
    listingType: {
      type: String,
      enum: [
        "car",
        "car-service",
        "auto-tuning",
        "consultation",
        "dry-cleaning",
        "eco-tip",
        "help-request",
      ],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    title: {
      type: String,
      maxlength: 100,
    },
    comment: {
      type: String,
      maxlength: 1000,
    },
    pros: [String],
    cons: [String],
    helpful: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    unhelpful: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Индексы
reviewSchema.index({ targetUser: 1, listingType: 1 });
// Review list + rating aggregation for a profile: match on targetUser, sort by
// createdAt.
reviewSchema.index({ targetUser: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, targetUser: 1, listing: 1 }, { unique: true });
reviewSchema.index({ createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
