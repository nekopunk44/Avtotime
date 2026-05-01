import mongoose from "mongoose";

const marketGameSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "Игры", trim: true },
    image: { type: String, default: "" },
    url: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

const MarketGame = mongoose.model("MarketGame", marketGameSchema);

export default MarketGame;

