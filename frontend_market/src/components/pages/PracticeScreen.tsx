import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
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

interface PracticeScreenProps {
  selectedTicket: number | null;
  onReset: () => void;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({ selectedTicket, onReset }) => {
  const [questions, setQuestions] = useState<DrivingQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        let url = `${API_URL}/driving-courses/questions-with-answers`;
        
        if (selectedTicket) {
          url += `?ticketNumber=${selectedTicket}&limit=20`;
        } else {
          url += '?limit=100';
        }

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

        setQuestions(data as DrivingQuestion[]);
        if (data.length === 0) {
          setError('Нет вопросов');
        }
      } catch (err) {
        setError('Ошибка при загрузке вопросов');
        console.error('Error fetching questions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [selectedTicket]);

  const handleAnswerSelect = (answerNumber: number) => {
    setSelectedAnswer(answerNumber);
    const question = questions[currentQuestionIndex];
    setAnsweredCorrectly(answerNumber === question.correctAnswerNumber);
    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setAnsweredCorrectly(null);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setAnsweredCorrectly(null);
    }
  };

  const question = questions[currentQuestionIndex];
  const currentImageUrl = useDrivingQuestionImage(question);

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
          <p className="text-gray-600 mb-8">{error || 'Нет вопросов'}</p>
          <button onClick={onReset} className="px-6 py-3 bg-[#e85d04] text-white rounded-lg font-bold hover:bg-[#dc2f02]">
            Вернуться в меню
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-white pt-16 pb-24">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onReset} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-6 h-6" />
            Назад в меню
          </button>
          <div className="text-gray-600">
            Вопрос {currentQuestionIndex + 1} из {questions.length}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="w-full h-2 bg-gray-200 rounded-full">
            <div
              className="h-full bg-[#e85d04] rounded-full transition-all"
              style={{
                width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`
              }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">{question.questionText}</h2>

          {currentImageUrl ? (
            <img
              key={`practice-${currentQuestionIndex}-${currentImageUrl}`}
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
          <div className="space-y-4 mb-8">
            {question.answers.map((answer) => {
              const isSelected = selectedAnswer === answer.number;
              const isCorrect = answer.number === question.correctAnswerNumber;
              const isWrong = isSelected && !isCorrect;

              return (
                <button
                  key={answer.number}
                  onClick={() => handleAnswerSelect(answer.number)}
                  disabled={showExplanation}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    isWrong
                      ? 'border-red-500 bg-red-50'
                      : isSelected && isCorrect
                      ? 'border-green-500 bg-green-50'
                      : showExplanation && isCorrect
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-[#e85d04]'
                  } ${showExplanation ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                        isWrong
                          ? 'border-red-500 bg-red-500'
                          : isSelected && isCorrect
                          ? 'border-green-500 bg-green-500'
                          : showExplanation && isCorrect
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {(isSelected || (showExplanation && isCorrect)) && <span className="text-white font-bold">✓</span>}
                      {isWrong && <span className="text-white font-bold">✕</span>}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{answer.text}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExplanation && (
            <div className={`p-6 rounded-lg ${answeredCorrectly ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-start gap-3">
                <BookOpen className={`w-6 h-6 flex-shrink-0 mt-1 ${answeredCorrectly ? 'text-green-600' : 'text-blue-600'}`} />
                <div>
                  <h3 className={`font-bold mb-2 ${answeredCorrectly ? 'text-green-900' : 'text-blue-900'}`}>
                    {answeredCorrectly ? 'Правильно!' : 'Неправильно'}
                  </h3>
                  <p className={answeredCorrectly ? 'text-green-800' : 'text-blue-800'}>{question.explanation}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        {showExplanation && (
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
              disabled={currentQuestionIndex === questions.length - 1}
              className="px-6 py-3 bg-[#e85d04] text-white rounded-lg font-bold hover:bg-[#dc2f02] disabled:opacity-50"
            >
              Далее
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
