import React, { useState } from "react";

const QuestionCard = ({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  selectedAnswer = null,
  isAnswered = false,
}) => {
  const {
    questionText,
    answers,
    correctAnswerNumber,
    explanation,
    imageUrl,
    difficulty,
  } = question;

  const [showExp, setShowExp] = useState(false);

  const getDifficultyColor = (level) => {
    switch (level) {
      case "easy":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "hard":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getAnswerColor = (answerNumber) => {
    if (!isAnswered) return "bg-white hover:bg-gray-100";

    if (answerNumber === correctAnswerNumber) {
      return "bg-green-100 border-2 border-green-500";
    }

    if (answerNumber === selectedAnswer && answerNumber !== correctAnswerNumber) {
      return "bg-red-100 border-2 border-red-500";
    }

    return "bg-gray-100";
  };

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6">
      {/* Заголовок с номером вопроса */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-600">
          Вопрос {questionNumber} из {totalQuestions}
        </span>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${getDifficultyColor(
            difficulty
          )}`}
        >
          {difficulty === "easy"
            ? "Легко"
            : difficulty === "medium"
            ? "Средне"
            : "Сложно"}
        </span>
      </div>

      {/* Прогресс-бар */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
        ></div>
      </div>

      {/* Изображение вопроса */}
      {imageUrl && (
        <div className="mb-6">
          <img
            src={imageUrl}
            alt="Question"
            className="w-full rounded-lg max-h-64 object-cover"
          />
        </div>
      )}

      {/* Текст вопроса */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">{questionText}</h3>
      </div>

      {/* Варианты ответов */}
      <div className="space-y-3 mb-6">
        {answers.map((answer) => (
          <button
            key={answer.number}
            onClick={() => {
              if (!isAnswered) {
                onAnswer(answer.number);
              }
            }}
            disabled={isAnswered}
            className={`w-full text-left p-4 rounded-lg border-2 border-gray-300 transition-all ${getAnswerColor(
              answer.number
            )} ${
              isAnswered ? "cursor-not-allowed" : "cursor-pointer"
            } disabled:opacity-75`}
          >
            <div className="flex items-start">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-3 text-sm font-bold flex-shrink-0 ${
                  selectedAnswer === answer.number || isAnswered
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 text-gray-700"
                }`}
              >
                {answer.number}
              </span>
              <span className="text-gray-800">{answer.text}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Кнопка показать объяснение */}
      {isAnswered && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <button
            onClick={() => setShowExp(!showExp)}
            className="text-blue-600 font-semibold hover:text-blue-800 transition-colors"
          >
            {showExp ? "▼ Скрыть объяснение" : "▶ Показать объяснение"}
          </button>

          {showExp && (
            <div className="mt-3 text-gray-700 bg-white p-3 rounded border-l-4 border-blue-500">
              {explanation}
            </div>
          )}

          {/* Результат ответа */}
          <div className="mt-3">
            {selectedAnswer === correctAnswerNumber ? (
              <div className="flex items-center text-green-700 font-semibold">
                <span className="mr-2">✓</span>
                <span>Правильный ответ!</span>
              </div>
            ) : (
              <div className="flex items-center text-red-700 font-semibold">
                <span className="mr-2">✗</span>
                <span>Неправильный ответ. Правильный: {correctAnswerNumber}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
