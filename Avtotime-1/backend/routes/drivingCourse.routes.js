import express from "express";
import isAuth from "../middlewars/isAuth.js";
import {
  getDrivingQuestions,
  getDrivingQuestionsWithAnswers,
  createDrivingQuestion,
  getExamQuestions,
  getMarathonQuestions,
  getPracticeQuestions,
  getQuestionWithExplanation,
  getTicketsList,
  getTicketQuestion,
  getUserStatistics,
  getUserTestResults,
  saveTestResult,
} from "../controllers/drivingCourse.controllers.js";

const drivingCourseRouter = express.Router();

// Получить вопросы по номеру билета (без аутентификации)
drivingCourseRouter.get("/questions", getDrivingQuestions);

// Получить вопросы с полной информацией (для просмотра результатов)
drivingCourseRouter.get("/questions-with-answers", getDrivingQuestionsWithAnswers);

// Получить список билетов
drivingCourseRouter.get("/tickets", isAuth, getTicketsList);

// Режимы обучения
drivingCourseRouter.get("/exam", isAuth, getExamQuestions);
drivingCourseRouter.get("/practice", isAuth, getPracticeQuestions);
drivingCourseRouter.get("/marathon", isAuth, getMarathonQuestions);

// Получить вопрос с объяснением
drivingCourseRouter.get("/question/:id", isAuth, getQuestionWithExplanation);

// Получить конкретный вопрос билета
drivingCourseRouter.get("/ticket/:ticketNumber/:questionNumber", isAuth, getTicketQuestion);

// Сохранить результат
drivingCourseRouter.post("/result", isAuth, saveTestResult);

// Получить результаты пользователя
drivingCourseRouter.get("/results", isAuth, getUserTestResults);

// Получить статистику пользователя
drivingCourseRouter.get("/statistics", isAuth, getUserStatistics);

// Создать вопрос (для админа)
drivingCourseRouter.post("/questions/create", isAuth, createDrivingQuestion);

export default drivingCourseRouter;
