import express from "express";
import isAuth from "../middlewars/isAuth.js";
import {
  addReview,
  deleteReview,
  getReviews,
  getUserRatingStats,
  markHelpful,
  markUnhelpful,
  updateReview,
} from "../controllers/review.controllers.js";

const reviewRouter = express.Router();

reviewRouter.post("/", isAuth, addReview);
reviewRouter.get("/", isAuth, getReviews);
reviewRouter.get("/user/:userId/stats", isAuth, getUserRatingStats);
reviewRouter.patch("/:reviewId", isAuth, updateReview);
reviewRouter.delete("/:reviewId", isAuth, deleteReview);
reviewRouter.post("/:reviewId/helpful", isAuth, markHelpful);
reviewRouter.post("/:reviewId/unhelpful", isAuth, markUnhelpful);

export default reviewRouter;
