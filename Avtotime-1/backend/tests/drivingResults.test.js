import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import DrivingTestResult from "../models/drivingTestResult.model.js";
import { getFallbackDrivingQuestions } from "../services/drivingQuestionFallback.js";

const app = createApp();

const signUp = async () => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Driver",
    userName: "driver",
    email: "driver@example.com",
    password: "correct-horse-battery",
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

const submit = (token, body) =>
  request(app).post("/api/driving-courses/result").set("Authorization", `Bearer ${token}`).send(body);

// Реальный билет из фолбэка — того самого источника, на котором живёт прод.
const ticketOne = getFallbackDrivingQuestions()
  .filter((q) => q.ticketNumber === 1)
  .sort((a, b) => a.questionNumber - b.questionNumber)
  .slice(0, 20);

const answersFor = (mapAnswer) =>
  ticketOne.map((q) => ({
    questionId: q._id,
    ticketNumber: q.ticketNumber,
    questionNumber: q.questionNumber,
    selectedAnswer: mapAnswer(q),
    // Заведомая ложь клиента — сервер обязан её игнорировать.
    isCorrect: true,
    correctAnswer: 999,
  }));

let user;

beforeEach(async () => {
  user = await signUp();
});

describe("результат экзамена считает сервер, а не клиент", () => {
  it("не верит isCorrect: все ответы неверные — 0% и провал", async () => {
    // Каждый ответ мимо (сдвиг от правильного), но клиент клянётся, что всё верно.
    const response = await submit(user.token, {
      mode: "exam",
      ticketNumbers: [1],
      questions: answersFor((q) => (q.correctAnswerNumber % q.answers.length) + 1),
      timeSpentSeconds: 60,
    });

    expect(response.status).toBe(201);
    expect(response.body.result.correctAnswers).toBe(0);
    expect(response.body.result.percentage).toBe(0);
    expect(response.body.result.passed).toBe(false);

    const stored = await DrivingTestResult.findOne().lean();
    expect(stored.correctAnswers).toBe(0);
    expect(stored.answers.every((a) => a.isCorrect === false)).toBe(true);
  });

  it("честные правильные ответы дают 100% и сдачу", async () => {
    const response = await submit(user.token, {
      mode: "exam",
      ticketNumbers: [1],
      questions: answersFor((q) => q.correctAnswerNumber),
      timeSpentSeconds: 60,
    });

    expect(response.status).toBe(201);
    expect(response.body.result.percentage).toBe(100);
    expect(response.body.result.passed).toBe(true);
  });

  it("выдуманный вопрос засчитывается как неверный, а не как правильный", async () => {
    const questions = answersFor((q) => q.correctAnswerNumber);
    // Один вопрос подменён на несуществующий, с клятвой isCorrect.
    questions[0] = {
      questionId: "фейковый-id",
      ticketNumber: 1,
      questionNumber: 999,
      selectedAnswer: 1,
      isCorrect: true,
    };

    const response = await submit(user.token, {
      mode: "practice",
      questions,
      timeSpentSeconds: 60,
    });

    expect(response.status).toBe(201);
    expect(response.body.result.correctAnswers).toBe(19);
  });

  it("экзамен из подборки знакомых вопросов не принимается", async () => {
    // 20 копий одного вопроса, ответ известен — раньше это дало бы 100%.
    const one = ticketOne[0];
    const response = await submit(user.token, {
      mode: "exam",
      ticketNumbers: [1],
      questions: Array.from({ length: 20 }, () => ({
        questionId: one._id,
        ticketNumber: one.ticketNumber,
        questionNumber: one.questionNumber,
        selectedAnswer: one.correctAnswerNumber,
      })),
      timeSpentSeconds: 60,
    });

    expect(response.status).toBe(400);
    expect(await DrivingTestResult.countDocuments()).toBe(0);
  });

  it("экзамен не из 20 вопросов не принимается", async () => {
    const response = await submit(user.token, {
      mode: "exam",
      ticketNumbers: [1],
      questions: answersFor((q) => q.correctAnswerNumber).slice(0, 5),
      timeSpentSeconds: 60,
    });

    expect(response.status).toBe(400);
  });
});
