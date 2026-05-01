import React from "react";

const ResultsPage = ({ result, onReset }) => {
  const {
    mode = "exam",
    totalQuestions = 0,
    correctAnswers = 0,
    percentage = 0,
    passed = false,
    timeSpentSeconds = 0,
  } = result || {};

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}ч ${minutes}м ${secs}с`;
    } else if (minutes > 0) {
      return `${minutes}м ${secs}с`;
    } else {
      return `${secs}с`;
    }
  };

  const getModeLabel = (m) => {
    switch (m) {
      case "exam":
        return "Экзамен";
      case "practice":
        return "Практика";
      case "marathon":
        return "Марафон";
      default:
        return "Тест";
    }
  };

  const getResultColor = () => {
    if (mode === "exam") {
      return passed ? "text-green-600" : "text-red-600";
    } else {
      return percentage >= 70 ? "text-green-600" : "text-orange-600";
    }
  };

  const getResultBgColor = () => {
    if (mode === "exam") {
      return passed ? "bg-green-50" : "bg-red-50";
    } else {
      return percentage >= 70 ? "bg-green-50" : "bg-orange-50";
    }
  };

  const getStatusIcon = () => {
    if (mode === "exam") {
      return passed ? "✓" : "✗";
    } else {
      return percentage >= 70 ? "✓" : "!";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Основной результат */}
        <div className={`${getResultBgColor()} rounded-2xl p-8 mb-8 border-2 ${
          mode === "exam"
            ? passed
              ? "border-green-300"
              : "border-red-300"
            : percentage >= 70
            ? "border-green-300"
            : "border-orange-300"
        }`}>
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${
                mode === "exam"
                  ? passed
                    ? "bg-green-600"
                    : "bg-red-600"
                  : percentage >= 70
                  ? "bg-green-600"
                  : "bg-orange-600"
              } text-white text-5xl font-bold mb-4`}
            >
              {getStatusIcon()}
            </div>

            <h1 className={`text-4xl font-bold ${getResultColor()} mb-2`}>
              {mode === "exam"
                ? passed
                  ? "Тест пройден!"
                  : "Тест не пройден"
                : percentage >= 70
                ? "Отличный результат!"
                : "Хороший результат"}
            </h1>

            <p className="text-gray-600 text-lg mb-6">
              Режим: <span className="font-semibold">{getModeLabel(mode)}</span>
            </p>

            {/* Основного показатель */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
              <p className="text-gray-600 text-sm mb-2">Правильных ответов</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-blue-600">
                  {correctAnswers}
                </span>
                <span className="text-3xl text-gray-400">/ {totalQuestions}</span>
              </div>
              <div className="mt-4 bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 transition-all"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <p className={`text-3xl font-bold mt-4 ${getResultColor()}`}>
                {percentage}%
              </p>
            </div>

            {/* Статус для экзамена */}
            {mode === "exam" && (
              <div className="mb-6">
                <p className="text-gray-600 text-sm mb-2">Проходной балл</p>
                <div className="flex justify-center gap-8">
                  <div>
                    <p className="text-gray-600">Требуется</p>
                    <p className="text-2xl font-bold text-gray-800">70%</p>
                  </div>
                  <div className="border-l border-gray-300"></div>
                  <div>
                    <p className="text-gray-600">Ваш результат</p>
                    <p className={`text-2xl font-bold ${getResultColor()}`}>
                      {percentage}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Детальная статистика */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Время на тест</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatTime(timeSpentSeconds)}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Среднее время на вопрос</p>
            <p className="text-2xl font-bold text-gray-800">
              {Math.round(timeSpentSeconds / totalQuestions)}с
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Правильных ответов</p>
            <p className="text-2xl font-bold text-green-600">{correctAnswers}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Неправильных ответов</p>
            <p className="text-2xl font-bold text-red-600">
              {totalQuestions - correctAnswers}
            </p>
          </div>
        </div>

        {/* Советы и рекомендации */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-blue-900 mb-3">💡 Рекомендации:</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            {mode === "exam" && !passed && (
              <>
                <li>
                  • Ваш результат ниже проходного балла (70%). Попробуйте еще
                  раз!
                </li>
                <li>• Изучите неправильные ответы и их объяснения</li>
                <li>• Пройдите режим практики для лучшего понимания материала</li>
              </>
            )}
            {mode === "exam" && passed && (
              <>
                <li>• Поздравляем! Вы успешно прошли экзамен</li>
                <li>• Рекомендуем пройти другие билеты для закрепления знаний</li>
                <li>• Попробуйте режим Марафона для полного понимания материала</li>
              </>
            )}
            {mode === "practice" && (
              <>
                <li>• Хороший результат! Продолжайте тренироваться</li>
                <li>• Повторите неправильные ответы</li>
                <li>
                  • Чувствуете себя готовым? Попробуйте реальный экзамен!
                </li>
              </>
            )}
            {mode === "marathon" && (
              <>
                <li>
                  • Прделали отличную работу, прошли 800 вопросов!
                </li>
                <li>• Этот режим отлично подходит для глубокого изучения</li>
                <li>• Повторите слабые места в режиме практики</li>
              </>
            )}
          </ul>
        </div>

        {/* Кнопки действий */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={onReset}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-all"
          >
            ← Вернуться в меню
          </button>

          <a
            href="/auto-courses"
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-all text-center"
          >
            Попробовать другой режим →
          </a>
        </div>

        {/* Краткая справка */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-3">ℹ️ Информация:</h3>
          <p className="text-sm text-gray-700">
            Ваши результаты сохранены и доступны в разделе "Статистика". Вы
            можете отследить свой прогресс и сравнить результаты разных попыток.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
