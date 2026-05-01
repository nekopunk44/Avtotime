import React, { useState } from "react";
import {
  IoArrowBack,
  IoArrowForward,
  IoBookOutline,
  IoFlashOutline,
  IoSchoolOutline,
  IoStatsChartOutline,
  IoTimerOutline,
} from "react-icons/io5";
import ExamMode from "../components/DrivingCourses/ExamMode";
import PracticeMode from "../components/DrivingCourses/PracticeMode";
import MarathonMode from "../components/DrivingCourses/MarathonMode";
import ResultsPage from "../components/DrivingCourses/ResultsPage";
import StatisticsPage from "../components/DrivingCourses/StatisticsPage";

const TICKET_COUNT = 40;
const TICKETS = Array.from({ length: TICKET_COUNT }, (_, index) => index + 1);

function ModeCard({ icon, title, description, chips, cta, accent, onClick }) {
  const accents = {
    blue: {
      tint: "bg-blue-50 text-blue-700 ring-blue-100",
      glow: "from-blue-500/10 to-blue-600/0",
      focus: "focus-visible:ring-blue-500/50",
      cta: "from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600",
    },
    orange: {
      tint: "bg-orange-50 text-orange-700 ring-orange-100",
      glow: "from-orange-500/10 to-orange-600/0",
      focus: "focus-visible:ring-orange-500/50",
      cta: "from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600",
    },
    purple: {
      tint: "bg-purple-50 text-purple-700 ring-purple-100",
      glow: "from-purple-500/10 to-purple-600/0",
      focus: "focus-visible:ring-purple-500/50",
      cta: "from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600",
    },
  };

  const tone = accents[accent] ?? accents.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-3xl border border-white/60 bg-white/70 text-center shadow-sm backdrop-blur transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 ${tone.focus}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
      />

      <div className="relative flex h-full flex-col p-7 sm:p-8">
        <div className="mb-6">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl ring-1 ${tone.tint}`}>
            {icon}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tone.tint}`}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 sm:text-base">
          {description}
        </p>

        <span
          className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-5 py-3 text-sm font-semibold text-white shadow-sm transition-transform duration-200 group-hover:scale-[1.02] ${tone.cta}`}
        >
          {cta}
          <IoArrowForward className="h-5 w-5" />
        </span>
      </div>
    </button>
  );
}

function TicketButton({ ticket, accent, onClick }) {
  const accents = {
    blue: "border-blue-200/70 hover:border-blue-400 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-500/50",
    orange:
      "border-orange-200/70 hover:border-orange-400 hover:bg-orange-600 hover:text-white focus-visible:ring-orange-500/50",
  };

  const tone = accents[accent] ?? accents.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex aspect-[4/3] items-center justify-center rounded-2xl border bg-white/70 text-lg font-bold text-neutral-800 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${tone}`}
    >
      <span className="transition-transform duration-150 group-hover:scale-110">
        {ticket}
      </span>
    </button>
  );
}

