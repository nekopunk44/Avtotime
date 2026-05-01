import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");

let fallbackQuestionsCache = null;

const extractArrayLiteral = (source, variableName) => {
  const marker = `const ${variableName} = [`;
  const start = source.indexOf(marker);
  if (start === -1) return [];

  const arrayStart = source.indexOf("[", start);
  const functionStart = source.indexOf("\nasync function", arrayStart);
  const arrayEnd = source.lastIndexOf("];", functionStart === -1 ? source.length : functionStart);
  if (arrayStart === -1 || arrayEnd === -1) return [];

  const arrayLiteral = source.slice(arrayStart, arrayEnd + 1);
  return Function(`"use strict"; return (${arrayLiteral});`)();
};

const normalizeQuestion = (question) => ({
  ...question,
  ticketNumber: Number(question.ticketNumber),
  questionNumber: Number(question.questionNumber),
  correctAnswerNumber: Number(question.correctAnswerNumber),
  isActive: question.isActive !== false,
  _id:
    question._id ||
    `fallback-${Number(question.ticketNumber)}-${Number(question.questionNumber)}`,
});

const loadScriptQuestions = (relativePath, variableName) => {
  const source = fs.readFileSync(path.join(backendDir, relativePath), "utf8");
  return extractArrayLiteral(source, variableName).map(normalizeQuestion);
};

const loadJsonQuestions = (relativePath) => {
  const source = fs.readFileSync(path.join(backendDir, relativePath), "utf8");
  return JSON.parse(source).map(normalizeQuestion);
};

export const getFallbackDrivingQuestions = () => {
  if (fallbackQuestionsCache) return fallbackQuestionsCache;

  const merged = [
    ...loadScriptQuestions("scripts/upload_driving_questions.js", "questionsData"),
    ...loadScriptQuestions("scripts/upload_all_tickets.js", "ticketsData"),
    ...loadJsonQuestions("questions_11-20.json"),
  ];

  const deduped = new Map();
  for (const question of merged) {
    deduped.set(`${question.ticketNumber}-${question.questionNumber}`, question);
  }

  fallbackQuestionsCache = Array.from(deduped.values()).sort(
    (a, b) => a.ticketNumber - b.ticketNumber || a.questionNumber - b.questionNumber,
  );

  return fallbackQuestionsCache;
};

export const findFallbackDrivingQuestions = ({
  ticketNumber = null,
  limit = null,
  category = "",
  activeOnly = false,
} = {}) => {
  let questions = getFallbackDrivingQuestions();

  if (ticketNumber) {
    questions = questions.filter((question) => question.ticketNumber === Number(ticketNumber));
  }

  if (activeOnly) {
    questions = questions.filter((question) => question.isActive !== false);
  }

  if (category) {
    const categoryRegex = new RegExp(String(category).trim(), "i");
    questions = questions.filter((question) => categoryRegex.test(String(question.category || "")));
  }

  if (limit) {
    questions = questions.slice(0, Number(limit));
  }

  return questions;
};
