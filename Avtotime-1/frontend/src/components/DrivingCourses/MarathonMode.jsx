import React, { useState, useEffect } from "react";
import { serverURL } from "../../App";
import QuestionCard from "./QuestionCard";

const MarathonMode = ({ onComplete }) => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startTime] = useState(Date.now());
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    fetchMarathonQuestions();
  }, []);

  const fetchMarathonQuestions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "${serverURL}/api/driving-courses/marathon",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setQuestions(data.questions || []);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setSessionStats({ correct: 0, total: data.questions?.length || 0 });
    } catch (err) {
      setError("Не удалось загрузить вопросы: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answerNumber) => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = answerNumber === currentQuestion.correctAnswerNumber;

    setUserAnswers({
      ...userAnswers,
      [currentQuestionIndex]: answerNumber,
    });

    setSessionStats((prev) => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
    }));
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
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    const testData = {
      mode: "marathon",
      ticketNumber: null,
      totalQuestions: questions.length,
      correctAnswers: sessionStats.correct,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
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
  const percentage = Math.round((sessionStats.correct / questions.length) * 100);
  const percentComplete = Math.round(
    ((currentQuestionIndex + 1) / questions.length) * 100
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header с прогрессом */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Режим Марафона
              </h1>
              <p className="text-gray-600">
                Вопрос {currentQuestionIndex + 1} из {questions.length}
              </p>
            </div>
            <div className="bg-purple-100 px-6 py-3 rounded-lg text-right">
              <p className="text-sm text-gray-600">Правильных ответов</p>
              <p className="text-3xl font-bold text-purple-700">
                {sessionStats.correct}/{sessionStats.total}
              </p>
              <p className="text-xl font-semibold text-purple-600 mt-1">
                {percentage}%
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 transition-all"
              style={{ width: `${percentComplete}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            {percentComplete}% завершено
          </p>
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

        {/* Быстрая навигация - только показываем каждый 10-й вопрос */}
        <div className="flex flex-wrap gap-2 justify-center mb-6 max-w-2xl mx-auto">
          {Array.from({ length: Math.ceil(questions.length / 10) }).map(
            (_, i) => {
              const idx = i * 10;
              return (
                <button
                  key={idx}
                  onClick={() => handleJumpToQuestion(idx)}
                  className={`px-3 py-2 rounded-lg font-semibold transition-all text-sm ${
                    idx === Math.floor(currentQuestionIndex / 10) * 10
                      ? "bg-purple-600 text-white scale-110"
                      : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            }
          )}
        </div>

        {/* Кнопка завершения особенно видна в марафоне */}
        <div className="flex justify-center">
          <button
            onClick={handleComplete}
            className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-lg transition-all hover:scale-105"
          >
            Завершить марафон
          </button>
        </div>

        {/* Подсказка */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl mx-auto">
          <p className="text-sm text-yellow-800">
            💡 <strong>Совет:</strong> Вы можете ответить на все 800 вопросов
            без ограничения времени. Прогресс сохраняется автоматически при
            ответе на каждый вопрос.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MarathonMode;
