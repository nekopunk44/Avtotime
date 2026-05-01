import DrivingQuestion from "../models/drivingQuestion.model.js";
import DrivingTestResult from "../models/drivingTestResult.model.js";
import { findFallbackDrivingQuestions, getFallbackDrivingQuestions } from "../services/drivingQuestionFallback.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");

const getRequestOrigin = (req) => {
  const host = req.get("host");
  if (!host) return "";
  return `${req.protocol}://${host}`;
};

const getLocalQuestionImageUrl = (req, question) => {
  const ticketNumber = Number(question?.ticketNumber);
  const questionNumber = Number(question?.questionNumber);

  if (!Number.isFinite(ticketNumber) || !Number.isFinite(questionNumber)) return null;

  const origin = getRequestOrigin(req);
  if (!origin) return null;

  const ticketDir = `driving-courses/tickets/ticket${ticketNumber}`;
  const baseFiles = [`question${questionNumber}`, `${questionNumber}`];
  const exts = ["png", "jpg", "jpeg", "webp"];

  for (const baseFile of baseFiles) {
    for (const ext of exts) {
      const rel = `${ticketDir}/${baseFile}.${ext}`;
      const abs = path.join(publicDir, rel);
      if (fs.existsSync(abs)) {
        return `${origin}/api/public/${rel}`;
      }
    }
  }

  return null;
};

