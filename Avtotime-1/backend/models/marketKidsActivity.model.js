import mongoose from "mongoose";

const marketKidsActivitySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    type: { type: String, enum: ["Game", "Coloring", "Cartoon"], required: true },
    progress: { type: Number, default: null, min: 0, max: 100 },
    image: { type: String, default: "" },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

const MarketKidsActivity = mongoose.model("MarketKidsActivity", marketKidsActivitySchema);

export default MarketKidsActivity;

