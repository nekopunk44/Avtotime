import React, { useCallback, useEffect, useRef, useState } from "react";
import { serverURL } from "../../config/serverUrl";
import { DRIVING_API, buildResultPayload, drivingFetchOptions } from "./resultPayload";
import QuestionCard from "./QuestionCard";

const EXAM_DURATION_SECONDS = 20 * 60;

const ExamMode = ({ onComplete, ticketNumber = 1 }) => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // The timer fires handleSubmit on every tick at 0; the result must be saved once.
  const submittedRef = useRef(false);

  const fetchExamQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${serverURL}${DRIVING_API}/exam?ticket=${ticketNumber}`;
      const response = await fetch(url, drivingFetchOptions());
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
      setQuestions(data.questions || []);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setTimeLeft(EXAM_DURATION_SECONDS);
    } catch (err) {
      setError("Не удалось загрузить вопросы: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [ticketNumber]);

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const testData = buildResultPayload({
      mode: "exam",
      questions,
      userAnswers,
      timeSpentSeconds: EXAM_DURATION_SECONDS - timeLeft,
      ticketNumber,
    });

    try {
      const response = await fetch(
        `${serverURL}${DRIVING_API}/result`,
        drivingFetchOptions({
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testData),
        })
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || `HTTP ${response.status}`);
      onComplete(result);
    } catch (err) {
      submittedRef.current = false;
      setError("Ошибка при сохранении результата: " + err.message);
    }
  }, [onComplete, questions, ticketNumber, timeLeft, userAnswers]);

  // Загрузить вопросы при первой загрузке
  useEffect(() => {
    fetchExamQuestions();
  }, [fetchExamQuestions]);

  // Таймер
  useEffect(() => {
    if (timeLeft <= 0 && questions.length > 0) {
      handleSubmit();
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [handleSubmit, questions.length, timeLeft]);

  const handleAnswer = (answerNumber) => {
    setUserAnswers({
      ...userAnswers,
      [currentQuestionIndex]: answerNumber,
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isAnswered = currentQuestionIndex in userAnswers;
  const isTimeWarning = timeLeft < 60;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header с таймером */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Режим Экзамена</h1>
            <p className="text-gray-600">Билет {ticketNumber}</p>
          </div>
          <div
            className={`text-4xl font-bold px-6 py-3 rounded-lg ${
              isTimeWarning
                ? "bg-red-100 text-red-700 animate-pulse"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Основной компонент вопроса */}
        <div className="mb-6 flex justify-center">
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            onAnswer={handleAnswer}
            selectedAnswer={userAnswers[currentQuestionIndex]}
            isAnswered={isAnswered}
          />
        </div>

        {/* Навигационные кнопки */}
        <div className="flex justify-between items-center mb-6 max-w-2xl mx-auto">
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Предыдущий
          </button>

          <div className="text-sm text-gray-600">
            Ответано: {Object.keys(userAnswers).length}/{questions.length}
          </div>

          <button
            onClick={handleNext}
            disabled={currentQuestionIndex === questions.length - 1}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Следующий →
          </button>
        </div>

        {/* Визуализация всех вопросов */}
        <div className="flex flex-wrap gap-2 justify-center mb-6 max-w-2xl mx-auto">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentQuestionIndex(idx)}
              className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                idx === currentQuestionIndex
                  ? "bg-blue-600 text-white scale-110"
                  : idx in userAnswers
                  ? "bg-green-500 text-white"
                  : "bg-gray-300 text-gray-700 hover:bg-gray-400"
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {/* Кнопка завершения*/}
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg transition-all"
          >
            Завершить тест
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamMode;
