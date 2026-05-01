import mongoose from "mongoose";

const drivingQuestionSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: Number,
      required: true,
      index: true,
    },
    questionNumber: {
      type: Number,
      required: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    answers: [
      {
        number: Number,
        text: String,
      },
    ],
    correctAnswerNumber: {
      type: Number,
      required: true,
    },
    explanation: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    category: {
      type: String,
      default: "ПДД",
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Индекс для быстрого поиска вопросов
drivingQuestionSchema.index({ ticketNumber: 1, questionNumber: 1 }, { unique: true });

const DrivingQuestion = mongoose.model("DrivingQuestion", drivingQuestionSchema);

export default DrivingQuestion;
