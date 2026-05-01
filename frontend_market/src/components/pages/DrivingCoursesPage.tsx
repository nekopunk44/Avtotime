import React, { useEffect, useMemo, useState } from 'react';
import { Target, BookOpen, Zap, GraduationCap, Play, Clock, ChevronLeft } from 'lucide-react';
import { ExamScreen } from './ExamScreen';
import { PracticeScreen } from './PracticeScreen';
import { MarathonScreen } from './MarathonScreen';
import { API_URL } from '../../utils/config';

type PageMode = 'menu' | 'selectExam' | 'selectPractice' | 'exam' | 'practice' | 'marathon';

const FALLBACK_TICKETS = [1, ...Array.from({ length: 15 }, (_, index) => index + 6)];

type Accent = 'blue' | 'orange' | 'purple';

const ACCENTS: Record<
  Accent,
  {
    tint: string;
    tintText: string;
    glow: string;
    button: string;
    ticket: string;
    ticketHover: string;
    ring: string;
  }
> = {
  blue: {
    tint: 'bg-[#eef2ff]',
    tintText: 'text-[#2563eb]',
    glow: 'from-blue-500/10 via-transparent to-transparent',
    button: 'bg-[#0066ff] hover:bg-blue-700',
    ticket: 'border-blue-200 text-blue-700',
    ticketHover: 'hover:bg-[#0066ff] hover:text-white hover:border-transparent',
    ring: 'focus-visible:ring-blue-500/50',
  },
  orange: {
    tint: 'bg-[#fff3e0]',
    tintText: 'text-[#e85d04]',
    glow: 'from-orange-500/10 via-transparent to-transparent',
    button: 'bg-[#e85d04] hover:bg-[#dc2f02]',
    ticket: 'border-orange-200 text-orange-700',
    ticketHover: 'hover:bg-[#e85d04] hover:text-white hover:border-transparent',
    ring: 'focus-visible:ring-orange-500/50',
  },
  purple: {
    tint: 'bg-[#f3e8ff]',
    tintText: 'text-[#9333ea]',
    glow: 'from-purple-500/10 via-transparent to-transparent',
    button: 'bg-[#9333ea] hover:bg-[#7e22ce]',
    ticket: 'border-purple-200 text-purple-700',
    ticketHover: 'hover:bg-[#9333ea] hover:text-white hover:border-transparent',
    ring: 'focus-visible:ring-purple-500/50',
  },
};

const ModeCard: React.FC<{
  accent: Accent;
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  meta: Array<{ icon: React.ReactNode; label: React.ReactNode }>;
  actionLabel: React.ReactNode;
  onClick: () => void;
}> = ({ accent, icon, title, description, meta, actionLabel, onClick }) => {
  const tone = ACCENTS[accent];

  return (
    <div className="group relative overflow-hidden rounded-[32px] border border-gray-100 bg-white p-8 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
      />

      <div className="relative flex h-full flex-col">
        <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl ${tone.tint}`}>
          {icon}
        </div>

        <h2 className="text-2xl font-serif font-bold text-gray-900 mb-3">{title}</h2>
        <p className="text-gray-600 mb-8 leading-relaxed flex-grow">{description}</p>

        <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-8">
          {meta.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClick}
          className={`w-full py-3.5 text-white rounded-2xl font-bold transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 ${tone.button} ${tone.ring}`}
        >
          <Play className="w-5 h-5" fill="currentColor" />
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

const TicketButton: React.FC<{
  accent: Exclude<Accent, 'purple'>;
  ticket: number;
  onClick: () => void;
}> = ({ accent, ticket, onClick }) => {
  const tone = ACCENTS[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group py-4 px-3 rounded-2xl border bg-white font-bold text-lg shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${tone.ticket} ${tone.ticketHover} ${tone.ring}`}
    >
      <span className="transition-transform duration-150 group-hover:scale-110">
        {ticket}
      </span>
    </button>
  );
};

