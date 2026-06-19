const fs = require('fs');

// --- Correct answer detection ---

function wordOverlap(a, b) {
  const wa = new Set(a.toLowerCase().replace(/[«».,;:!?()—–-]/g, '').split(/\s+/).filter(w => w.length > 3));
  let hits = 0;
  for (const w of wa) if (b.toLowerCase().includes(w)) hits++;
  return wa.size ? hits / wa.size : 0;
}

function inferCorrectFromExplanation(answers, explanation) {
  if (!explanation) return null;
  const scores = answers.map(a => wordOverlap(a, explanation));
  const maxScore = Math.max(...scores);
  if (maxScore < 0.2) return null;
  return scores.indexOf(maxScore) + 1;
}

function parseCorrectAnswer(answerLines, rawAnswerLines, explanationText) {
  // Strategy 1: "(Правильный ответ)" inside raw answer
  for (let i = 0; i < rawAnswerLines.length; i++) {
    if (/\(правильный ответ\)/i.test(rawAnswerLines[i])) return { num: i + 1, certain: true };
  }

  // Strategy 2: "Правильный ответ: N" explicit number
  let m = explanationText.match(/правильный ответ[:\s–-]+(\d+)/i);
  if (m) return { num: parseInt(m[1]), certain: true };

  // Strategy 3: "– (N)" at end
  m = explanationText.match(/[–-]\s*\((\d+)\)/);
  if (m) return { num: parseInt(m[1]), certain: true };

  // Strategy 4: "Вариант N — правильный"
  m = explanationText.match(/вариант\s+(\d+)\s*[—-]\s*правильн/i);
  if (m) return { num: parseInt(m[1]), certain: true };

  // Strategy 5: match explanation text hint to answer
  m = explanationText.match(/правильный ответ[:\s–-]+(.{10,})/i);
  if (m) {
    const hint = m[1].trim();
    for (let i = 0; i < answerLines.length; i++) {
      if (answerLines[i].length > 5 && hint.toLowerCase().startsWith(answerLines[i].toLowerCase().slice(0, 20))) {
        return { num: i + 1, certain: true };
      }
    }
  }

  // Strategy 6: word overlap with explanation
  const inferred = inferCorrectFromExplanation(answerLines, explanationText);
  if (inferred) return { num: inferred, certain: false };

  return { num: 1, certain: false };
}

// --- Format A: "1-5 билеты" style ---
// Answers without numbering, explicit correct answer markers
function parseFormatA(lines) {
  const questions = [];
  let currentTicket = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const ticketMatch = line.match(/^(\d+)\s+билет\s*$/i);
    if (ticketMatch) { currentTicket = parseInt(ticketMatch[1]); i++; continue; }

    const questionMatch = line.match(/^(\d+)\s+вопрос\s*$/i);
    if (questionMatch && currentTicket !== null) {
      const questionNumber = parseInt(questionMatch[1]);
      i++;

      // Question text
      const qtLines = [];
      while (i < lines.length && !/^варианты ответ/i.test(lines[i]) && !/^\d+\s+вопрос$/i.test(lines[i]) && !/^\d+\s+билет$/i.test(lines[i])) {
        if (lines[i]) qtLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && /^варианты ответ/i.test(lines[i])) i++;

      // Answers
      const rawAnswers = [];
      while (i < lines.length) {
        const l = lines[i];
        if (/^правильный ответ/i.test(l)) break;
        if (/^(ответ:|ваши|действие|итог)/i.test(l)) break;
        if (/^\d+\s+вопрос\s*$/i.test(l) || /^\d+\s+билет\s*$/i.test(l)) break;
        if (!l && rawAnswers.length >= 2) { i++; break; }
        if (l) rawAnswers.push(l);
        i++;
      }

      // Explanation
      const expLines = [];
      while (i < lines.length && !/^\d+\s+вопрос\s*$/i.test(lines[i]) && !/^\d+\s+билет\s*$/i.test(lines[i])) {
        expLines.push(lines[i]);
        i++;
      }

      const expText = expLines.join(' ').replace(/\s+/g, ' ').trim();
      const cleanAnswers = rawAnswers.map(a => a.replace(/\s*\(правильный ответ\)\s*/gi, '').trim()).filter(Boolean);
      const qt = qtLines.join(' ').replace(/\s+/g, ' ').trim();
      if (!qt || cleanAnswers.length < 2) continue;

      const { num, certain } = parseCorrectAnswer(cleanAnswers, rawAnswers, expText);
      questions.push({
        ticketNumber: currentTicket, questionNumber, questionText: qt,
        answers: cleanAnswers.map((text, idx) => ({ number: idx + 1, text })),
        correctAnswerNumber: num, _certain: certain,
        explanation: expText.replace(/^правильный ответ[^а-яёА-ЯЁ]*/i, '').trim(),
        category: 'ПДД', difficulty: 'medium', tags: [],
      });
      continue;
    }
    i++;
  }
  return questions;
}

