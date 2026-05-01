import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    type: {
      type: String,
      enum: ["like", "comment", "follow", "message", "mention", "listing_comment", "listing_rejected", "listing_approved", "listing_appeal", "system"],
      required: true,
    },
    title: String,
    description: String,
    relatedId: mongoose.Schema.Types.ObjectId,
    relatedType: {
      type: String,
      enum: ["post", "loop", "story", "message", "listing", "user", "review", "market_listing"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    image: String,
    link: String,
    count: {
      type: Number,
      default: 1,
    },
    isBatched: {
      type: Boolean,
      default: false,
    },
    sendRetries: {
      type: Number,
      default: 0,
    },
    sentAt: Date,
    emailSent: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 30,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, relatedId: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