export const DrivingCoursesPage: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<PageMode>('menu');
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [availableTickets, setAvailableTickets] = useState<number[]>(FALLBACK_TICKETS);

  useEffect(() => {
    let isCancelled = false;

    const loadTickets = async () => {
      try {
        const response = await fetch(`${API_URL}/driving-courses/tickets`, {
          credentials: 'include',
        });
        if (!response.ok) return;

        const data = await response.json();
        if (!Array.isArray(data) || isCancelled) return;

        const tickets = data
          .filter((ticket) => Number(ticket?.totalQuestions) > 0)
          .map((ticket) => Number(ticket.number))
          .filter((ticket, index, list) => Number.isFinite(ticket) && list.indexOf(ticket) === index)
          .sort((a, b) => a - b);

        if (tickets.length > 0) {
          setAvailableTickets(tickets);
        }
      } catch {
        // Keep fallback tickets when API list is unavailable.
      }
    };

    void loadTickets();

    return () => {
      isCancelled = true;
    };
  }, []);

  const ticketCount = availableTickets.length;
  const defaultTicket = useMemo(() => availableTickets[0] ?? 1, [availableTickets]);

  const handleExamStart = (ticket: number) => {
    setSelectedTicket(ticket);
    setCurrentMode('exam');
    console.log('Начинаем экзамен билет:', ticket);
  };

  const handlePracticeStart = (ticket: number | null) => {
    setSelectedTicket(ticket);
    setCurrentMode('practice');
    console.log('Начинаем тренировку билет:', ticket);
  };

  const handleMarathonStart = () => {
    setCurrentMode('marathon');
    console.log('Начинаем марафон');
  };

  const goToSelectExam = () => {
    setCurrentMode('selectExam');
  };

  const goToSelectPractice = () => {
    setCurrentMode('selectPractice');
  };

  const handleReset = () => {
    setCurrentMode('menu');
    setSelectedTicket(null);
  };

  // МЕНЮ
  if (currentMode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-white to-gray-50 pt-16 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-[#eef2ff] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm ring-1 ring-blue-100/60">
              <GraduationCap className="w-9 h-9 text-[#2563eb]" strokeWidth={2} />
            </div>
            <h1 className="text-4xl font-serif font-bold text-gray-900 mb-4">Автокурсы</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Подготовьтесь к экзамену по вождению с нашей обширной базой вопросов. Выберите режим экзамена, тренировки или марафона.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <ModeCard
              accent="blue"
              icon={<Target className="w-10 h-10 text-[#2563eb]" strokeWidth={2} />}
              title="Режим Экзамена"
              description="20 случайных вопросов с ограничением по времени. Узнайте результаты в конце."
              meta={[
                { icon: <BookOpen className="w-4 h-4" />, label: '20 вопросов' },
                { icon: <Clock className="w-4 h-4" />, label: '20 мин' },
              ]}
              actionLabel="Начать экзамен"
              onClick={goToSelectExam}
            />

            <ModeCard
              accent="orange"
              icon={<BookOpen className="w-10 h-10 text-[#e85d04]" strokeWidth={2} />}
              title="Режим Тренировки"
              description="Учитесь в своем темпе с мгновенной обратной связью и подробными объяснениями."
              meta={[
                { icon: <BookOpen className="w-4 h-4" />, label: '20 вопросов' },
                { icon: <Clock className="w-4 h-4" />, label: 'Без лимита' },
              ]}
              actionLabel="Начать тренировку"
              onClick={goToSelectPractice}
            />

            <ModeCard
              accent="purple"
              icon={<Zap className="w-10 h-10 text-[#9333ea]" strokeWidth={2} />}
              title="Марафон"
              description="Пройдите все 800 вопросов без ограничений по времени для полной подготовки."
              meta={[
                { icon: <BookOpen className="w-4 h-4" />, label: '800 вопросов' },
                { icon: <Clock className="w-4 h-4" />, label: 'Без лимита' },
              ]}
              actionLabel="Начать марафон"
              onClick={handleMarathonStart}
            />
          </div>
        </div>
      </div>
    );
  }

  // ВЫБОР БИЛЕТА ДЛЯ ЭКЗАМЕНА
  if (currentMode === 'selectExam') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-white to-blue-50/40 pt-4 pb-24">
        <div className="max-w-5xl mx-auto px-4 mb-10">
          <div className="relative flex w-full items-center justify-center py-6">
            <button
              type="button"
              onClick={handleReset}
              className="absolute -left-8 top-1/2 inline-flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full p-3 transition-colors hover:bg-gray-100"
            >
              <ChevronLeft className="h-14 w-14 text-gray-600 hover:text-gray-900" />
            </button>
            <h1 className="text-3xl font-bold text-center text-gray-900">
              Выберите билет
            </h1>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4">
          <div className="relative overflow-hidden bg-white rounded-[32px] p-8 sm:p-12 shadow-sm border border-gray-100">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent"
            />

            <div className="relative">
              <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-lg text-gray-600">
                  Каждый билет содержит 20 вопросов. Время экзамена: 20 минут
                </p>
                <div className="inline-flex items-center justify-center rounded-2xl bg-[#eef2ff] px-4 py-2 text-sm font-bold text-[#2563eb]">
                  {ticketCount} билетов
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4 md:grid-cols-8">
                {availableTickets.map((ticket) => (
                  <TicketButton
                    key={ticket}
                    ticket={ticket}
                    accent="blue"
                    onClick={() => handleExamStart(ticket)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ВЫБОР БИЛЕТА ДЛЯ ТРЕНИРОВКИ
  if (currentMode === 'selectPractice') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-white to-orange-50/40 pt-4 pb-24">
        <div className="max-w-5xl mx-auto px-4 mb-10">
          <div className="relative flex w-full items-center justify-center py-6">
            <button
              type="button"
              onClick={handleReset}
              className="absolute -left-8 top-1/2 inline-flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full p-3 transition-colors hover:bg-gray-100"
            >
              <ChevronLeft className="h-14 w-14 text-gray-600 hover:text-gray-900" />
            </button>
            <h1 className="text-3xl font-bold text-center text-gray-900">
              Выберите билет для тренировки
            </h1>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4">
          <div className="relative overflow-hidden bg-white rounded-[32px] p-8 sm:p-12 shadow-sm border border-gray-100">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent"
            />

            <div className="relative">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-lg text-gray-600">
                  Режим тренировки: без ограничения по времени
                </p>
                <div className="inline-flex items-center justify-center rounded-2xl bg-[#fff3e0] px-4 py-2 text-sm font-bold text-[#e85d04]">
                  {ticketCount} билетов
                </div>
              </div>

              <button
                type="button"
                onClick={() => handlePracticeStart(null)}
                className="group w-full mb-10 rounded-[28px] bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-5 text-left text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xl font-bold">Все билеты</div>
                    <div className="mt-1 text-sm text-white/90">
                      Тренируйтесь по всем вопросам без лимита времени
                    </div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                    <Play className="w-6 h-6" fill="currentColor" />
                  </div>
                </div>
              </button>

              <p className="text-gray-700 font-semibold text-lg mb-6">
                Или выберите конкретный билет:
              </p>

              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4 md:grid-cols-8">
                {availableTickets.map((ticket) => (
                  <TicketButton
                    key={ticket}
                    ticket={ticket}
                    accent="orange"
                    onClick={() => handlePracticeStart(ticket)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Заглушки для остальных режимов
  if (currentMode === 'exam') {
    return <ExamScreen selectedTicket={selectedTicket || defaultTicket} onReset={handleReset} />;
  }

  if (currentMode === 'practice') {
    return <PracticeScreen selectedTicket={selectedTicket} onReset={handleReset} />;
  }

  if (currentMode === 'marathon') {
    return <MarathonScreen onReset={handleReset} />;
  }

  return null;
};
