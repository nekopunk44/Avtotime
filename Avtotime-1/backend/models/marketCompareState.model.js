import mongoose from "mongoose";

const marketCompareItemSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    type: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const marketCompareStateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: { type: [marketCompareItemSchema], default: [] },
  },
  { timestamps: true },
);

const MarketCompareState = mongoose.model("MarketCompareState", marketCompareStateSchema);

export default MarketCompareState;

