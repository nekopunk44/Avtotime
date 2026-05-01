import React, { useState, useEffect } from "react";
import { serverURL } from "../../App";
import QuestionCard from "./QuestionCard";

const ExamMode = ({ onComplete, ticketNumber = 1 }) => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 minutes в секундах
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загрузить вопросы при первой загрузке
  useEffect(() => {
    fetchExamQuestions();
  }, [ticketNumber]);

  // Таймер
  useEffect(() => {
    if (timeLeft <= 0 && questions.length > 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, questions]);

  const fetchExamQuestions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = `${serverURL}/api/driving-courses/exam?ticket=${ticketNumber}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setQuestions(data.questions || []);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setTimeLeft(20 * 60);
    } catch (err) {
      setError("Не удалось загрузить вопросы: " + err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async () => {
    const testData = {
      mode: "exam",
      ticketNumber,
      totalQuestions: questions.length,
      correctAnswers: calculateCorrectAnswers(),
      timeSpentSeconds: 20 * 60 - timeLeft,
      answers: questions.map((q, idx) => ({
        questionId: q._id,
        questionNumber: idx + 1,
        selectedAnswer: userAnswers[idx],
        correctAnswer: q.correctAnswerNumber,
        isCorrect: userAnswers[idx] === q.correctAnswerNumber,
      })),
    };

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "${serverURL}/api/driving-courses/result",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(testData),
        }
      );
      const result = await response.json();
      onComplete(result);
    } catch (err) {
      setError("Ошибка при сохранении результата: " + err.message);
    }
  };

  const calculateCorrectAnswers = () => {
    return questions.filter(
      (q, idx) => userAnswers[idx] === q.correctAnswerNumber
    ).length;
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
