import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    listingType: {
      type: String,
      enum: [
        "car",
        "car-service",
        "part",
        "auto-tuning",
        "consultation",
        "dry-cleaning",
        "eco-tip",
        "game",
        "kids-activity",
        "help-request",
      ],
      required: true,
    },
    listingTitle: String,
    listingImage: String,
    listingPrice: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Индекс для быстрого поиска
favoriteSchema.index({ user: 1, listingId: 1, listingType: 1 }, { unique: true });

const Favorite = mongoose.model("Favorite", favoriteSchema);

export default Favorite;
