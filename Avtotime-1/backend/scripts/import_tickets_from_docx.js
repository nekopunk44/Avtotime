import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import mongoose from "mongoose";
import DrivingQuestion from "../models/drivingQuestion.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendDir, "..", "..");

dotenv.config({ path: path.join(backendDir, ".env") });

const sourceDir =
  process.env.TICKETS_DOCX_DIR ||
  path.join(process.env.USERPROFILE || "C:\\Users\\Admin", "Downloads", "Telegram Desktop");

const filePrefixes = ["1-5", "6-10", "11-20", "21-30", "31-40"];
const outputJsonPath = path.join(backendDir, "driving_questions_1-40.json");
const publicTicketsDir = path.join(backendDir, "public", "driving-courses", "tickets");

const ticketRe = /^(\d+)\s+билет:?$/i;
const questionRe = /^(\d+)\s+вопрос:?$/i;
const variantsRe = /^Варианты ответ(?:а|ов):?$/i;
const numberedAnswerRe = /^(\d+)[.)]\s+(.+)$/;
const correctMarkerRe = /\((?:правильный\s+ответ|верный\s+ответ)\)/i;

function decodeXmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getText(node) {
  const textNodes = node.getElementsByTagName("w:t");
  let text = "";
  for (let i = 0; i < textNodes.length; i += 1) {
    text += textNodes[i].textContent;
  }
  return text.replace(/\s+/g, " ").trim();
}

function getImageRelIds(node) {
  const blips = node.getElementsByTagName("a:blip");
  const relIds = [];
  for (let i = 0; i < blips.length; i += 1) {
    const relId = blips[i].getAttribute("r:embed") || blips[i].getAttribute("r:link");
    if (relId) relIds.push(relId);
  }
  return relIds;
}

function splitPackedHeadings(text) {
  if (!text) return [text];

  const parts = [];
  let rest = text.trim();

  while (rest) {
    const leadingQuestion = rest.match(/^(\d+\s+вопрос):?\s*(.+)$/i);
    const leadingTicket = rest.match(/^(\d+\s+билет):?\s*(.+)$/i);
    if (leadingQuestion) {
      parts.push(leadingQuestion[1].trim());
      rest = leadingQuestion[2].trim();
      continue;
    }
    if (leadingTicket) {
      parts.push(leadingTicket[1].trim());
      rest = leadingTicket[2].trim();
      continue;
    }

    const tailQuestion = rest.match(/^(.*?)(\d+\s+вопрос):?$/i);
    const tailTicket = rest.match(/^(.*?)(\d+\s+билет):?$/i);
    const match = tailQuestion || tailTicket;

    if (!match || !match[1].trim()) {
      parts.push(rest);
      break;
    }

    parts.push(match[1].trim());
    parts.push(match[2].trim());
    break;
  }

  return parts.filter((part) => part !== "");
}

