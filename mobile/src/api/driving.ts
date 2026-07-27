import client, { API_URL } from './client';

// Normalize question image URLs: make relative paths absolute, and upgrade
// http → https. The backend builds local image URLs from req.protocol, which
// is "http" behind nginx, and Android blocks cleartext http images by default.
export function resolveQuestionImage(url?: string): string | undefined {
  if (!url) return undefined;
  let u = url.trim();
  if (u.startsWith('//')) u = `https:${u}`;
  else if (!/^https?:\/\//i.test(u)) u = `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`;
  return u.replace(/^http:\/\//i, 'https://');
}

export type DrivingMode = 'exam' | 'practice' | 'marathon';

export interface DrivingAnswer {
  number: number;
  text: string;
}

export interface DrivingQuestion {
  _id: string;
  ticketNumber: number;
  questionNumber: number;
  questionText: string;
  answers: DrivingAnswer[];
  correctAnswerNumber?: number;
  explanation?: string;
  imageUrl?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface DrivingTicket {
  number: number;
  totalQuestions: number;
}

export interface DrivingStatistics {
  totalTests: number;
  totalQuestionsPassed: number;
  totalQuestionsCorrect: number;
  averagePercentage: number;
  passedExams: number;
  examStats?: { total: number; passed: number };
  practiceStats?: { total: number; questions: number };
  marathonStats?: { total: number; questions: number };
}

export interface SaveDrivingResultPayload {
  mode: DrivingMode;
  ticketNumbers: number[];
  timeSpentSeconds: number;
  questions: Array<{
    questionId: string;
    ticketNumber: number;
    questionNumber: number;
    selectedAnswer?: number;
    correctAnswer?: number;
    isCorrect: boolean;
  }>;
}

export interface DrivingResultAnswer {
  questionId?: string;
  ticketNumber?: number;
  questionNumber?: number;
  selectedAnswer?: number;
  correctAnswer?: number;
  isCorrect: boolean;
}

export interface DrivingTestResult {
  _id: string;
  mode: DrivingMode;
  ticketNumbers: number[];
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  percentage: number;
  passed: boolean;
  timeSpentSeconds?: number;
  status?: 'in_progress' | 'completed' | 'abandoned';
  answers?: DrivingResultAnswer[];
  createdAt?: string;
  updatedAt?: string;
}

export async function getDrivingTickets(): Promise<DrivingTicket[]> {
  const { data } = await client.get('/driving-courses/tickets');
  return Array.isArray(data) ? data : [];
}

export async function getDrivingStatistics(): Promise<DrivingStatistics> {
  const { data } = await client.get('/driving-courses/statistics');
  return data;
}

export async function getDrivingQuestions(mode: DrivingMode, ticketNumber?: number): Promise<DrivingQuestion[]> {
  const limit = mode === 'marathon' ? 100 : 20;
  const params: Record<string, number> = { limit };
  if (ticketNumber) params.ticketNumber = ticketNumber;

  const { data } = await client.get('/driving-courses/questions-with-answers', { params });
  const raw = Array.isArray(data) ? data : data.questions ?? [];
  const questions: DrivingQuestion[] = raw.map((q: DrivingQuestion) => ({
    ...q,
    imageUrl: resolveQuestionImage(q.imageUrl),
  }));

  if (mode === 'marathon') {
    return [...questions].sort(() => Math.random() - 0.5).slice(0, limit);
  }

  return questions.slice(0, limit);
}

export async function saveDrivingResult(payload: SaveDrivingResultPayload) {
  const { data } = await client.post('/driving-courses/result', payload);
  return data;
}

export async function getDrivingResults(
  options: { mode?: DrivingMode; limit?: number } = {},
): Promise<DrivingTestResult[]> {
  const params: Record<string, string | number> = { limit: options.limit ?? 20 };
  if (options.mode) params.mode = options.mode;

  const { data } = await client.get('/driving-courses/results', { params });
  return Array.isArray(data) ? data : data.results ?? [];
}