const DrivingCoursesPage = () => {
  const [currentMode, setCurrentMode] = useState("menu");
  const [selectedTicket, setSelectedTicket] = useState(1);
  const [testResult, setTestResult] = useState(null);

  const handleExamStart = (ticket = 1) => {
    setSelectedTicket(ticket);
    setCurrentMode("exam");
  };

  const handlePracticeStart = (ticket = null) => {
    setSelectedTicket(ticket);
    setCurrentMode("practice");
  };

  const handleMarathonStart = () => {
    setCurrentMode("marathon");
  };

  const goToSelectExam = () => {
    setCurrentMode("selectExam");
  };

  const goToSelectPractice = () => {
    setCurrentMode("selectPractice");
  };

  const handleTestComplete = (result) => {
    setTestResult(result);
    setCurrentMode("results");
  };

  const handleReset = () => {
    setCurrentMode("menu");
    setTestResult(null);
  };

  // MENU
  if (currentMode === "menu") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#ffffff_55%,_#f5f5f5_100%)] p-6">
        <div className="max-w-6xl mx-auto">
          {/* Заголовок */}
          <div className="text-center mb-12">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-blue-700 shadow-sm ring-1 ring-white/60 backdrop-blur">
              {/* Иконка над текстом — сделана меньше */}
              <IoSchoolOutline className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
              Автокурсы
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              Подготовьтесь к экзамену по вождению с нашей базой вопросов. Выберите режим экзамена, тренировки или марафона.
            </p>

            {/* Быстрые ссылки */}
            <div className="mt-7 flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => setCurrentMode("statistics")}
                className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                <IoStatsChartOutline className="h-5 w-5 text-blue-700" />
                Моя статистика
              </button>
            </div>
          </div>

          {/* Основные режимы - упрощённое меню */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6 mb-12">
            <ModeCard
              accent="blue"
              icon={<IoTimerOutline className="h-8 w-8" />}
              title="Режим Экзамена"
              description="20 случайных вопросов с ограничением по времени и итоговым результатом."
              chips={["20 вопросов", "20 минут", "Проходной 70%"]}
              cta="Начать экзамен"
              onClick={goToSelectExam}
            />

            <ModeCard
              accent="orange"
              icon={<IoBookOutline className="h-8 w-8" />}
              title="Режим Тренировки"
              description="Учитесь в своем темпе с подробными объяснениями и мгновенной обратной связью."
              chips={["20 вопросов", "Без лимита", "Объяснения"]}
              cta="Начать тренировку"
              onClick={goToSelectPractice}
            />

            <ModeCard
              accent="purple"
              icon={<IoFlashOutline className="h-8 w-8" />}
              title="Марафон"
              description="Пройдите все вопросы подряд без ограничений — идеально для закрепления знаний."
              chips={["800 вопросов", "Без лимита", "Полный охват"]}
              cta="Начать марафон"
              onClick={handleMarathonStart}
            />
          </div>

          {/* Информационный блок */}
          <div className="rounded-3xl border border-white/60 bg-white/70 p-7 shadow-sm backdrop-blur sm:p-8">
            <h3 className="text-xl font-semibold text-neutral-900 sm:text-2xl">
              Как лучше проходить
            </h3>
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
              <div>
                <h4 className="font-semibold text-neutral-900 mb-2">
                  1. Начните с тренировки
                </h4>
                <p className="text-neutral-700">
                  Выберите билет и потренируйтесь, изучая объяснения к ответам
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 mb-2">
                  2. Пройдите экзамен
                </h4>
                <p className="text-neutral-700">
                  Проверьте знания в режиме экзамена с ограничением времени
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 mb-2">
                  3. Закрепите в марафоне
                </h4>
                <p className="text-neutral-700">
                  Марафон поможет закрепить знания на 800 вопросах
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SELECT EXAM TICKET
  if (currentMode === "selectExam") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#ffffff_55%,_#f5f5f5_100%)] p-6">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={handleReset}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <IoArrowBack className="h-5 w-5" />
            Вернуться в меню
          </button>

          <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-sm backdrop-blur">
            <div className="border-b border-white/60 bg-gradient-to-r from-blue-600/10 to-transparent p-7 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                    Выберите билет
                  </h1>
                  <p className="mt-1 text-sm text-neutral-600 sm:text-base">
                    Режим экзамена: 20 вопросов • 20 минут
                  </p>
                </div>
                <div className="inline-flex items-center justify-center rounded-2xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
                  Всего билетов: {TICKET_COUNT}
                </div>
              </div>
            </div>

            <div className="p-7 sm:p-8">
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4 md:grid-cols-8">
                {TICKETS.map((ticket) => (
                  <TicketButton
                    key={ticket}
                    ticket={ticket}
                    accent="blue"
                    onClick={() => handleExamStart(ticket)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-white/60 bg-blue-50/60 p-6 sm:p-7">
              <p className="text-sm leading-relaxed text-neutral-700">
                Выберите номер билета, чтобы начать экзамен. Вам будут заданы 20 случайных вопросов из выбранного билета.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SELECT PRACTICE TICKET
  if (currentMode === "selectPractice") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#ffffff_55%,_#f5f5f5_100%)] p-6">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={handleReset}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
          >
            <IoArrowBack className="h-5 w-5" />
            Вернуться в меню
          </button>

          <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-sm backdrop-blur">
            <div className="border-b border-white/60 bg-gradient-to-r from-orange-600/10 to-transparent p-7 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                    Выберите билет для тренировки
                  </h1>
                  <p className="mt-1 text-sm text-neutral-600 sm:text-base">
                    Режим тренировки: без ограничения по времени
                  </p>
                </div>
                <div className="inline-flex items-center justify-center rounded-2xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 ring-1 ring-orange-100">
                  Билетов: {TICKET_COUNT}
                </div>
              </div>
            </div>

            <div className="p-7 sm:p-8">
              <button
                type="button"
                onClick={() => handlePracticeStart(null)}
                className="group mb-7 inline-flex w-full items-center justify-between gap-4 rounded-3xl border border-white/60 bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 text-left text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <div>
                  <div className="text-lg font-semibold sm:text-xl">
                    Все билеты
                  </div>
                  <div className="mt-1 text-sm text-white/90">
                    Тренируйтесь по всем вопросам без лимита времени
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <IoArrowForward className="h-6 w-6" />
                </div>
              </button>

              <div className="mb-4 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-neutral-800 sm:text-base">
                  Или выберите конкретный билет
                </p>
                <span className="text-xs font-semibold text-neutral-500">
                  1–{TICKET_COUNT}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4 md:grid-cols-8">
                {TICKETS.map((ticket) => (
                  <TicketButton
                    key={ticket}
                    ticket={ticket}
                    accent="orange"
                    onClick={() => handlePracticeStart(ticket)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-white/60 bg-orange-50/60 p-6 sm:p-7">
              <p className="text-sm leading-relaxed text-neutral-700">
                Выберите «Все билеты» или конкретный номер билета для тренировки. Здесь можно отвечать без спешки и изучать объяснения.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EXAM MODE
  if (currentMode === "exam") {
    return (
      <ExamMode ticketNumber={selectedTicket} onComplete={handleTestComplete} />
    );
  }

  // PRACTICE MODE
  if (currentMode === "practice") {
    return (
      <PracticeMode
        ticketNumber={selectedTicket}
        onComplete={handleTestComplete}
      />
    );
  }

  // MARATHON MODE
  if (currentMode === "marathon") {
    return <MarathonMode onComplete={handleTestComplete} />;
  }

  // RESULTS PAGE
  if (currentMode === "results") {
    return <ResultsPage result={testResult} onReset={handleReset} />;
  }

  // STATISTICS PAGE
  if (currentMode === "statistics") {
    return (
      <div>
        <button
          onClick={handleReset}
          className="fixed top-6 left-6 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 z-50"
        >
          ← Вернуться в меню
        </button>
        <StatisticsPage />
      </div>
    );
  }

  return null;
};

export default DrivingCoursesPage;
