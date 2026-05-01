import React, { useState } from 'react';
import { Check, ChevronLeft, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { marketAPI } from '../../utils/marketAPI';

type PlanKey = 'free' | 'pro' | 'business';

interface TariffsPageProps {
  onBack: () => void;
  currentPlan?: string;
  onPlanChanged?: (plan: string, extras?: { effectivePlan?: string; planLimits?: any; planExpiresAt?: string | null }) => void;
  onSelectPaidPlan?: (plan: 'pro' | 'business') => void;
}

type PlanCard = {
  key: PlanKey;
  name: string;
  price: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  border: string;
  cta: string;
  dark: boolean;
  eyebrow: string;
  summary: string;
  features: string[];
};

const plans: PlanCard[] = [
  {
    key: 'free',
    name: 'Базовый',
    price: 'Бесплатно',
    icon: ShieldCheck,
    accent: 'from-white via-white to-red-50/60',
    border: 'border-red-200/80',
    cta: 'Выбрать базовый',
    dark: false,
    eyebrow: 'Для частных продаж',
    summary: 'Комфортный старт для личных объявлений без лишних затрат.',
    features: [
      'До 3 активных объявлений',
      'До 5 фото в объявлении',
      'Описание до 500 символов',
      'Срок объявления — 30 дней',
      'Телефон скрыт до запроса',
    ],
  },
  {
    key: 'pro',
    name: 'Pro Seller',
    price: '29 EUR / мес',
    icon: Sparkles,
    accent: 'from-[#fff6f4] via-white to-[#ffe9e5]',
    border: 'border-[#ffc8be]',
    cta: 'Подключить Pro',
    dark: false,
    eyebrow: 'Для активных продавцов',
    summary: 'Больше показов, статистика и заметное присутствие в каталоге.',
    features: [
      'До 20 активных объявлений',
      'До 20 фото в объявлении',
      'Описание до 2000 символов',
      'Срок объявления — 90 дней',
      'Приоритет в каталоге',
      'Статистика просмотров и заявок',
      'Бейдж Pro и видимый телефон',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    price: '79 EUR / мес',
    icon: Crown,
    accent: 'from-[#050505] via-[#101010] to-[#1a1a1a]',
    border: 'border-black',
    cta: 'Подключить Business',
    dark: true,
    eyebrow: 'Для автосалонов',
    summary: 'Максимум охвата, приоритет и поддержка для постоянных продаж.',
    features: [
      'Безлимитное число объявлений',
      'До 40 фото в объявлении',
      'Описание без ограничений',
      'Объявления не истекают',
      'Топ-приоритет в каталоге',
      'Бейдж Business и видимый телефон',
      'Приоритетная поддержка',
    ],
  },
];

export const TariffsPage: React.FC<TariffsPageProps> = ({ onBack, currentPlan = 'free', onPlanChanged, onSelectPaidPlan }) => {
  const stickyTopOffset = 'calc(var(--market-header-height, 120px) + 16px)';
  const [savingPlan, setSavingPlan] = useState<PlanKey | null>(null);
  const [planError, setPlanError] = useState('');

  const normalizePlan = (plan: string | undefined): PlanKey => {
    if (plan === 'pro' || plan === 'business' || plan === 'free') return plan;
    return 'free';
  };

  const [activePlan, setActivePlan] = useState<PlanKey>(() => normalizePlan(currentPlan));

  const handleSelectPlan = async (planKey: PlanKey) => {
    if (planKey === activePlan || savingPlan) return;
    setPlanError('');

    if (planKey === 'pro' || planKey === 'business') {
      onSelectPaidPlan?.(planKey);
      return;
    }

    setSavingPlan(planKey);
    try {
      const result = await marketAPI.setPlan(planKey);
      setActivePlan(planKey);
      onPlanChanged?.(planKey, {
        effectivePlan: result.effectivePlan,
        planLimits: result.planLimits,
        planExpiresAt: result.planExpiresAt,
      });
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'Ошибка смены тарифа');
    } finally {
      setSavingPlan(null);
    }
  };

  return (
    <section className="bg-[#f6f6f6] py-10 sm:py-14">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
          <button
            onClick={onBack}
            aria-label="Назад в авторынок"
            className="sticky z-40 inline-flex h-14 w-14 items-center justify-center self-start rounded-2xl border border-red-200 bg-white text-red-600 shadow-[0_14px_32px_rgba(225,29,72,0.18)] transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            style={{ top: stickyTopOffset }}
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.8]" />
          </button>

          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-600 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Тарифы
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">
              Выберите формат присутствия в AVTOTIME Market
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              Для личных продаж, активных продавцов и автосалонов. Тариф можно менять в любой момент.
            </p>
          </div>

          <div className="hidden lg:block" />
        </div>

        {planError && (
          <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {planError}
          </div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.key === activePlan;
            const isLoading = savingPlan === plan.key;

            return (
              <article
                key={plan.key}
                className={`group relative flex min-h-[640px] flex-col overflow-hidden rounded-[34px] border bg-gradient-to-b ${plan.accent} p-6 shadow-[0_24px_70px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(0,0,0,0.12)] sm:p-7 ${plan.border} ${isCurrent ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-[#f6f6f6]' : ''}`}
              >
                <div
                  className={`pointer-events-none absolute inset-x-8 top-0 h-32 rounded-full blur-3xl transition-opacity duration-300 ${plan.dark ? 'bg-white/10 opacity-60' : 'bg-red-100/80 opacity-90'}`}
                />

                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`inline-flex rounded-[22px] p-3.5 ${plan.dark ? 'border border-white/10 bg-white/10 text-white' : 'border border-white bg-white text-red-600 shadow-[0_12px_30px_rgba(15,23,42,0.08)]'}`}
                    >
                      <plan.icon className="h-6 w-6" />
                    </div>
                    {isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                        Активен
                      </span>
                    )}
                  </div>

                  <div className="mt-6">
                    <div className={`text-[11px] font-bold uppercase tracking-[0.22em] ${plan.dark ? 'text-white/45' : 'text-red-500'}`}>
                      {plan.eyebrow}
                    </div>
                    <h2 className={`mt-3 text-[2rem] font-black leading-none ${plan.dark ? 'text-white' : 'text-gray-950'}`}>{plan.name}</h2>
                    <div className={`mt-3 text-2xl font-bold ${plan.dark ? 'text-white' : 'text-gray-800'}`}>{plan.price}</div>
                    <p className={`mt-3 max-w-sm text-sm leading-6 ${plan.dark ? 'text-white/70' : 'text-gray-600'}`}>{plan.summary}</p>
                  </div>

                  <ul className={`mt-7 space-y-3 rounded-[26px] border px-4 py-4 sm:px-5 ${plan.dark ? 'border-white/10 bg-white/[0.03]' : 'border-white/80 bg-white/70 backdrop-blur-sm'}`}>
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className={`flex items-start gap-3 border-b pb-3 text-sm leading-6 last:border-b-0 last:pb-0 ${plan.dark ? 'border-white/10 text-white/90' : 'border-zinc-200/80 text-gray-700'}`}
                      >
                        <span
                          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${plan.dark ? 'bg-white/10 text-white' : 'bg-red-50 text-red-600'}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-8">
                    <button
                      onClick={() => handleSelectPlan(plan.key)}
                      disabled={isCurrent || isLoading || savingPlan !== null}
                      className={`w-full rounded-full px-5 py-3.5 text-sm font-bold transition-all ${
                        isCurrent
                          ? plan.dark
                            ? 'cursor-default bg-white/15 text-white'
                            : 'cursor-default bg-zinc-200 text-zinc-500'
                          : plan.dark
                            ? 'bg-white text-black hover:bg-zinc-100 hover:-translate-y-0.5 disabled:opacity-50'
                            : 'bg-black text-white hover:bg-zinc-800 hover:-translate-y-0.5 disabled:opacity-50'
                      }`}
                    >
                      {isLoading ? 'Применение…' : isCurrent ? 'Текущий план' : plan.cta}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
