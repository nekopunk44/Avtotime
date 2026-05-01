import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, CheckCircle, XCircle, ChevronLeft } from 'lucide-react';
import { useDrivingQuestionImage } from '../../hooks/useDrivingQuestionImage';
import { API_URL } from '../../utils/config';

// Стили для анимаций
const animationStyles = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes pulse-scale {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  @keyframes countUp {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }

  .animate-slideIn {
    animation: slideIn 0.6s ease-out forwards;
  }

  .animate-scaleIn {
    animation: scaleIn 0.5s ease-out;
  }

  .animate-pulse-scale {
    animation: pulse-scale 2s ease-in-out infinite;
  }

  .animate-delay-1 {
    animation-delay: 0.1s;
  }

  .animate-delay-2 {
    animation-delay: 0.2s;
  }

  .animate-delay-3 {
    animation-delay: 0.3s;
  }

  .animate-delay-4 {
    animation-delay: 0.4s;
  }

  .result-button {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .result-button:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  }

  .result-button:active {
    transform: translateY(-2px);
  }
`;

interface DrivingQuestion {
  _id: string;
  ticketNumber: number;
  questionNumber: number;
  questionText: string;
  answers: Array<{ number: number; text: string }>;
  correctAnswerNumber: number;
  explanation: string;
  imageUrl?: string;
}

interface ExamScreenProps {
  selectedTicket: number;
  onReset: () => void;
}

// Компонент для анимированного счета
const AnimatedPercent: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = value / 50;
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 10);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue}%</span>;
};

export const ExamScreen: React.FC<ExamScreenProps> = ({ selectedTicket, onReset }) => {
  const [questions, setQuestions] = useState<DrivingQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: number]: number;
  }>({});
  const [showResults, setShowResults] = useState(false);
  const [viewingAnswerIndex, setViewingAnswerIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(20 * 60); // 20 minutes in seconds

  // Добавляем стили анимаций в DOM
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = animationStyles;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        const url = `${API_URL}/driving-courses/questions-with-answers?ticketNumber=${selectedTicket}&limit=20`;
        const response = await fetch(url);

        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          const message =
            typeof (data as { message?: unknown } | null)?.message === 'string'
              ? (data as { message: string }).message
              : `Ошибка ${response.status}`;
          setError(message);
          return;
        }

        const questionsData = Array.isArray(data)
          ? data
          : Array.isArray((data as { questions?: unknown } | null)?.questions)
            ? (data as { questions: unknown[] }).questions
            : null;

        if (!questionsData) {
          setError('Ошибка: неверный формат ответа');
          return;
        }

        setQuestions(questionsData as DrivingQuestion[]);
        if (questionsData.length === 0) {
          setError(`Нет вопросов для билета ${selectedTicket}`);
        }
      } catch (err) {
        setError(`Ошибка при загрузке вопросов`);
        console.error('Error fetching questions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [selectedTicket]);

  // Загружаем полные данные вопросов при переходе к просмотру результатов
  useEffect(() => {
    if (showResults && questions.length > 0 && !questions[0].correctAnswerNumber) {
      const fetchFullQuestions = async () => {
        try {
          const url = `${API_URL}/driving-courses/questions-with-answers?ticketNumber=${selectedTicket}&limit=20`;
          const response = await fetch(url);

          let data: unknown = null;
          try {
            data = await response.json();
          } catch {
            data = null;
          }

          if (!response.ok) return;

          if (Array.isArray(data) && data.length > 0) {
            setQuestions(data as DrivingQuestion[]);
          }
        } catch (error) {
          console.error('Ошибка загрузки полных данных вопросов:', error);
        }
      };
      
      fetchFullQuestions();
    }
  }, [showResults, selectedTicket]);

  // Timer countdown
  useEffect(() => {
    if (showResults || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setShowResults(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showResults, questions.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (answerNumber: number) => {
    if (!showResults) {
      setSelectedAnswers({
        ...selectedAnswers,
        [currentQuestionIndex]: answerNumber
      });
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowResults(true);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const calculateScore = () => {
    if (questions.length === 0) return 0;

    const correctCount = questions.reduce((count, question, index) => {
      return count +
        (selectedAnswers[index] === question.correctAnswerNumber ? 1 : 0);
    }, 0);

    return Math.round((correctCount / questions.length) * 100);
  };

  const question = questions[currentQuestionIndex];
  const reviewQuestion = viewingAnswerIndex !== null ? questions[viewingAnswerIndex] : undefined;
  const currentImageUrl = useDrivingQuestionImage(question);
  const reviewImageUrl = useDrivingQuestionImage(reviewQuestion);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-16 pb-24 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900">Загрузка вопросов...</h2>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-white pt-16 pb-24 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Ошибка</h2>
          <p className="text-gray-600 mb-8">{error || `Нет вопросов для билета ${selectedTicket}`}</p>
          <button
            onClick={onReset}
            className="px-6 py-3 bg-[#0066ff] text-white rounded-lg font-bold hover:bg-blue-700"
          >
            Вернуться в меню
          </button>
        </div>
      </div>
    );
  }
  const score = calculateScore();
  const correctCount = Object.entries(selectedAnswers).filter(([index, answer]) => {
    return answer === questions[parseInt(index)]?.correctAnswerNumber;
  }).length;
  const wrongCount = Math.max(0, questions.length - correctCount);
  const isPassed = correctCount >= 14;
  const timeSpentSeconds = Math.max(0, 20 * 60 - timeRemaining);

  if (showResults) {
    // Просмотр конкретного вопроса
    if (viewingAnswerIndex !== null) {
      const reviewQuestion = questions[viewingAnswerIndex];
      const userAnswer = selectedAnswers[viewingAnswerIndex];
      const isCorrect = userAnswer === reviewQuestion.correctAnswerNumber;

      return (
        <div className="min-h-screen bg-white pt-16 pb-24">
          <div className="max-w-4xl mx-auto px-4">
            {/* Header with back button */}
            <button
              onClick={() => setViewingAnswerIndex(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-8"
            >
              <ChevronLeft className="w-6 h-6" />
              Назад к результатам
            </button>

            {/* Question Card */}
            <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 mb-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-gray-600">Вопрос {viewingAnswerIndex + 1}</span>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                  {isCorrect ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-600 font-semibold">Правильно</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-red-600 font-semibold">Неправильно</span>
                    </>
                  )}
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-8">{reviewQuestion.questionText}</h2>

              {reviewImageUrl && (
                <div className="mb-8">
                  <img
                    src={reviewImageUrl}
                    alt="Question"
                    className="w-full max-h-64 object-cover rounded-lg"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}

              {/* Answers */}
              <div className="space-y-4 mb-8">
                {reviewQuestion.answers && reviewQuestion.answers.length > 0 ? (
                  reviewQuestion.answers.map((answer) => {
                    const isUserAnswer = userAnswer === answer.number;
                    const isCorrectAnswer = answer.number === reviewQuestion.correctAnswerNumber;
                    let buttonClass = 'bg-white border-2 border-gray-200';

                    if (isCorrectAnswer) {
                      buttonClass = 'bg-green-50 border-2 border-green-500 shadow-md';
                    } else if (isUserAnswer && !isCorrect) {
                      buttonClass = 'bg-red-50 border-2 border-red-500 shadow-md';
                    }

                    return (
                      <div
                        key={answer.number}
                        className={`p-5 rounded-lg cursor-default transition-all hover:shadow-md ${buttonClass}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-lg ${
                            isCorrectAnswer ? 'bg-green-500' : isUserAnswer && !isCorrect ? 'bg-red-500' : 'bg-gray-300'
                          }`}>
                            {answer.number}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-base">{answer.text}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {isCorrectAnswer && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                                  Правильный ответ
                                </span>
                              )}
                              {isUserAnswer && isCorrect && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                                  Вы выбрали это
                                </span>
                              )}
                              {isUserAnswer && !isCorrect && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
                                  Вы выбрали это
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-red-600 p-4 bg-red-50 rounded-lg">Варианты ответов не загружены</p>
                )}
              </div>

              {/* Explanation - More Prominent */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-l-4 border-blue-600 p-8 rounded-lg mb-8 shadow-md">
                <p className="text-lg font-bold text-blue-900 mb-4">Объяснение:</p>
                {reviewQuestion.explanation && reviewQuestion.explanation.trim() ? (
                  <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">{reviewQuestion.explanation}</p>
                ) : (
                  <p className="text-gray-600 italic">Объяснение не доступно для этого вопроса</p>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 justify-between">
              <button
                onClick={() => {
                  if (viewingAnswerIndex > 0) {
                    setViewingAnswerIndex(viewingAnswerIndex - 1);
                  }
                }}
                disabled={viewingAnswerIndex === 0}
                className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300 disabled:opacity-50"
              >
                Предыдущий
              </button>

              <button
                onClick={() => {
                  if (viewingAnswerIndex < questions.length - 1) {
                    setViewingAnswerIndex(viewingAnswerIndex + 1);
                  }
                }}
                disabled={viewingAnswerIndex === questions.length - 1}
                className="px-6 py-3 bg-[#0066ff] text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                Следующий
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Список результатов с возможностью просмотра
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-16 pb-24">
        <style>{animationStyles}</style>
        <div className="max-w-4xl mx-auto px-4">
          {/* Главный результат карточка */}
          <div className="bg-white rounded-3xl p-12 shadow-lg border border-gray-100 mb-8 text-center animate-slideIn relative overflow-hidden">
            {/* Decorative background */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
              style={{ background: isPassed ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.16)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full blur-3xl"
              style={{ background: 'rgba(37,99,235,0.10)' }}
            />
            {/* Иконка результата с анимацией */}
            <div className="relative mx-auto mb-6 h-32 w-32 animate-scaleIn">
              <div
                className="absolute inset-0 rounded-full shadow-sm"
                style={{
                  background: `conic-gradient(${isPassed ? '#10b981' : '#ef4444'} 0% ${score}%, #e5e7eb ${score}% 100%)`,
                }}
              />
              <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center shadow-sm">
                {isPassed ? (
                  <CheckCircle className="w-12 h-12 text-green-600" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600" />
                )}
              </div>
              <div
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-bold shadow-md border"
                style={{
                  backgroundColor: isPassed ? '#ecfdf5' : '#fef2f2',
                  borderColor: isPassed ? '#bbf7d0' : '#fecaca',
                  color: isPassed ? '#047857' : '#b91c1c',
                }}
              >
                <AnimatedPercent value={score} />
              </div>
            </div>

            {/* Заголовок с анимацией */}
            <h1 className="text-4xl font-serif font-bold text-gray-900 mb-4 animate-slideIn animate-delay-1">
              {isPassed ? 'Экзамен сдан' : 'Экзамен не сдан'}
            </h1>

            <p className="text-gray-600 animate-slideIn animate-delay-2">
              Билет <span className="font-semibold text-gray-900">№{selectedTicket}</span> • Время: <span className="font-semibold text-gray-900">{formatTime(timeSpentSeconds)}</span>
            </p>

            {/* Результат по вопросам */}
            <p className="text-xl text-gray-600 mb-8 animate-slideIn animate-delay-3">
              Вы ответили правильно на <span className="font-bold text-green-600">{correctCount}</span> из <span className="font-bold">{questions.length}</span> вопросов
            </p>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto mb-8 animate-slideIn animate-delay-3">
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left">
                <div className="text-sm text-gray-500">Правильно</div>
                <div className="text-2xl font-bold text-green-600">{correctCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left">
                <div className="text-sm text-gray-500">Ошибок</div>
                <div className="text-2xl font-bold text-red-600">{wrongCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left">
                <div className="text-sm text-gray-500">Нужно для сдачи</div>
                <div className="text-2xl font-bold text-gray-900">14</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left">
                <div className="text-sm text-gray-500">До сдачи</div>
                <div className="text-2xl font-bold text-gray-900">{Math.max(0, 14 - correctCount)}</div>
              </div>
            </div>

            {!isPassed && (
              <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-left animate-slideIn animate-delay-4">
                <div className="font-semibold text-red-700 mb-1">Совет</div>
                <div className="text-red-700/90">
                  Посмотрите ошибки и попробуйте ещё раз — для сдачи нужно минимум <span className="font-semibold">14</span> правильных ответов.
                </div>
              </div>
            )}

            {/* Кнопки действия */}
            <div className="flex gap-4 justify-center flex-wrap animate-slideIn animate-delay-4">
              <button
                onClick={() => setViewingAnswerIndex(0)}
                className="result-button px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
            Просмотреть ответы
              </button>
              <button
                onClick={onReset}
                className="result-button px-6 py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-bold hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-gray-400/40"
              >
                Вернуться в меню
              </button>
              <button
                onClick={() => {
                  setCurrentQuestionIndex(0);
                  setSelectedAnswers({});
                  setShowResults(false);
                  setViewingAnswerIndex(null);
                  setTimeRemaining(20 * 60);
                }}
                className="result-button px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                Попробовать снова
              </button>
            </div>
          </div>

          {/* Сетка результатов по вопросам */}
          <div className="bg-white rounded-3xl p-12 shadow-lg border border-gray-100 animate-slideIn animate-delay-1">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Результаты по вопросам</h2>
                <p className="text-gray-600 mt-1">Нажмите на номер, чтобы посмотреть ответ и объяснение.</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-gray-600">Верно</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-gray-600">Ошибка</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
              {questions.map((q, index) => {
                const isCorrect = selectedAnswers[index] === q.correctAnswerNumber;
                return (
                  <button
                    key={index}
                    onClick={() => setViewingAnswerIndex(index)}
                    title={`Вопрос ${index + 1}: ${isCorrect ? 'верно' : 'ошибка'}`}
                    aria-label={`Вопрос ${index + 1}: ${isCorrect ? 'верно' : 'ошибка'}`}
                    className={`result-button p-2.5 rounded-lg font-bold text-center transition-all hover:shadow-md animate-slideIn ${
                      isCorrect
                        ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 border-2 border-emerald-200'
                        : 'bg-gradient-to-br from-rose-50 to-rose-100 text-rose-700 border-2 border-rose-200'
                    }`}
                    style={{
                      animationDelay: `${(index * 30)}ms`
                    }}
                  >
                    <div className="text-lg font-bold">{index + 1}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-16 pb-24">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
            Назад в меню
          </button>
          <div className="flex items-center gap-2 text-2xl font-bold text-[#0066ff]">
            <Clock className="w-6 h-6" />
            {formatTime(timeRemaining)}
          </div>
        </div>

        {/* Question Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-600">
              Вопрос {currentQuestionIndex + 1} из {questions.length}
            </span>
            <div className="w-full h-2 bg-gray-200 rounded-full ml-4 flex-1">
              <div
                className="h-full bg-[#0066ff] rounded-full transition-all"
                style={{
                  width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">{question.questionText}</h2>

          {currentImageUrl ? (
            <img
              key={`exam-${currentQuestionIndex}-${currentImageUrl}`}
              src={currentImageUrl}
              alt="Question illustration"
              className="w-full max-h-64 object-cover rounded-lg mb-8 transition-opacity duration-300"
              loading="lazy"
              decoding="async"
              onLoad={(e) => e.currentTarget.style.opacity = '1'}
              style={{ opacity: '0' }}
            />
          ) : null}

          {/* Answers */}
          <div className="space-y-4">
            {question.answers.map((answer) => (
              <button
                key={answer.number}
                onClick={() => handleAnswerSelect(answer.number)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedAnswers[currentQuestionIndex] === answer.number
                    ? 'border-[#0066ff] bg-[#f0f7ff]'
                    : 'border-gray-200 hover:border-[#0066ff]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                      selectedAnswers[currentQuestionIndex] === answer.number
                        ? 'border-[#0066ff] bg-[#0066ff]'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedAnswers[currentQuestionIndex] === answer.number && (
                      <span className="text-white font-bold">✓</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{answer.text}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-4 justify-between">
          <button
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300 disabled:opacity-50"
          >
            Предыдущий
          </button>

          <button
            onClick={handleNextQuestion}
            className="px-6 py-3 bg-[#0066ff] text-white rounded-lg font-bold hover:bg-blue-700"
          >
            {currentQuestionIndex === questions.length - 1 ? 'Завершить' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
};