function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(correctMarkerRe, "")
    .replace(/[«»"'.:,;!?()[\]{}—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlap(a, b) {
  const words = normalizeForMatch(a)
    .split(/\s+/)
    .filter((word) => word.length > 3);
  if (!words.length) return 0;

  const haystack = normalizeForMatch(b);
  let hits = 0;
  for (const word of new Set(words)) {
    if (haystack.includes(word)) hits += 1;
  }
  return hits / new Set(words).size;
}

function cleanAnswerText(answer) {
  const numbered = answer.match(numberedAnswerRe);
  const text = numbered ? numbered[2] : answer;
  return text.replace(correctMarkerRe, "").replace(/\s+/g, " ").trim();
}

function parseCorrectAnswer(rawAnswers, cleanedAnswers, explanation) {
  for (let i = 0; i < rawAnswers.length; i += 1) {
    if (correctMarkerRe.test(rawAnswers[i])) {
      return { number: i + 1, certain: true, source: "answer marker" };
    }
  }

  const text = explanation.replace(/\s+/g, " ").trim();
  const numberedPatterns = [
    /правильный\s+ответ\s*[:—–-]?\s*(\d+)/i,
    /верный\s+ответ\s*[:—–-]?\s*(\d+)/i,
    /правильн(?:ый|ого)\s+вариант\s*[—–-]?\s*(\d+)/i,
    /ответ\s*[:—–-]?\s*(\d+)/i,
    /вариант\s+(\d+)\s*[—–-]\s*правиль/i,
    /[—–-]\s*\((\d+)\)/i,
    /\((\d+)\)\s*$/i,
  ];

  for (const pattern of numberedPatterns) {
    const match = text.match(pattern);
    if (match) {
      const number = Number(match[1]);
      if (Number.isInteger(number) && number >= 1 && number <= cleanedAnswers.length) {
        return { number, certain: true, source: "explicit number" };
      }
    }
  }

  const textMatch = text.match(/правильный\s+ответ\s*[:—–-]?\s*(.+?)(?:[.。]|$)/i);
  if (textMatch) {
    const hint = normalizeForMatch(textMatch[1]);
    if (hint) {
      for (let i = 0; i < cleanedAnswers.length; i += 1) {
        const answer = normalizeForMatch(cleanedAnswers[i]);
        if (answer && (hint.includes(answer) || answer.includes(hint))) {
          return { number: i + 1, certain: true, source: "explicit text" };
        }
      }
    }
  }

  const scores = cleanedAnswers.map((answer) => wordOverlap(answer, text));
  const maxScore = Math.max(...scores);
  const bestIndex = scores.indexOf(maxScore);
  if (maxScore >= 0.3) {
    return { number: bestIndex + 1, certain: false, source: "word overlap" };
  }

  return { number: 1, certain: false, source: "fallback" };
}

function inferCategory(questionText, explanation) {
  const haystack = normalizeForMatch(`${questionText} ${explanation}`);
  if (
    haystack.includes("пострадав") ||
    haystack.includes("реанимац") ||
    haystack.includes("кровотеч") ||
    haystack.includes("травм")
  ) {
    return "Первая помощь";
  }
  return "ПДД";
}

function makeQuestion(raw) {
  const questionText = raw.questionLines.join(" ").replace(/\s+/g, " ").trim();
  const rawAnswers = raw.answerLines.map((answer) => answer.replace(/\s+/g, " ").trim()).filter(Boolean);
  const cleanedAnswers = rawAnswers.map(cleanAnswerText).filter(Boolean);
  const explanation = raw.explanationLines.join(" ").replace(/\s+/g, " ").trim();

  const { number, certain, source } = parseCorrectAnswer(rawAnswers, cleanedAnswers, explanation);

  return {
    ticketNumber: raw.ticketNumber,
    questionNumber: raw.questionNumber,
    questionText,
    answers: cleanedAnswers.map((text, index) => ({ number: index + 1, text })),
    correctAnswerNumber: number,
    explanation,
    category: inferCategory(questionText, explanation),
    difficulty: "medium",
    tags: [],
    isActive: true,
    imageRelIds: raw.imageRelIds,
    _certain: certain,
    _correctSource: source,
  };
}

function shouldStartExplanation(text, answerLines, sawAnswerBlank) {
  if (/^(?:Правильн(?:ый|ого)?\s+(?:ответ|вариант)|Верный\s+ответ|Ответ)\s*[:—–-]?/i.test(text)) {
    return true;
  }
  if (sawAnswerBlank && answerLines.length >= 2) return true;
  if (answerLines.some((answer) => numberedAnswerRe.test(answer)) && answerLines.length >= 2 && !numberedAnswerRe.test(text)) {
    return true;
  }
  return false;
}

async function parseDocx(filePath, { minTicket, maxTicket }) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const documentXml = await zip.file("word/document.xml").async("string");
  const relsXml = await zip.file("word/_rels/document.xml.rels").async("string");
  const document = new DOMParser().parseFromString(documentXml, "text/xml");
  const relationships = new Map();

  for (const match of relsXml.matchAll(/<Relationship\b([^>]+)>/g)) {
    const attrs = match[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) {
      relationships.set(id, decodeXmlEntities(target));
    }
  }

  const paragraphs = Array.from(document.getElementsByTagName("w:p"));
  const questions = [];
  let currentTicket = null;
  let current = null;
  let mode = "idle";
  let sawQuestionBlank = false;
  let sawAnswerBlank = false;

  const finalize = () => {
    if (!current) return;
    const question = makeQuestion(current);
    if (question.questionText && question.answers.length >= 2) {
      questions.push(question);
    }
    current = null;
    mode = "idle";
    sawQuestionBlank = false;
    sawAnswerBlank = false;
  };

  const startQuestion = (questionNumber) => {
    finalize();
    current = {
      ticketNumber: currentTicket,
      questionNumber,
      questionLines: [],
      answerLines: [],
      explanationLines: [],
      imageRelIds: [],
    };
    mode = "question";
    sawQuestionBlank = false;
    sawAnswerBlank = false;
  };

  const handleText = (text) => {
    const ticketMatch = text.match(ticketRe);
    if (ticketMatch) {
      const ticketNumber = Number(ticketMatch[1]);
      const isExpectedFirstTicket = currentTicket === null && ticketNumber === minTicket;
      const isExpectedNextTicket = currentTicket !== null && ticketNumber === currentTicket + 1;
      const isValidTicketHeading =
        ticketNumber >= minTicket &&
        ticketNumber <= maxTicket &&
        (isExpectedFirstTicket || isExpectedNextTicket);

      if (!isValidTicketHeading && currentTicket !== null && ticketNumber >= 1 && ticketNumber <= 20) {
        startQuestion(ticketNumber);
        return;
      }

      finalize();
      currentTicket = ticketNumber;
      return;
    }

    const questionMatch = text.match(questionRe);
    if (questionMatch) {
      const questionNumber = Number(questionMatch[1]);
      const currentIsEmpty =
        current &&
        mode === "question" &&
        current.questionLines.length === 0 &&
        current.answerLines.length === 0 &&
        current.explanationLines.length === 0;

      if (currentIsEmpty && questionNumber !== current.questionNumber + 1) {
        return;
      }

      startQuestion(questionNumber);
      return;
    }

    if (!current) return;

    if (variantsRe.test(text)) {
      mode = "answers";
      sawQuestionBlank = false;
      sawAnswerBlank = false;
      return;
    }

    if (mode === "question" && sawQuestionBlank && current.questionLines.length > 0) {
      mode = "answers";
      current.answerLines.push(text);
      sawQuestionBlank = false;
      sawAnswerBlank = false;
      return;
    }

    if (mode === "question" && numberedAnswerRe.test(text)) {
      mode = "answers";
      current.answerLines.push(text);
      sawQuestionBlank = false;
      sawAnswerBlank = false;
      return;
    }

    if (mode === "question" && current.questionLines.length > 0) {
      mode = "answers";
      current.answerLines.push(text);
      sawQuestionBlank = false;
      sawAnswerBlank = false;
      return;
    }

    if (mode === "question") {
      current.questionLines.push(text);
      sawQuestionBlank = false;
      return;
    }

    if (mode === "answers" && shouldStartExplanation(text, current.answerLines, sawAnswerBlank)) {
      mode = "explanation";
    }

    if (mode === "answers") {
      current.answerLines.push(text);
      sawAnswerBlank = false;
      return;
    }

    if (mode === "explanation") {
      current.explanationLines.push(text);
    }
  };

  for (const paragraph of paragraphs) {
    const imageRelIds = getImageRelIds(paragraph);
    if (current && imageRelIds.length) {
      current.imageRelIds.push(...imageRelIds);
    }

    const text = getText(paragraph);
    if (!text) {
      if (mode === "question" && current?.questionLines.length) {
        sawQuestionBlank = true;
      }
      if (mode === "answers" && current?.answerLines.length >= 2) {
        sawAnswerBlank = true;
      }
      continue;
    }

    for (const part of splitPackedHeadings(text)) {
      handleText(part);
    }
  }

  finalize();

  const mediaByRelId = new Map();
  for (const [relId, target] of relationships) {
    if (target.startsWith("media/")) {
      mediaByRelId.set(relId, `word/${target}`);
    }
  }

  return { zip, questions, mediaByRelId };
}

