import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowForward, IoCarSportOutline, IoPeopleOutline } from "react-icons/io5";
import logoWhite from "../assets/лого_4.jpg";

function ChoiceCard({
  icon,
  title,
  description,
  actionLabel,
  onClick,
  tone,
  chips = [],
  accent = "from-white/25 via-white/10 to-white/25",
}) {
  const tones = {
    dark: "bg-neutral-950/95 text-white border-neutral-800",
    light: "bg-white/90 text-neutral-950 border-neutral-200",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative w-full overflow-hidden rounded-[20px] sm:rounded-[30px] border p-4 sm:p-6 text-center",
        "transition-[transform,box-shadow] duration-300 hover:-translate-y-1",
        "shadow-[0_20px_70px_rgba(0,0,0,0.10)] hover:shadow-[0_30px_90px_rgba(0,0,0,0.16)]",
        tones[tone],
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className={`absolute -inset-[2px] rounded-[32px] bg-gradient-to-r ${accent} blur-[12px]`} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.20),_transparent_60%)]" />
          <div className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
      </div>

      <div className={["pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"].join(" ")}>
        <div className={`absolute -inset-[2px] rounded-[32px] bg-gradient-to-r ${accent} blur-[10px]`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_58%)]" />
      </div>

      <div className="relative">
        <div
          className={[
            "mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl sm:mb-8 sm:h-16 sm:w-16 sm:rounded-2xl",
            "transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.03]",
            tone === "dark" ? "bg-white/10" : "bg-black/10",
          ].join(" ")}
        >
          {icon}
        </div>
        <h2 className="text-lg sm:text-2xl font-semibold">{title}</h2>
        <p className={`mx-auto mt-3 max-w-md text-sm leading-relaxed hidden sm:block ${tone === "dark" ? "text-neutral-300" : "text-neutral-600"}`}>
          {description}
        </p>

        {chips.length ? (
          <div className="mt-4 hidden sm:flex flex-wrap items-center justify-center gap-2">
            {chips.slice(0, 6).map((chip) => (
              <span
                key={chip}
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold",
                  "backdrop-blur",
                  tone === "dark"
                    ? "bg-white/10 text-white/90 border border-white/10"
                    : "bg-black/5 text-neutral-800 border border-black/10",
                ].join(" ")}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 sm:mt-8 flex items-center justify-center">
          <div
            className={[
              "inline-flex items-center justify-center gap-1 sm:gap-2 rounded-full px-3 py-2 sm:px-5 sm:py-3 text-xs sm:text-base font-semibold",
              "transition-[transform,background-color] duration-300 group-hover:scale-[1.02]",
              tone === "dark" ? "bg-white text-black" : "bg-neutral-950 text-white",
            ].join(" ")}
          >
            <span>{actionLabel}</span>
            <IoArrowForward className="h-3 w-3 sm:h-5 sm:w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function AppChoice() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#f7f7f7,_#e6e6e6_45%,_#d6d6d6_100%)] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <style>{`
        @keyframes avtFloat {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(0, -14px, 0) scale(1.02); }
        }
        .avt-float { animation: avtFloat 10s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .avt-float { animation: none; } }
      `}</style>

      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[120px] left-[8%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,_rgba(0,0,0,0.12),_transparent_60%)] blur-2xl avt-float" />
        <div className="absolute -bottom-[140px] right-[6%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,_rgba(0,0,0,0.10),_transparent_60%)] blur-2xl avt-float" style={{ animationDelay: "1.6s" }} />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,rgba(0,0,0,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.18)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(rgba(0,0,0,0.18)_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center">
        <div className="mb-10">
          <div className="mx-auto mb-6 flex w-fit items-center justify-center">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 -m-6 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.18),transparent_60%)] blur-2xl" />
              <img src={logoWhite} alt="Avtotime" className="relative h-32 w-auto object-contain" />
            </div>
          </div>
          <h1 className="mx-auto text-center text-[clamp(1.2rem,3.5vw,3.1rem)] font-semibold leading-[1.1] tracking-tight text-neutral-950">
            <span className="bg-[linear-gradient(90deg,#111827,#111827,rgba(17,24,39,0.72))] bg-clip-text text-transparent">
              Выберите, куда перейти дальше
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[14px] leading-relaxed text-neutral-600">
            Можно переключаться между разделами в любой момент — выберите, с чего начать сейчас.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <ChoiceCard
            icon={<IoPeopleOutline className="h-6 w-6 sm:h-8 sm:w-8" />}
            title="Соцсеть"
            description="Лента и сторис, сообщения, друзья и профиль."
            actionLabel="Перейти"
            onClick={() => navigate("/")}
            tone="dark"
            accent="from-fuchsia-500/35 via-violet-500/25 to-sky-500/25"
            chips={["Лента", "Сторис", "Сообщения", "Поиск", "Загрузка медиа"]}
          />

          <ChoiceCard
            icon={<IoCarSportOutline className="h-6 w-6 sm:h-8 sm:w-8" />}
            title="Автомаркет"
            description="Объявления, услуги, подбор и сравнение."
            actionLabel="Открыть"
            onClick={() => navigate("/market")}
            tone="light"
            accent="from-emerald-500/25 via-sky-500/20 to-amber-500/20"
            chips={["Объявления", "Сервисы", "Подбор", "Сравнение", "Тарифы"]}
          />
        </div>
      </div>
    </div>
  );
}
