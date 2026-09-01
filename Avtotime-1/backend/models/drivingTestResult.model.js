import mongoose from "mongoose";

const drivingTestResultSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["exam", "practice", "marathon"],
      required: true,
    },
    ticketNumbers: [Number],
    totalQuestions: {
      type: Number,
      required: true,
    },
    correctAnswers: {
      type: Number,
      required: true,
    },
    wrongAnswers: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
    },
    passed: {
      type: Boolean,
    },
    timeSpentSeconds: {
      type: Number,
    },
    answers: [
      {
        questionId: mongoose.Schema.Types.ObjectId,
        ticketNumber: Number,
        questionNumber: Number,
        selectedAnswer: Number,
        correctAnswer: Number,
        isCorrect: Boolean,
      },
    ],
    status: {
      type: String,
      enum: ["in_progress", "completed", "abandoned"],
      default: "in_progress",
    },
  },
  { timestamps: true }
);

// History list (match on user, sort by createdAt) and the statistics aggregation.
drivingTestResultSchema.index({ user: 1, createdAt: -1 });

const DrivingTestResult = mongoose.model("DrivingTestResult", drivingTestResultSchema);

export default DrivingTestResult;
