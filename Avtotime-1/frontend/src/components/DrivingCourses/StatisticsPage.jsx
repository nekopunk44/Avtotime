import React, { useState, useEffect } from "react";
import { serverURL } from "../../config/serverUrl";

const StatisticsPage = () => {
  const [statistics, setStatistics] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMode, setSelectedMode] = useState("all");

  useEffect(() => {
    fetchStatistics();
    fetchResults();
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await fetch(
        `${serverURL}/api/driving-courses/statistics`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      setError("Не удалось загрузить статистику: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch(
        `${serverURL}/api/driving-courses/results?limit=50`,
        {
          credentials: "include",
        }
      );
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Ошибка загрузки результатов:", err);
    }
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
        {
          error
        }
      </div>
    );
  }

  const stats = statistics || {};
  const filteredResults =
    selectedMode === "all"
      ? results
      : results.filter((r) => r.mode === selectedMode);

  const getModeLabel = (mode) => {
    switch (mode) {
      case "exam":
        return "Экзамен";
      case "practice":
        return "Практика";
      case "marathon":
        return "Марафон";
      default:
        return mode;
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case "exam":
        return "bg-blue-100 text-blue-800";
      case "practice":
        return "bg-green-100 text-green-800";
      case "marathon":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}м ${secs}с`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Ваша статистика</h1>

        {/* Основные метрики */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Всего тестов</p>
            <p className="text-4xl font-bold text-blue-600">
              {stats.totalTests || 0}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Средний результат</p>
            <p className="text-4xl font-bold text-green-600">
              {Math.round(stats.averagePercentage || 0)}%
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Тестов пройдено</p>
            <p className="text-4xl font-bold text-purple-600">
              {stats.passedExams || 0}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Общее время</p>
            <p className="text-3xl font-bold text-orange-600">
              {formatTime(stats.totalTimeSpent || 0)}
            </p>
          </div>
        </div>

        {/* Статистика по режимам */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Экзамены */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Экзамены</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Попыток:</span>
                <span className="font-semibold text-blue-700">
                  {stats.examStats?.attempts || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Пройдено:</span>
                <span className="font-semibold text-green-700">
                  {stats.examStats?.passed || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Средний процент:</span>
                <span className="font-semibold text-blue-700">
                  {Math.round(stats.examStats?.averagePercentage || 0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Успешность:</span>
                <span className="font-semibold text-purple-700">
                  {Math.round(
                    ((stats.examStats?.passed || 0) /
                      Math.max(stats.examStats?.attempts || 1, 1)) *
                      100
                  )}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Практика */}
          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <h3 className="text-lg font-semibold text-green-900 mb-4">Практика</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Сеансов:</span>
                <span className="font-semibold text-green-700">
                  {stats.practiceStats?.attempts || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Средний процент:</span>
                <span className="font-semibold text-green-700">
                  {Math.round(stats.practiceStats?.averagePercentage || 0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Всего вопросов:</span>
                <span className="font-semibold text-green-700">
                  {stats.practiceStats?.totalQuestions || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Всего правильно:</span>
                <span className="font-semibold text-green-700">
                  {stats.practiceStats?.totalCorrect || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Марафон */}
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
            <h3 className="text-lg font-semibold text-purple-900 mb-4">
              Марафон
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Попыток:</span>
                <span className="font-semibold text-purple-700">
                  {stats.marathonStats?.attempts || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Средний процент:</span>
                <span className="font-semibold text-purple-700">
                  {Math.round(stats.marathonStats?.averagePercentage || 0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Всего вопросов:</span>
                <span className="font-semibold text-purple-700">
                  {stats.marathonStats?.totalQuestions || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Всего правильно:</span>
                <span className="font-semibold text-purple-700">
                  {stats.marathonStats?.totalCorrect || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* История результатов */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">
              История результатов
            </h3>

            {/* Фильтр по режимам */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedMode("all")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedMode === "all"
                    ? "bg-gray-800 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                Все ({results.length})
              </button>
              <button
                onClick={() => setSelectedMode("exam")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedMode === "exam"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                }`}
              >
                Экзамены (
                {results.filter((r) => r.mode === "exam").length})
              </button>
              <button
                onClick={() => setSelectedMode("practice")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedMode === "practice"
                    ? "bg-green-600 text-white"
                    : "bg-green-100 text-green-800 hover:bg-green-200"
                }`}
              >
                Практика (
                {results.filter((r) => r.mode === "practice").length})
              </button>
              <button
                onClick={() => setSelectedMode("marathon")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedMode === "marathon"
                    ? "bg-purple-600 text-white"
                    : "bg-purple-100 text-purple-800 hover:bg-purple-200"
                }`}
              >
                Марафон (
                {results.filter((r) => r.mode === "marathon").length})
              </button>
            </div>
          </div>

          {/* Таблица результатов */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Дата и время
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Режим
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Результат
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Время
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.length > 0 ? (
                  filteredResults.map((result, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatDate(result.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getModeColor(
                            result.mode
                          )}`}
                        >
                          {getModeLabel(result.mode)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {result.correctAnswers}/{result.totalQuestions} (
                        {result.percentage}%)
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatTime(result.timeSpentSeconds)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {result.passed ? (
                          <span className="text-green-700 font-semibold">
                            ✓ Пройден
                          </span>
                        ) : (
                          <span className="text-orange-700 font-semibold">
                            ! Завершен
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      Нет результатов для отображения
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;
