import express from 'express';
import GameProgress from '../models/gameProgress.model.js';
import isAuth from '../middlewars/isAuth.js';

const router = express.Router();

// Получить прогресс игрока в игре
router.get('/progress/:gameId', isAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;

    const progress = await GameProgress.findOne({ userId, gameId });

    res.json(progress || {
      gameId,
      score: 0,
      level: 1,
      progress: 0,
      bestScore: 0,
      timesPlayed: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при загрузке прогресса' });
  }
});

// Сохранить/обновить прогресс
router.post('/progress/:gameId', isAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;
    const { score, level, progress, achievements, gameData, gameName } = req.body;

    let gameProgress = await GameProgress.findOne({ userId, gameId });

    if (gameProgress) {
      gameProgress.score = score || gameProgress.score;
      gameProgress.level = level || gameProgress.level;
      gameProgress.progress = Math.max(progress || 0, gameProgress.progress);
      gameProgress.timesPlayed = (gameProgress.timesPlayed || 0) + 1;
      gameProgress.totalPlayTime = (gameProgress.totalPlayTime || 0) + (req.body.playTime || 0);
      gameProgress.lastPlayedAt = new Date();

      if (score && score > (gameProgress.bestScore || 0)) {
        gameProgress.bestScore = score;
      }

      if (achievements) {
        gameProgress.achievements = [...new Set([...(gameProgress.achievements || []), ...achievements])];
      }

      if (gameData) {
        gameProgress.gameData = gameData;
      }
    } else {
      gameProgress = new GameProgress({
        userId,
        gameId,
        gameName: gameName || gameId,
        score: score || 0,
        level: level || 1,
        progress: progress || 0,
        bestScore: score || 0,
        timesPlayed: 1,
        totalPlayTime: req.body.playTime || 0,
        achievements: achievements || [],
        gameData: gameData || {},
        lastPlayedAt: new Date()
      });
    }

    await gameProgress.save();
    res.json(gameProgress);
  } catch (error) {
    console.error('Error saving progress:', error);
    res.status(500).json({ error: 'Ошибка при сохранении прогресса' });
  }
});

// Получить рейтинг для игры
router.get('/leaderboard/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit)) || 10));

    const leaderboard = await GameProgress.find({ gameId })
      .sort({ bestScore: -1 })
      .limit(limit)
      .populate('userId', 'name avatar');

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при загрузке рейтинга' });
  }
});

// Получить статистику игрока по всем играм
router.get('/stats', isAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const stats = await GameProgress.find({ userId }).sort({ lastPlayedAt: -1 });

    const totalScore = stats.reduce((sum, game) => sum + (game.bestScore || 0), 0);
    const totalGames = stats.length;
    const totalPlayTime = stats.reduce((sum, game) => sum + (game.totalPlayTime || 0), 0);

    res.json({
      games: stats,
      totalScore,
      totalGames,
      totalPlayTime,
      averageScore: totalGames > 0 ? totalScore / totalGames : 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при загрузке статистики' });
  }
});

// Получить достижения
router.get('/achievements', isAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const allAchievements = await GameProgress.find({ userId }, 'achievements');
    const achievements = [...new Set(allAchievements.flatMap(g => g.achievements || []))];

    res.json({ achievements });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при загрузке достижений' });
  }
});

export default router;
