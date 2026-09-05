import React, { useState, useEffect } from "react";
import { serverURL } from "../../config/serverUrl";
import QuestionCard from "./QuestionCard";

// Module scope on purpose: react-hooks/purity conservatively flags Date.now()
// even inside this component's click handler; an opaque helper keeps the call
// site clean without changing behaviour.
const secondsSince = (startMs) => Math.floor((Date.now() - startMs) / 1000);

const PracticeMode = ({ onComplete, ticketNumber = null }) => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startTime] = useState(() => Date.now());

  const fetchPracticeQuestions = async () => {
    setLoading(true);
    try {
      const url = ticketNumber
        ? `${serverURL}/api/driving-courses/practice?ticket=${ticketNumber}`
        : `${serverURL}/api/driving-courses/practice`;

      const response = await fetch(url, {
        credentials: "include",
      });
      const data = await response.json();
      setQuestions(data.questions || []);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
    } catch (err) {
      setError("Не удалось загрузить вопросы: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPracticeQuestions();
  }, [ticketNumber]);

  

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

  const handleJumpToQuestion = (index) => {
    setCurrentQuestionIndex(index);
  };

  const handleComplete = async () => {
    const timeSpent = secondsSince(startTime);

    const testData = {
      mode: "practice",
      ticketNumber: ticketNumber || null,
      totalQuestions: questions.length,
      correctAnswers: calculateCorrectAnswers(),
      timeSpentSeconds: timeSpent,
      answers: questions.map((q, idx) => ({
        questionId: q._id,
        questionNumber: idx + 1,
        selectedAnswer: userAnswers[idx],
        correctAnswer: q.correctAnswerNumber,
        isCorrect: userAnswers[idx] === q.correctAnswerNumber,
      })),
    };

    try {
      const response = await fetch(
        `${serverURL}/api/driving-courses/result`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
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
  const correctAnswers = calculateCorrectAnswers();
  const percentage = Math.round((correctAnswers / questions.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Режим Практики</h1>
            <p className="text-gray-600">
              {ticketNumber ? `Билет ${ticketNumber}` : "Все билеты"}
            </p>
          </div>
          <div className="bg-green-100 px-6 py-3 rounded-lg">
            <p className="text-sm text-gray-600">Правильных ответов</p>
            <p className="text-3xl font-bold text-green-700">
              {correctAnswers}/{questions.length}
            </p>
          </div>
        </div>

        {/* Главный компонент вопроса */}
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

          <button
            onClick={handleNext}
            disabled={currentQuestionIndex === questions.length - 1}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Следующий →
          </button>
        </div>

        {/* Grid с номерами вопросов */}
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mb-6 max-w-2xl mx-auto">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleJumpToQuestion(idx)}
              className={`p-2 rounded-lg font-semibold transition-all text-sm ${
                idx === currentQuestionIndex
                  ? "bg-blue-600 text-white scale-110"
                  : idx in userAnswers
                  ? userAnswers[idx] === questions[idx].correctAnswerNumber
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                  : "bg-gray-300 text-gray-700 hover:bg-gray-400"
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {/* Общая статистика и кнопка завершения */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 max-w-2xl mx-auto">
          <div className="text-center">
            <p className="text-gray-600">Процент правильных ответов</p>
            <p
              className={`text-4xl font-bold ${
                percentage >= 70 ? "text-green-700" : "text-orange-700"
              }`}
            >
              {percentage}%
            </p>
          </div>

          <button
            onClick={handleComplete}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg transition-all w-full sm:w-auto"
          >
            Завершить практику
          </button>
        </div>
      </div>
    </div>
  );
};

export default PracticeMode;
