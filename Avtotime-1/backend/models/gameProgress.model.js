import mongoose from 'mongoose';

const gameProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    gameId: {
      type: String,
      required: true,
      index: true
    },
    gameName: String,
    score: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    bestScore: {
      type: Number,
      default: 0
    },
    timesPlayed: {
      type: Number,
      default: 0
    },
    totalPlayTime: {
      type: Number,
      default: 0
    },
    achievements: [String],
    lastPlayedAt: Date,
    gameData: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

// Индекс для рейтинга
gameProgressSchema.index({ gameId: 1, bestScore: -1 });
gameProgressSchema.index({ userId: 1, gameId: 1 }, { unique: true });

const GameProgress = mongoose.model('GameProgress', gameProgressSchema);

export default GameProgress;