// Cloudinary CDN fallback: images were uploaded as
// driving-questions/ticket{N}_q{M}.webp
const getCloudinaryQuestionImageUrl = (question) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;
  const ticketNumber = Number(question?.ticketNumber);
  const questionNumber = Number(question?.questionNumber);
  if (!Number.isFinite(ticketNumber) || !Number.isFinite(questionNumber)) return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/driving-questions/ticket${ticketNumber}_q${questionNumber}.webp`;
};

const attachLocalImages = (req, questions) =>
  questions.map((q) => {
    if (q?.imageUrl) return q;
    const localUrl = getLocalQuestionImageUrl(req, q);
    if (localUrl) return { ...q, imageUrl: localUrl };
    const cloudUrl = getCloudinaryQuestionImageUrl(q);
    if (cloudUrl) return { ...q, imageUrl: cloudUrl };
    return q;
  });

// Получить полные данные вопросов (с ответами и объяснениями для просмотра результатов)
export const getDrivingQuestionsWithAnswers = async (req, res) => {
  try {
    const ticketNumber = req.query.ticketNumber ? Number(req.query.ticketNumber) : null;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    let query = {};

    // Если указан номер билета, возьмём вопросы из конкретного билета
    if (ticketNumber && ticketNumber >= 1 && ticketNumber <= 40) {
      query.ticketNumber = ticketNumber;
    }

    let questions = await DrivingQuestion.find(query)
      .limit(limit)
      .lean();

    if (!questions || questions.length === 0) {
      questions = findFallbackDrivingQuestions({ ticketNumber, limit });
    }

    if (!questions || questions.length === 0) {
      return res.status(404).json({ message: `Вопросы не найдены${ticketNumber ? ` для билета ${ticketNumber}` : ''}` });
    }

    const questionsWithImages = attachLocalImages(req, questions);

    return res.status(200).json(questionsWithImages);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить вопросы по номеру билета (без аутентификации)
export const getDrivingQuestions = async (req, res) => {
  try {
    const ticketNumber = req.query.ticketNumber ? Number(req.query.ticketNumber) : null;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    let query = {};

    // Если указан номер билета, возьмём вопросы из конкретного билета
    if (ticketNumber && ticketNumber >= 1 && ticketNumber <= 40) {
      query.ticketNumber = ticketNumber;
    }

    let questions = await DrivingQuestion.find(query)
      .select("-correctAnswerNumber -explanation")
      .limit(limit)
      .lean();

    if (!questions || questions.length === 0) {
      questions = findFallbackDrivingQuestions({ ticketNumber, limit }).map(
        ({ correctAnswerNumber, explanation, ...question }) => question,
      );
    }

    if (!questions || questions.length === 0) {
      return res.status(404).json({ message: `Вопросы не найдены${ticketNumber ? ` для билета ${ticketNumber}` : ''}` });
    }

    const questionsWithImages = attachLocalImages(req, questions);

    return res.status(200).json(questionsWithImages);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить вопросы для режима Экзамена (20 вопросов за 20 минут)
export const getExamQuestions = async (req, res) => {
  try {
    const ticketNumber = Number(req.query.ticket) || null;

    let query = { isActive: true };

    // Если указан номер билета, возьмём вопросы из конкретного билета
    if (ticketNumber && ticketNumber >= 1 && ticketNumber <= 40) {
      query.ticketNumber = ticketNumber;
    }

    let questions = await DrivingQuestion.find(query)
      .select("-correctAnswerNumber -explanation")
      .lean();

    if (!questions || questions.length === 0) {
      questions = findFallbackDrivingQuestions({ ticketNumber, activeOnly: true }).map(
        ({ correctAnswerNumber, explanation, ...question }) => question,
      );
    }

    // Если нужны вопросы из конкретного билета и их 20
    if (questions.length === 20) {
      return res.status(200).json({
        mode: "exam",
        duration: 20,
        totalQuestions: 20,
        passingScore: 14,
        questions,
      });
    }

    // Иначе возьмём 20 случайных вопросов из всех
    const randomQuestions = questions
      .sort(() => Math.random() - 0.5)
      .slice(0, 20);

    return res.status(200).json({
      mode: "exam",
      duration: 20,
      totalQuestions: 20,
      passingScore: 14,
      questions: randomQuestions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить вопросы для режима Тренировки (все вопросы)
export const getPracticeQuestions = async (req, res) => {
  try {
    const ticketNumber = Number(req.query.ticket) || null;
    const category = String(req.query.category || "").trim().toLowerCase();

    let query = { isActive: true };

    if (ticketNumber && ticketNumber >= 1 && ticketNumber <= 40) {
      query.ticketNumber = ticketNumber;
    }

    if (category && category !== "all") {
      query.category = new RegExp(category, "i");
    }

    let questions = await DrivingQuestion.find(query)
      .select("-correctAnswerNumber -explanation")
      .sort({ ticketNumber: 1, questionNumber: 1 })
      .lean();

    if (!questions || questions.length === 0) {
      questions = findFallbackDrivingQuestions({
        ticketNumber,
        category,
        activeOnly: true,
      }).map(({ correctAnswerNumber, explanation, ...question }) => question);
    }

    return res.status(200).json({
      mode: "practice",
      duration: 0,
      totalQuestions: questions.length,
      questions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить вопросы для режима Марафона (800 вопросов - все вопросы, повторяющиеся)
export const getMarathonQuestions = async (req, res) => {
  try {
    let questions = await DrivingQuestion.find({ isActive: true })
      .select("-correctAnswerNumber -explanation")
      .lean();

    if (!questions || questions.length === 0) {
      questions = getFallbackDrivingQuestions()
        .filter((question) => question.isActive !== false)
        .map(({ correctAnswerNumber, explanation, ...question }) => question);
    }

    // Если вопросов меньше 800, повторим их
    const totalNeeded = 800;
    const originalCount = questions.length;

    if (originalCount < totalNeeded) {
      const repeatTimes = Math.ceil(totalNeeded / originalCount);
      const extended = [];

      for (let i = 0; i < repeatTimes; i++) {
        extended.push(...questions);
      }

      questions = extended.slice(0, totalNeeded);
    } else {
      questions = questions.slice(0, totalNeeded);
    }

    // Перемешаем для марафона
    questions = questions.sort(() => Math.random() - 0.5);

    return res.status(200).json({
      mode: "marathon",
      duration: 0,
      totalQuestions: 800,
      questions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить один вопрос с объяснением
export const getQuestionWithExplanation = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await DrivingQuestion.findById(id);

    if (!question) {
      return res.status(404).json({ message: "Вопрос не найден" });
    }

    return res.status(200).json(question);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить все билеты и их статус для пользователя
export const getTicketsList = async (req, res) => {
  try {
    const tickets = [];

    for (let i = 1; i <= 40; i++) {
      let count = await DrivingQuestion.countDocuments({ ticketNumber: i });
      if (count === 0) {
        count = findFallbackDrivingQuestions({ ticketNumber: i }).length;
      }
      tickets.push({
        number: i,
        totalQuestions: count,
      });
    }

    return res.status(200).json(tickets);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Сохранить результат теста
export const saveTestResult = async (req, res) => {
  try {
    const {
      mode,
      ticketNumbers,
      questions,
      timeSpentSeconds,
    } = req.body;

    if (!mode || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ message: "Требуемые поля отсутствуют" });
    }

    const totalQuestions = questions.length;
    const correctAnswers = questions.filter((q) => q.isCorrect).length;
    const wrongAnswers = totalQuestions - correctAnswers;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);

    // Минимальный проходной балл для режима экзамена - 70%
    let passed = false;
    if (mode === "exam") {
      passed = percentage >= 70;
    } else {
      passed = true; // В режимах тренировки и марафона результат всегда "пройден"
    }

    const result = await DrivingTestResult.create({
      user: req.userId,
      mode,
      ticketNumbers: ticketNumbers || [],
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      percentage,
      passed,
      timeSpentSeconds,
      answers: questions.map((q) => ({
        questionId: q.questionId,
        ticketNumber: q.ticketNumber,
        questionNumber: q.questionNumber,
        selectedAnswer: q.selectedAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: q.isCorrect,
      })),
      status: "completed",
    });

    return res.status(201).json({
      success: true,
      result: {
        mode,
        totalQuestions,
        correctAnswers,
        wrongAnswers,
        percentage,
        passed,
        timeSpentSeconds,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить результаты тестов пользователя
export const getUserTestResults = async (req, res) => {
  try {
    const { mode, limit } = req.query;
    const limitNum = Number(limit) || 10;

    let query = { user: req.userId };

    if (mode) {
      query.mode = String(mode).toLowerCase();
    }

    const results = await DrivingTestResult.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    return res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить статистику пользователя
export const getUserStatistics = async (req, res) => {
  try {
    const allResults = await DrivingTestResult.find({ user: req.userId }).lean();

    const stats = {
      totalTests: allResults.length,
      totalQuestionsPassed: 0,
      totalQuestionsCorrect: 0,
      averagePercentage: 0,
      passedExams: 0,
      examStats: {
        total: 0,
        passed: 0,
      },
      practiceStats: {
        total: 0,
        questions: 0,
      },
      marathonStats: {
        total: 0,
        questions: 0,
      },
    };

    allResults.forEach((result) => {
      stats.totalQuestionsPassed += result.totalQuestions;
      stats.totalQuestionsCorrect += result.correctAnswers;

      if (result.mode === "exam") {
        stats.examStats.total += 1;
        if (result.passed) stats.examStats.passed += 1;
      } else if (result.mode === "practice") {
        stats.practiceStats.total += 1;
        stats.practiceStats.questions += result.totalQuestions;
      } else if (result.mode === "marathon") {
        stats.marathonStats.total += 1;
        stats.marathonStats.questions += result.totalQuestions;
      }
    });

    if (stats.totalQuestionsPassed > 0) {
      stats.averagePercentage = Math.round(
        (stats.totalQuestionsCorrect / stats.totalQuestionsPassed) * 100
      );
    }

    return res.status(200).json(stats);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Получить вопрос билета (с номером билета и вопроса)
export const getTicketQuestion = async (req, res) => {
  try {
    const { ticketNumber, questionNumber } = req.params;

    const question = await DrivingQuestion.findOne({
      ticketNumber: Number(ticketNumber),
      questionNumber: Number(questionNumber),
    });

    if (!question) {
      return res.status(404).json({ message: "Вопрос не найден" });
    }

    return res.status(200).json(question);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Добавить вопросы в БД (для администратора)
export const createDrivingQuestion = async (req, res) => {
  try {
    const {
      ticketNumber,
      questionNumber,
      questionText,
      answers,
      correctAnswerNumber,
      explanation,
      imageUrl,
      category,
      difficulty,
      tags,
    } = req.body;

    if (
      !ticketNumber ||
      !questionNumber ||
      !questionText ||
      !answers ||
      !correctAnswerNumber
    ) {
      return res
        .status(400)
        .json({ message: "Требуемые поля отсутствуют" });
    }

    // Проверка уникальности
    const existing = await DrivingQuestion.findOne({
      ticketNumber,
      questionNumber,
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: "Этот вопрос уже существует" });
    }

    const question = await DrivingQuestion.create({
      ticketNumber,
      questionNumber,
      questionText,
      answers,
      correctAnswerNumber,
      explanation,
      imageUrl,
      category: category || "ПДД",
      difficulty: difficulty || "medium",
      tags: tags || [],
    });

    return res.status(201).json(question);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
