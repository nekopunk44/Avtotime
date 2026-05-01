import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  Clock,
  Flag,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useDrivingQuestionImage } from '../../hooks/useDrivingQuestionImage';
import { API_URL } from '../../utils/config';

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

interface MarathonScreenProps {
  onReset: () => void;
}

type ResultsFilter = 'wrong' | 'unanswered' | 'all';

const MARATHON_TOTAL = 800;

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const MarathonScreen: React.FC<MarathonScreenProps> = ({ onReset }) => {
  const [questions, setQuestions] = useState<DrivingQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [viewingAnswerIndex, setViewingAnswerIndex] = useState<number | null>(null);
  const [resultsFilter, setResultsFilter] = useState<ResultsFilter>('wrong');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const startedAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = `${API_URL}/driving-courses/questions-with-answers?limit=1000`;
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

        if (!Array.isArray(data)) {
          setError('Ошибка: неверный формат ответа');
          return;
        }

        const sorted = (data as DrivingQuestion[])
          .slice()
          .sort(
            (a, b) =>
              (a.ticketNumber ?? 0) - (b.ticketNumber ?? 0) ||
              (a.questionNumber ?? 0) - (b.questionNumber ?? 0),
          )
          .slice(0, MARATHON_TOTAL);

        setQuestions(sorted);
        if (sorted.length === 0) {
          setError('Нет вопросов для марафона');
          return;
        }

        startedAtMsRef.current = Date.now();
        setElapsedSeconds(0);
      } catch (err) {
        setError('Ошибка при загрузке вопросов');
        console.error('Error fetching marathon questions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!startedAtMsRef.current) return;
    if (showResults) return;

    const id = window.setInterval(() => {
      const startedAtMs = startedAtMsRef.current;
      if (!startedAtMs) return;
      const seconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      setElapsedSeconds(seconds);
    }, 1000);

    return () => window.clearInterval(id);
  }, [loading, showResults]);

  const total = questions.length || MARATHON_TOTAL;
  const question = questions[currentQuestionIndex];
  const reviewQuestion = viewingAnswerIndex !== null ? questions[viewingAnswerIndex] : undefined;
  const currentImageUrl = useDrivingQuestionImage(question);
  const reviewImageUrl = useDrivingQuestionImage(reviewQuestion);

  const correctCount = useMemo(() => {
    if (!questions.length) return 0;
    return Object.entries(selectedAnswers).filter(([index, answer]) => {
      const i = Number(index);
      return Number.isFinite(i) && answer === questions[i]?.correctAnswerNumber;
    }).length;
  }, [questions, selectedAnswers]);

  const answeredCount = useMemo(() => Object.keys(selectedAnswers).length, [selectedAnswers]);
  const wrongCount = Math.max(0, answeredCount - correctCount);
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  const isAnswered = (index: number) => selectedAnswers[index] !== undefined;
  const isCorrectAt = (index: number) =>
    isAnswered(index) && selectedAnswers[index] === questions[index]?.correctAnswerNumber;

  const filteredIndices = useMemo(() => {
    if (!questions.length) return [];
    if (resultsFilter === 'all') return questions.map((_, i) => i);
    if (resultsFilter === 'unanswered') {
      return questions.map((_, i) => i).filter((i) => !isAnswered(i));
    }
    return questions.map((_, i) => i).filter((i) => isAnswered(i) && !isCorrectAt(i));
  }, [questions, resultsFilter, selectedAnswers]);

  const progress = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round(((currentQuestionIndex + 1) / questions.length) * 100);
  }, [questions.length, currentQuestionIndex]);

  const handleAnswerSelect = (answerNumber: number) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: answerNumber }));
    setShowExplanation(true);
  };

  const goToIndex = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), Math.max(0, questions.length - 1));
    setCurrentQuestionIndex(clamped);
    setShowExplanation(isAnswered(clamped));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      goToIndex(currentQuestionIndex + 1);
    } else {
      setShowResults(true);
      setViewingAnswerIndex(null);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      goToIndex(currentQuestionIndex - 1);
    }
  };

  const handleSkip = () => {
    setShowExplanation(false);
    handleNext();
  };

  const handleFinish = () => {
    setShowResults(true);
    setViewingAnswerIndex(null);
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowExplanation(false);
    setShowResults(false);
    setViewingAnswerIndex(null);
    setResultsFilter('wrong');
    startedAtMsRef.current = Date.now();
    setElapsedSeconds(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-16 pb-24 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900">Загрузка марафона...</h2>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-white pt-16 pb-24 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Ошибка</h2>
          <p className="text-gray-600 mb-8">{error || 'Нет вопросов'}</p>
          <button
            onClick={onReset}
            className="px-6 py-3 bg-[#9333ea] text-white rounded-xl font-bold hover:bg-[#7e22ce]"
          >
            Вернуться в меню
          </button>
        </div>
      </div>
    );
  }

  if (showResults) {
    const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    const ringColor = score >= 70 ? '#10b981' : '#9333ea';

    if (viewingAnswerIndex !== null) {
      const reviewQuestion = questions[viewingAnswerIndex];
      const userAnswer = selectedAnswers[viewingAnswerIndex];
      const isCorrect = userAnswer === reviewQuestion.correctAnswerNumber;

      return (
        <div className="min-h-screen bg-gradient-to-br from-white via-white to-purple-50/60 pt-10 pb-24">
          <div className="max-w-4xl mx-auto px-4">
            <button
              onClick={() => setViewingAnswerIndex(null)}
              className="mb-8 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
              Назад к результатам
            </button>

            <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="text-gray-600">
                  Вопрос {viewingAnswerIndex + 1} из {questions.length} • Билет {reviewQuestion.ticketNumber}
                </div>
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                    isCorrect ? 'bg-emerald-100' : isAnswered(viewingAnswerIndex) ? 'bg-rose-100' : 'bg-gray-100'
                  }`}
                >
                  {isCorrect ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Верно</span>
                    </>
                  ) : isAnswered(viewingAnswerIndex) ? (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span className="text-rose-700 font-semibold">Ошибка</span>
                    </>
                  ) : (
                    <>
                      <Flag className="w-5 h-5 text-gray-600" />
                      <span className="text-gray-700 font-semibold">Пропущен</span>
                    </>
                  )}
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-6">{reviewQuestion.questionText}</h2>

              {reviewImageUrl ? (
                <img
                  src={reviewImageUrl}
                  alt={`Вопрос ${reviewQuestion.questionNumber}`}
                  className="w-full max-h-72 object-contain rounded-2xl mb-8 bg-slate-50 border border-gray-100"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}

              <div className="space-y-3 mb-8">
                {reviewQuestion.answers.map((answer) => {
                  const isUserAnswer = userAnswer === answer.number;
                  const isCorrectAnswer = answer.number === reviewQuestion.correctAnswerNumber;

                  let buttonClass = 'bg-white border-2 border-gray-200';
                  if (isCorrectAnswer) buttonClass = 'bg-emerald-50 border-2 border-emerald-300 shadow-sm';
                  else if (isUserAnswer && !isCorrect) buttonClass = 'bg-rose-50 border-2 border-rose-300 shadow-sm';

                  return (
                    <div key={answer.number} className={`p-4 rounded-2xl ${buttonClass}`}>
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                            isCorrectAnswer
                              ? 'bg-emerald-500 text-white'
                              : isUserAnswer
                                ? 'bg-rose-500 text-white'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {answer.number}
                        </div>
                        <div className="text-gray-900 font-medium">{answer.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-6 py-5">
                <div className="font-bold text-gray-900 mb-2">Объяснение</div>
                <div className="text-gray-700 leading-relaxed">
                  {reviewQuestion.explanation || '—'}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 justify-between">
                <button
                  onClick={() => setViewingAnswerIndex((prev) => (prev && prev > 0 ? prev - 1 : prev))}
                  disabled={viewingAnswerIndex === 0}
                  className="px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50"
                >
                  Предыдущий
                </button>
                <button
                  onClick={() =>
                    setViewingAnswerIndex((prev) =>
                      prev !== null && prev < questions.length - 1 ? prev + 1 : prev,
                    )
                  }
                  disabled={viewingAnswerIndex === questions.length - 1}
                  className="px-5 py-3 rounded-xl bg-[#9333ea] text-white font-bold hover:bg-[#7e22ce] disabled:opacity-50"
                >
                  Следующий
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-white to-purple-50/60 pt-10 pb-24">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-3xl p-12 shadow-lg border border-gray-100 mb-8 text-center relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
              style={{ background: 'rgba(147,51,234,0.14)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full blur-3xl"
              style={{ background: 'rgba(16,185,129,0.10)' }}
            />

            <div className="relative mx-auto mb-6 h-28 w-28">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(${ringColor} 0% ${score}%, #e5e7eb ${score}% 100%)`,
                }}
              />
              <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Trophy className="w-10 h-10 text-[#9333ea]" />
              </div>
            </div>

            <h1 className="text-4xl font-serif font-bold text-gray-900 mb-3">
              Результаты марафона
            </h1>
            <p className="text-gray-600 mb-6">
              Время: <span className="font-semibold text-gray-900">{formatDuration(elapsedSeconds)}</span>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto mb-10">
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left">
                <div className="text-sm text-gray-500">Правильно</div>
                <div className="text-2xl font-bold text-emerald-600">{correctCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left">
                <div className="text-sm text-gray-500">Ошибок</div>
                <div className="text-2xl font-bold text-rose-600">{wrongCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left">
                <div className="text-sm text-gray-500">Пропущено</div>
                <div className="text-2xl font-bold text-gray-900">{unansweredCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left">
                <div className="text-sm text-gray-500">Всего</div>
                <div className="text-2xl font-bold text-gray-900">{questions.length}</div>
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => {
                  setResultsFilter('wrong');
                  setViewingAnswerIndex(filteredIndices[0] ?? 0);
                }}
                className="result-button px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Посмотреть ошибки
              </button>
              <button
                onClick={onReset}
                className="result-button px-6 py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Вернуться в меню
              </button>
              <button
                onClick={handleRestart}
                className="result-button px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Начать заново
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-10 shadow-lg border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Разбор</h2>
                <p className="text-gray-600 mt-1">
                  Выберите фильтр и нажмите на номер вопроса.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['wrong', 'unanswered', 'all'] as ResultsFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setResultsFilter(filter)}
                    className={`px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${
                      resultsFilter === filter
                        ? 'bg-[#9333ea] text-white border-transparent'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {filter === 'wrong' ? 'Ошибки' : filter === 'unanswered' ? 'Пропущенные' : 'Все'}
                  </button>
                ))}
              </div>
            </div>

            {filteredIndices.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-slate-50 px-6 py-6 text-gray-700">
                Нечего показывать по выбранному фильтру.
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-2">
                {filteredIndices.slice(0, 240).map((index) => {
                  const correct = isCorrectAt(index);
                  const answered = isAnswered(index);
                  return (
                    <button
                      key={index}
                      onClick={() => setViewingAnswerIndex(index)}
                      className={`result-button px-2 py-2 rounded-xl font-bold border transition-all hover:shadow-sm ${
                        !answered
                          ? 'bg-gray-50 text-gray-700 border-gray-200'
                          : correct
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                      title={`Вопрос ${index + 1}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredIndices.length > 240 ? (
              <div className="mt-4 text-sm text-gray-500">
                Показаны первые 240 вопросов в этом фильтре (для скорости).
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const currentSelectedAnswer = selectedAnswers[currentQuestionIndex];
  const currentIsCorrect =
    currentSelectedAnswer !== undefined && currentSelectedAnswer === question.correctAnswerNumber;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-purple-50/60 pt-10 pb-24">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
            Назад в меню
          </button>

          <div className="flex items-center gap-3 text-gray-600">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/80 border border-gray-100 px-4 py-2 shadow-sm">
              <Clock className="w-4 h-4" />
              <span className="font-semibold">{formatDuration(elapsedSeconds)}</span>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/80 border border-gray-100 px-4 py-2 shadow-sm hover:bg-white"
              title="Завершить и перейти к результатам"
            >
              <Flag className="w-4 h-4" />
              <span className="font-semibold">Завершить</span>
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="text-gray-700">
              Вопрос <span className="font-bold">{currentQuestionIndex + 1}</span> из{' '}
              <span className="font-bold">{questions.length}</span>
            </div>
            <div className="text-sm text-gray-600">
              Правильно: <span className="font-semibold text-emerald-600">{correctCount}</span> • Ошибок:{' '}
              <span className="font-semibold text-rose-600">{wrongCount}</span> • Пропущено:{' '}
              <span className="font-semibold">{unansweredCount}</span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#9333ea] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="text-sm text-gray-600">
              Билет <span className="font-semibold text-gray-900">№{question.ticketNumber}</span> • Вопрос{' '}
              <span className="font-semibold text-gray-900">№{question.questionNumber}</span>
            </div>
            {isAnswered(currentQuestionIndex) ? (
              <div
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 ${
                  currentIsCorrect ? 'bg-emerald-100' : 'bg-rose-100'
                }`}
              >
                {currentIsCorrect ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-700">Верно</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span className="font-semibold text-rose-700">Ошибка</span>
                  </>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-gray-100">
                <Flag className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-700">Не отвечен</span>
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-6">{question.questionText}</h2>

          {currentImageUrl ? (
            <img
              key={`marathon-${currentQuestionIndex}-${currentImageUrl}`}
              src={currentImageUrl}
              alt={`Вопрос ${question.questionNumber}`}
              className="w-full max-h-72 object-contain rounded-2xl mb-8 bg-slate-50 border border-gray-100"
              loading="lazy"
              decoding="async"
            />
          ) : null}

          <div className="space-y-3">
            {question.answers.map((answer) => {
              const isSelected = currentSelectedAnswer === answer.number;
              const isCorrect = answer.number === question.correctAnswerNumber;
              const reveal = showExplanation || isAnswered(currentQuestionIndex);

              let buttonClass = 'border-gray-200 hover:border-[#9333ea] hover:bg-purple-50/50';
              if (reveal && isCorrect) buttonClass = 'border-emerald-300 bg-emerald-50';
              else if (reveal && isSelected && !isCorrect) buttonClass = 'border-rose-300 bg-rose-50';
              else if (isSelected) buttonClass = 'border-[#9333ea] bg-purple-50';

              return (
                <button
                  key={answer.number}
                  type="button"
                  onClick={() => handleAnswerSelect(answer.number)}
                  disabled={reveal}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${buttonClass} ${
                    reveal ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 font-bold ${
                        isSelected ? 'border-[#9333ea] bg-[#9333ea] text-white' : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      {answer.number}
                    </div>
                    <div className="font-semibold text-gray-900">{answer.text}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {(showExplanation || isAnswered(currentQuestionIndex)) && (
            <div className="mt-8 rounded-2xl border border-gray-100 bg-slate-50 px-6 py-5">
              <div className="font-bold text-gray-900 mb-2">Объяснение</div>
              <div className="text-gray-700 leading-relaxed">{question.explanation || '—'}</div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handlePrev}
              disabled={currentQuestionIndex === 0}
              className="px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50"
            >
              Предыдущий
            </button>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSkip}
                className="px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50"
              >
                Пропустить
              </button>
              <button
                onClick={handleNext}
                className="px-5 py-3 rounded-xl bg-[#9333ea] text-white font-bold hover:bg-[#7e22ce]"
              >
                {currentQuestionIndex === questions.length - 1 ? 'Завершить' : 'Следующий'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