function parseTicketRange(prefix) {
  const [minTicket, maxTicket] = prefix.split("-").map(Number);
  return { minTicket, maxTicket };
}

function getDocxFiles() {
  const names = fs.readdirSync(sourceDir);
  return filePrefixes.map((prefix) => {
    const name = names.find((candidate) => candidate.startsWith(prefix) && candidate.endsWith(".docx"));
    if (!name) {
      throw new Error(`Не найден файл ${prefix}*.docx в ${sourceDir}`);
    }
    return {
      file: path.join(sourceDir, name),
      ...parseTicketRange(prefix),
    };
  });
}

async function writeQuestionImages(parsedDocs, questions) {
  fs.mkdirSync(publicTicketsDir, { recursive: true });

  let written = 0;
  const docByQuestion = new Map();
  for (const parsed of parsedDocs) {
    for (const question of parsed.questions) {
      docByQuestion.set(`${question.ticketNumber}-${question.questionNumber}`, parsed);
    }
  }

  for (const question of questions) {
    const firstRelId = question.imageRelIds[0];
    if (!firstRelId) continue;

    const parsed = docByQuestion.get(`${question.ticketNumber}-${question.questionNumber}`);
    const mediaPath = parsed?.mediaByRelId.get(firstRelId);
    const mediaFile = mediaPath ? parsed.zip.file(mediaPath) : null;
    if (!mediaFile) continue;

    const ext = path.extname(mediaPath).toLowerCase() || ".png";
    const ticketDir = path.join(publicTicketsDir, `ticket${question.ticketNumber}`);
    fs.mkdirSync(ticketDir, { recursive: true });
    const outPath = path.join(ticketDir, `question${question.questionNumber}${ext}`);
    fs.writeFileSync(outPath, await mediaFile.async("nodebuffer"));
    written += 1;
  }

  return written;
}

