import Review from "../models/review.model.js";
import User from "../models/user.model.js";
import { createNotification } from "./notification.controllers.js";

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

    if (!targetUserId) {
      return res.status(400).json({ message: "Требуется targetUserId" });
    }

    const filter = { targetUser: targetUserId };

    if (listingType) {
      filter.listingType = String(listingType).toLowerCase();
    }

    if (listingId) {
      filter.listing = listingId;
    }

    // The list is capped, but stats are computed over ALL matching ratings via
    // a ratings-only projection so the numbers stay exact and cheap.
    const [reviews, ratings] = await Promise.all([
      Review.find(filter)
        .populate("reviewer", "name userName profileImage")
        .populate("targetUser", "name userName profileImage")
        .sort({ createdAt: -1 })
        .limit(200),
      Review.find(filter).select("rating").lean(),
    ]);

    const totalReviews = ratings.length;
    const avgRating =
      totalReviews > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(
            1
          )
        : 0;

    const ratingBreakdown = {
      5: ratings.filter((r) => r.rating === 5).length,
      4: ratings.filter((r) => r.rating === 4).length,
      3: ratings.filter((r) => r.rating === 3).length,
      2: ratings.filter((r) => r.rating === 2).length,
      1: ratings.filter((r) => r.rating === 1).length,
    };

    return res.status(200).json({
      reviews,
      stats: {
        totalReviews,
        avgRating,
        ratingBreakdown,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUserRatingStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const reviews = await Review.find({ targetUser: userId }).select("rating").lean();

    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(
            1
          )
        : 0;

    const ratingBreakdown = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

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
