import mongoose from "mongoose";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";
import { createNotification } from "./notification.controllers.js";

const toObjectId = (value) =>
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;

// Counts come from one $group instead of loading every rating into Node and
// scanning the array five times. `$match` in an aggregation is NOT cast by
// mongoose, so ids must be real ObjectIds here.
const buildRatingStats = async (match) => {
  const rows = await Review.aggregate([
    { $match: match },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);

  const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalReviews = 0;
  let ratingSum = 0;

  for (const row of rows || []) {
    const rating = Number(row?._id);
    const count = Number(row?.count) || 0;
    if (!Number.isFinite(rating)) continue;
    totalReviews += count;
    ratingSum += rating * count;
    if (ratingBreakdown[rating] !== undefined) ratingBreakdown[rating] += count;
  }

  return {
    totalReviews,
    avgRating: totalReviews > 0 ? (ratingSum / totalReviews).toFixed(1) : 0,
    ratingBreakdown,
  };
};

export const addReview = async (req, res) => {
  try {
    const {
      targetUserId,
      listingId,
      listingType,
      rating,
      title,
      comment,
      pros,
      cons,
      isVerifiedPurchase,
    } = req.body;

    if (!targetUserId || !rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Требуются корректные данные рейтинга" });
    }

    // Нельзя накручивать собственный рейтинг
    if (String(targetUserId) === String(req.userId)) {
      return res.status(400).json({ message: "Нельзя оставить отзыв самому себе" });
    }

    const targetExists = await User.exists({ _id: targetUserId });
    if (!targetExists) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Check if already reviewed
    const existing = await Review.findOne({
      reviewer: req.userId,
      targetUser: targetUserId,
      listing: listingId,
    });

    if (existing) {
      return res.status(400).json({ message: "Вы уже оставили отзыв" });
    }

    const review = await Review.create({
      reviewer: req.userId,
      targetUser: targetUserId,
      listing: listingId,
      listingType,
      rating: Number(rating),
      title: title ? String(title).trim() : "",
      comment: comment ? String(comment).trim() : "",
      pros: Array.isArray(pros) ? pros.map((p) => String(p).trim()) : [],
      cons: Array.isArray(cons) ? cons.map((c) => String(c).trim()) : [],
      isVerifiedPurchase: Boolean(isVerifiedPurchase),
    });

    const populated = await review.populate([
      { path: "reviewer", select: "name userName profileImage" },
      { path: "targetUser", select: "name userName profileImage" },
    ]);

    // Notify target user
    await createNotification({
      recipient: targetUserId,
      actor: req.userId,
      type: "mention",
      title: "Новый отзыв",
      description: `${populated.reviewer.userName} оставил(а) отзыв: ${rating} ⭐`,
      relatedId: review._id,
      relatedType: "review",
      link: `/reviews/${review._id}`,
    });

    return res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Отзыв уже существует" });
    }
    return res.status(500).json({ message: error.message });
  }
};

export const getReviews = async (req, res) => {
  try {
    const { targetUserId, listingType, listingId } = req.query;

    const targetId = toObjectId(targetUserId);
    if (!targetId) {
      return res.status(400).json({ message: "Требуется targetUserId" });
    }

    const filter = { targetUser: targetId };

    if (listingType) {
      filter.listingType = String(listingType).toLowerCase();
    }

    if (listingId) {
      const listingObjectId = toObjectId(listingId);
      if (!listingObjectId) {
        return res.status(400).json({ message: "Некорректный listingId" });
      }
      filter.listing = listingObjectId;
    }

    // The list is capped; the stats come from an aggregation over ALL matching
    // ratings, so the numbers stay exact without loading the documents.
    const [reviews, stats] = await Promise.all([
      Review.find(filter)
        .populate("reviewer", "name userName profileImage")
        .populate("targetUser", "name userName profileImage")
        .sort({ createdAt: -1 })
        .limit(200),
      buildRatingStats(filter),
    ]);

    return res.status(200).json({ reviews, stats });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUserRatingStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetId = toObjectId(userId);
    if (!targetId) {
      return res.status(400).json({ message: "Некорректный userId" });
    }

    const { totalReviews, avgRating, ratingBreakdown } = await buildRatingStats({
      targetUser: targetId,
    });

    return res.status(200).json({
      avgRating: Number(avgRating),
      totalReviews,
      ratingBreakdown,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment, pros, cons } = req.body;

    const review = await Review.findOne({ _id: reviewId, reviewer: req.userId });

    if (!review) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: "Рейтинг должен быть от 1 до 5" });
    }

    if (rating !== undefined) review.rating = Number(rating);
    if (title !== undefined) review.title = String(title).trim();
    if (comment !== undefined) review.comment = String(comment).trim();
    if (pros && Array.isArray(pros)) review.pros = pros.map((p) => String(p).trim());
    if (cons && Array.isArray(cons)) review.cons = cons.map((c) => String(c).trim());

    await review.save();
    const populated = await review.populate([
      { path: "reviewer", select: "name userName profileImage" },
      { path: "targetUser", select: "name userName profileImage" },
    ]);

    return res.status(200).json(populated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const deleted = await Review.findOneAndDelete({
      _id: reviewId,
      reviewer: req.userId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const markHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    const userId = req.userId;
    const alreadyMarked = review.helpful.some((id) =>
      id.equals(userId)
    );

    if (alreadyMarked) {
      review.helpful = review.helpful.filter((id) => !id.equals(userId));
    } else {
      review.helpful.push(userId);
      // Remove from unhelpful if was there
      review.unhelpful = review.unhelpful.filter((id) => !id.equals(userId));
    }

    await review.save();
    return res.status(200).json(review);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const markUnhelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    const userId = req.userId;
    const alreadyMarked = review.unhelpful.some((id) =>
      id.equals(userId)
    );

    if (alreadyMarked) {
      review.unhelpful = review.unhelpful.filter((id) => !id.equals(userId));
    } else {
      review.unhelpful.push(userId);
      // Remove from helpful if was there
      review.helpful = review.helpful.filter((id) => !id.equals(userId));
    }

    await review.save();
    return res.status(200).json(review);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