function stripImportOnlyFields(question) {
  const { imageRelIds, _certain, _correctSource, ...clean } = question;
  return clean;
}

async function importQuestions(questions) {
  const mongoUrl =
    (process.env.MONGODB_URL && process.env.MONGODB_URL.trim()) ||
    "mongodb://127.0.0.1:27017/avtotime";

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });

  const ticketNumbers = [...new Set(questions.map((question) => question.ticketNumber))].sort((a, b) => a - b);
  await DrivingQuestion.deleteMany({ ticketNumber: { $in: ticketNumbers } });
  const result = await DrivingQuestion.insertMany(questions.map(stripImportOnlyFields), { ordered: true });

  const stats = await DrivingQuestion.aggregate([
    { $match: { ticketNumber: { $in: ticketNumbers } } },
    { $group: { _id: "$ticketNumber", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  await mongoose.disconnect();

  return { inserted: result.length, stats };
}

function validateQuestions(questions) {
  const errors = [];
  const seen = new Set();

  for (const question of questions) {
    const key = `${question.ticketNumber}-${question.questionNumber}`;
    if (seen.has(key)) errors.push(`Дубликат ${key}`);
    seen.add(key);

    if (!Number.isInteger(question.ticketNumber) || question.ticketNumber < 1 || question.ticketNumber > 40) {
      errors.push(`Некорректный номер билета: ${key}`);
    }
    if (!Number.isInteger(question.questionNumber) || question.questionNumber < 1 || question.questionNumber > 20) {
      errors.push(`Некорректный номер вопроса: ${key}`);
    }
    if (!question.questionText) errors.push(`Пустой текст вопроса: ${key}`);
    if (question.answers.length < 2) errors.push(`Мало ответов: ${key}`);
    if (question.correctAnswerNumber < 1 || question.correctAnswerNumber > question.answers.length) {
      errors.push(`Некорректный правильный ответ: ${key}`);
    }
  }

  for (let ticket = 1; ticket <= 40; ticket += 1) {
    const count = questions.filter((question) => question.ticketNumber === ticket).length;
    if (count !== 20) errors.push(`Билет ${ticket}: ${count} вопросов вместо 20`);
  }

  return errors;
}

async function main() {
  const files = getDocxFiles();
  const parsedDocs = [];
  const allQuestions = [];

  for (const { file, minTicket, maxTicket } of files) {
    const parsed = await parseDocx(file, { minTicket, maxTicket });
    parsedDocs.push(parsed);
    allQuestions.push(...parsed.questions);
    console.log(`${path.basename(file)}: ${parsed.questions.length} вопросов`);
  }

  allQuestions.sort(
    (a, b) => a.ticketNumber - b.ticketNumber || a.questionNumber - b.questionNumber,
  );

  const errors = validateQuestions(allQuestions);
  if (errors.length) {
    fs.writeFileSync(
      path.join(backendDir, "driving_questions_parse_debug.json"),
      JSON.stringify(allQuestions, null, 2),
      "utf8",
    );
    console.error("Импорт остановлен из-за ошибок разбора:");
    for (const error of errors.slice(0, 30)) console.error(`- ${error}`);
    if (errors.length > 30) console.error(`...и ещё ${errors.length - 30}`);
    process.exit(1);
  }

  const uncertain = allQuestions.filter((question) => !question._certain);
  const imagesWritten = await writeQuestionImages(parsedDocs, allQuestions);

  fs.writeFileSync(
    outputJsonPath,
    JSON.stringify(allQuestions.map(stripImportOnlyFields), null, 2),
    "utf8",
  );

  const { inserted, stats } = await importQuestions(allQuestions);

  console.log(`Готово: импортировано ${inserted} вопросов`);
  console.log(`Картинок сохранено: ${imagesWritten}`);
  console.log(`JSON сохранён: ${path.relative(repoRoot, outputJsonPath)}`);
  console.log(`Неявно определённых ответов: ${uncertain.length}`);
  if (uncertain.length) {
    for (const question of uncertain.slice(0, 20)) {
      console.log(
        `? Билет ${question.ticketNumber}, вопрос ${question.questionNumber}: ответ ${question.correctAnswerNumber} (${question._correctSource})`,
      );
    }
  }
  console.log("Статистика по билетам:");
  for (const stat of stats) {
    console.log(`- ${stat._id}: ${stat.count}`);
  }
}

main().catch(async (error) => {
  console.error(error?.stack || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
