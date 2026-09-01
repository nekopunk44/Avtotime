// The API base for every driving-courses request.
export const DRIVING_API = "/api/driving-courses";

// The whole app authenticates with an httpOnly cookie, so every request has to
// opt into credentials; there is no bearer token anywhere in this client.
export const drivingFetchOptions = (extra = {}) => ({
  credentials: "include",
  ...extra,
});

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const collectTicketNumbers = (questions, fallbackTicket) => {
  const numbers = new Set();

  (questions || []).forEach((question) => {
    const ticket = toFiniteNumber(question?.ticketNumber);
    if (ticket !== null) numbers.add(ticket);
  });

  if (numbers.size === 0) {
    const fallback = toFiniteNumber(fallbackTicket);
    if (fallback !== null) numbers.add(fallback);
  }

  return [...numbers].sort((a, b) => a - b);
};

/**
 * Server contract (drivingCourse.controllers.js#saveTestResult):
 * { mode, ticketNumbers: number[], timeSpentSeconds, questions: [...] }.
 * Anything else is rejected with 400. Mirrors mobile/src/api/driving.ts.
 */
export const buildResultPayload = ({
  mode,
  questions,
  userAnswers,
  timeSpentSeconds,
  ticketNumber = null,
}) => {
  const list = Array.isArray(questions) ? questions : [];

  return {
    mode,
    ticketNumbers: collectTicketNumbers(list, ticketNumber),
    timeSpentSeconds,
    questions: list.map((question, index) => {
      const selectedAnswer = userAnswers?.[index];
      const correctAnswer = question?.correctAnswerNumber;

      return {
        questionId: question?._id,
        ticketNumber: toFiniteNumber(question?.ticketNumber) ?? toFiniteNumber(ticketNumber) ?? undefined,
        questionNumber: toFiniteNumber(question?.questionNumber) ?? index + 1,
        selectedAnswer,
        correctAnswer,
        isCorrect: selectedAnswer !== undefined && selectedAnswer === correctAnswer,
      };
    }),
  };
};