// --- Format B: "6-10 / 11-20" style ---
// Answers as "1. text", "2. text" — no explicit correct marker
function parseFormatB(lines) {
  const questions = [];
  let currentTicket = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const ticketMatch = line.match(/^(\d+)\s+билет\s*$/i);
    if (ticketMatch) { currentTicket = parseInt(ticketMatch[1]); i++; continue; }

    const questionMatch = line.match(/^(\d+)\s+вопрос\s*$/i);
    if (questionMatch && currentTicket !== null) {
      const questionNumber = parseInt(questionMatch[1]);
      i++;

      // Question text (skip blanks, until first "N." answer line)
      const qtLines = [];
      while (i < lines.length && !/^\d+\.\s/.test(lines[i]) && !/^\d+\s+вопрос\s*$/i.test(lines[i]) && !/^\d+\s+билет\s*$/i.test(lines[i])) {
        if (lines[i]) qtLines.push(lines[i]);
        i++;
      }

      // Answers "1. text"
      const answers = [];
      while (i < lines.length) {
        const l = lines[i];
        const am = l.match(/^(\d+)\.\s+(.+)/);
        if (am) {
          answers.push({ number: parseInt(am[1]), text: am[2].trim() });
          i++;
        } else {
          break;
        }
      }

      // Explanation
      const expLines = [];
      while (i < lines.length && !/^\d+\s+вопрос\s*$/i.test(lines[i]) && !/^\d+\s+билет\s*$/i.test(lines[i])) {
        expLines.push(lines[i]);
        i++;
      }

      const expText = expLines.join(' ').replace(/\s+/g, ' ').trim();
      const qt = qtLines.join(' ').replace(/\s+/g, ' ').trim();
      if (!qt || answers.length < 2) continue;

      const answerTexts = answers.map(a => a.text);
      const inferred = inferCorrectFromExplanation(answerTexts, expText);
      questions.push({
        ticketNumber: currentTicket, questionNumber, questionText: qt,
        answers,
        correctAnswerNumber: inferred || 1, _certain: !!inferred,
        explanation: expText.trim(),
        category: 'ПДД', difficulty: 'medium', tags: [],
      });
      continue;
    }
    i++;
  }
  return questions;
}

function detectFormat(lines) {
  // Format B has lines like "1. answer text"
  const numDotLines = lines.filter(l => /^\d+\.\s+\S/.test(l)).length;
  return numDotLines > 20 ? 'B' : 'A';
}

// --- Load existing correct answers as override ---
function loadExistingAnswers() {
  const map = new Map();
  try {
    const existing = JSON.parse(fs.readFileSync('Avtotime-1/backend/questions_11-20.json', 'utf-8'));
    for (const q of existing) {
      map.set(`${q.ticketNumber}_${q.questionNumber}`, q.correctAnswerNumber);
    }
  } catch {}
  // From upload_all_tickets.js — parse JS
  try {
    const src = fs.readFileSync('Avtotime-1/backend/scripts/upload_all_tickets.js', 'utf-8');
    const re = /ticketNumber:\s*(\d+)[\s\S]*?questionNumber:\s*(\d+)[\s\S]*?correctAnswerNumber:\s*(\d+)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      map.set(`${m[1]}_${m[2]}`, parseInt(m[3]));
    }
  } catch {}
  // From upload_driving_questions.js
  try {
    const src = fs.readFileSync('Avtotime-1/backend/scripts/upload_driving_questions.js', 'utf-8');
    const re = /ticketNumber:\s*(\d+)[\s\S]*?questionNumber:\s*(\d+)[\s\S]*?correctAnswerNumber:\s*(\d+)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      map.set(`${m[1]}_${m[2]}`, parseInt(m[3]));
    }
  } catch {}
  return map;
}

// --- Main ---
const existing = loadExistingAnswers();
console.log(`Loaded ${existing.size} known correct answers from existing scripts`);

const fileConfigs = [
  { file: '1-5 билеты.txt' },
  { file: '6-10 билеты.txt' },
  { file: '11-20 билеты.txt' },
];

const allQuestions = [];
let uncertainCount = 0;

for (const { file } of fileConfigs) {
  if (!fs.existsSync(file)) { console.log(`SKIP: ${file}`); continue; }
  const lines = fs.readFileSync(file, 'utf-8').split('\n').map(l => l.trim());
  const fmt = detectFormat(lines);
  const qs = fmt === 'B' ? parseFormatB(lines) : parseFormatA(lines);

  // Override with known correct answers
  let overridden = 0;
  for (const q of qs) {
    const key = `${q.ticketNumber}_${q.questionNumber}`;
    if (existing.has(key)) {
      q.correctAnswerNumber = existing.get(key);
      q._certain = true;
      overridden++;
    }
  }

  const uncertain = qs.filter(q => !q._certain);
  console.log(`${file} [format ${fmt}]: ${qs.length} questions, ${overridden} overridden from DB, ${uncertain.length} uncertain`);
  if (uncertain.length > 0 && uncertain.length <= 10) {
    uncertain.forEach(q => console.log(`  ? T${q.ticketNumber} Q${q.questionNumber}: "${q.questionText.slice(0,50)}" → inferred ans=${q.correctAnswerNumber}`));
  }

  allQuestions.push(...qs);
  uncertainCount += uncertain.length;
}

allQuestions.forEach(q => delete q._certain);

const tickets = [...new Set(allQuestions.map(q => q.ticketNumber))].sort((a,b)=>a-b);
console.log(`\nTotal: ${allQuestions.length} questions, tickets: ${tickets.join(', ')}`);
console.log(`Uncertain: ${uncertainCount} (have inferred answers from explanation)`);

fs.writeFileSync('all_tickets_parsed.json', JSON.stringify(allQuestions, null, 2), 'utf-8');
console.log('Saved → all_tickets_parsed.json');
