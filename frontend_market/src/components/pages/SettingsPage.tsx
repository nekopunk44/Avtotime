import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { marketAPI } from '../../utils/marketAPI';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CreditCard,
  FileText,
  Loader2,
  Lock,
  Receipt,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

export type SettingsSectionKey =
  | 'settings-main-info'
  | 'settings-personal-data'
  | 'settings-security'
  | 'settings-listings';

interface SettingsPageProps {
  onOpenTariffs: () => void;
  onOpenPaymentHistory?: () => void;
  onOpenAnalytics?: () => void;
  onOpenSection: (section: SettingsSectionKey) => void;
  userData?: {
    userName?: string;
    name?: string;
    profileImage?: string;
    plan?: string;
    effectivePlan?: string;
    planExpiresAt?: string | null;
  } | null;
  onPlanChanged?: (plan: string, extras?: { effectivePlan?: string; planLimits?: any; planExpiresAt?: string | null }) => void;
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Базовый',
  pro: 'Pro Seller',
  business: 'Business',
};

const formatPlanExpiry = (raw?: string | null) => {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((date.getTime() - now.getTime()) / msInDay);

  const formatted = date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return { formatted, daysLeft, isExpired: daysLeft < 0, isExpiringSoon: daysLeft >= 0 && daysLeft <= 7 };
};

const settingsSections: Array<{
  key: SettingsSectionKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    key: 'settings-main-info',
    title: 'Основная информация',
    description: 'Имя профиля, фото, короткое описание и публичное отображение аккаунта.',
    icon: Settings2,
    accent: 'bg-red-50 text-red-600',
  },
  {
    key: 'settings-personal-data',
    title: 'Личные данные',
    description: 'Контакты, адрес, регион и данные для связи с покупателями и клиентами.',
    icon: UserRound,
    accent: 'bg-blue-50 text-blue-600',
  },
  {
    key: 'settings-security',
    title: 'Безопасность',
    description: 'Пароль, двухэтапная защита, устройства входа и контроль сессий.',
    icon: Lock,
    accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    key: 'settings-listings',
    title: 'Мои объявления',
    description: 'Управление активными, архивными и черновыми объявлениями в одном месте.',
    icon: FileText,
    accent: 'bg-amber-50 text-amber-600',
  },
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onOpenTariffs,
  onOpenPaymentHistory,
  onOpenAnalytics,
  onOpenSection,
  userData,
  onPlanChanged,
}) => {
  const [listingsLabel, setListingsLabel] = useState<string>('Загрузка...');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const planKey = userData?.plan || 'free';
  const planLabel = PLAN_LABEL[planKey] || 'Базовый';
  const expiry = formatPlanExpiry(userData?.planExpiresAt);
  const isPaidPlan = planKey === 'pro' || planKey === 'business';

  const handleCancel = async () => {
    setCancelError('');
    setCancelling(true);
    try {
      const result = await marketAPI.setPlan('free');
      onPlanChanged?.('free', {
        effectivePlan: result.effectivePlan,
        planLimits: result.planLimits,
        planExpiresAt: result.planExpiresAt,
      });
      setCancelOpen(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Не удалось отменить подписку');
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const results = await Promise.allSettled([
          marketAPI.loadCars({ mine: true }),
          marketAPI.loadCarServices({ mine: true }),
          marketAPI.loadAutoTuning({ mine: true }),
          marketAPI.loadDryCleaning({ mine: true }),
          marketAPI.loadConsultations({ mine: true }),
        ]);
        if (cancelled) return;
        const all = (results as Array<PromiseSettledResult<any[]>>).flatMap((r) =>
          r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []
        );
        const active = all.filter((l: any) => !l.moderationStatus || l.moderationStatus === 'approved').length;
        setListingsLabel(all.length === 0 ? 'Нет объявлений' : `${active} активных, ${all.length - active} других`);
      } catch {
        if (!cancelled) setListingsLabel('—');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="bg-[#f6f6f6] pb-10 pt-8 sm:pb-14 sm:pt-8">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="flex h-full flex-col rounded-[32px] border border-zinc-200 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-600 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              Настройки
            </div>

            <h1 className="mt-4 text-center text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              Управление аккаунтом AVTOTIME
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-center text-base text-gray-600">
              Здесь собраны все ключевые разделы аккаунта: от профиля и безопасности до управления объявлениями и тарифом.
            </p>

            <div className="hidden mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Профиль</div>
                <div className="mt-2 text-sm font-semibold text-gray-900">Аккаунт настроен</div>
              </div>
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Тариф</div>
                <div className="mt-2 text-sm font-semibold text-gray-900">{planLabel}</div>
              </div>
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Объявления</div>
                <div className="mt-2 text-sm font-semibold text-gray-900">{listingsLabel}</div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {settingsSections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => onOpenSection(section.key)}
                  className="group relative rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfb_100%)] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.06)]"
                >
                  <div className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-gray-400 transition-colors group-hover:text-gray-900">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className={`inline-flex rounded-[18px] p-3 ${section.accent}`}>
                    <section.icon className="w-4 h-4" />
                  </div>
                  <h2 className="mt-5 max-w-[18rem] text-[1.15rem] leading-[1.15] font-black text-gray-950">{section.title}</h2>
                  <p className="mt-3 max-w-[24rem] text-sm leading-7 text-gray-600">{section.description}</p>
                  <div className="mt-5 inline-flex items-center rounded-full bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">
                    Открыть раздел
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex h-full flex-col gap-6">
            <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {userData?.profileImage ? (
                      <img
                        src={userData.profileImage}
                        alt={userData.userName || 'Профиль'}
                        className="h-16 w-16 rounded-2xl border border-white/10 object-cover shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7B61FF] via-[#E9546B] to-[#FFB457] text-xl font-black uppercase text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
                        {userData?.userName?.[0] || userData?.name?.[0] || 'U'}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/50 font-bold">Профиль</div>
                      <div className="mt-2 pb-1 text-[1.65rem] leading-tight font-black truncate">
                        {userData?.userName || userData?.name || 'Пользователь AVTOTIME'}
                      </div>
                      {userData?.name && <div className="mt-2 text-sm text-white/70 truncate">{userData.name}</div>}
                    </div>
                  </div>

                  <div className="hidden h-11 items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                    Активный профиль
                  </div>
                </div>

                <div className="hidden mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-bold">Статус</div>
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                      <BadgeCheck className="w-4 h-4 text-red-400" />
                      Аккаунт активен
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-bold">План</div>
                    <div className="mt-2 text-sm font-semibold text-white">{planLabel}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-bold">Объявления</div>
                    <div className="mt-2 text-sm font-semibold text-white">{listingsLabel}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] bg-white border border-zinc-200 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex rounded-2xl p-3 bg-red-50 text-red-600">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h2 className="mt-4 text-2xl font-black text-gray-950">Тарифы</h2>
                </div>
                <div className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-red-500">
                  {isPaidPlan ? 'Активный план' : 'Базовый доступ'}
                </div>
              </div>

              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
                Управляйте текущим планом, сравнивайте преимущества и при необходимости меняйте уровень подписки.
              </p>

              <div
                className={`mt-5 rounded-[26px] border p-5 ${
                  expiry?.isExpired
                    ? 'border-rose-200 bg-rose-50'
                    : expiry?.isExpiringSoon
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-zinc-200 bg-[linear-gradient(180deg,#fcfcfc_0%,#f7f7f8_100%)]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-bold">Текущий план</div>
                    <div className="mt-2 text-2xl font-black text-gray-950">{planLabel}</div>
                  </div>

                  <div className="grid min-w-[180px] gap-2 sm:grid-cols-2 sm:min-w-[260px]">
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Статус</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{isPaidPlan ? 'Оплачен' : 'Доступен'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Период</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{isPaidPlan ? '30 дней' : 'Без срока'}</div>
                    </div>
                  </div>
                </div>

                {isPaidPlan && expiry && (
                  <div
                    className={`mt-4 flex items-start gap-2 text-sm ${
                      expiry.isExpired
                        ? 'text-rose-700'
                        : expiry.isExpiringSoon
                          ? 'text-amber-700'
                          : 'text-gray-600'
                    }`}
                  >
                    {expiry.isExpired ? (
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <div>
                      {expiry.isExpired ? (
                        <>
                          <div className="font-semibold">Тариф истёк</div>
                          <div className="text-xs opacity-80">
                            Закончился {expiry.formatted}. Сейчас действует базовый план.
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold">Действует до {expiry.formatted}</div>
                          <div className="text-xs opacity-80">
                            {expiry.daysLeft === 0
                              ? 'Истекает сегодня'
                              : expiry.daysLeft === 1
                                ? 'Остался 1 день'
                                : `Осталось ${expiry.daysLeft} ${expiry.daysLeft < 5 ? 'дня' : 'дней'}`}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {!isPaidPlan && (
                  <div className="mt-3 text-sm text-gray-600">Можно повысить уровень в любой момент</div>
                )}
              </div>

              <button
                onClick={onOpenTariffs}
                className="mt-5 w-full rounded-full bg-black text-white px-5 py-3.5 text-sm font-bold hover:bg-zinc-800 transition-colors"
              >
                {isPaidPlan && !expiry?.isExpired ? 'Изменить тариф' : 'Открыть тарифы'}
              </button>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {onOpenPaymentHistory && (
                  <button
                    onClick={onOpenPaymentHistory}
                    className="rounded-[22px] border border-zinc-200 bg-white px-5 py-4 text-left text-sm font-bold text-gray-900 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-gray-700">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div>История платежей</div>
                        <div className="mt-1 text-xs font-medium text-gray-500">Все оплаты и статусы</div>
                      </div>
                    </div>
                  </button>
                )}

                {onOpenAnalytics && isPaidPlan && !expiry?.isExpired && (
                  <button
                    onClick={onOpenAnalytics}
                    className="rounded-[22px] border border-zinc-200 bg-white px-5 py-4 text-left text-sm font-bold text-gray-900 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-gray-700">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div>
                        <div>Аналитика объявлений</div>
                        <div className="mt-1 text-xs font-medium text-gray-500">Просмотры и отклики</div>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {isPaidPlan && !expiry?.isExpired && (
                <button
                  onClick={() => {
                    setCancelError('');
                    setCancelOpen(true);
                  }}
                  className="mt-4 w-full rounded-full border border-rose-200 bg-white text-rose-700 px-5 py-3.5 text-sm font-bold hover:bg-rose-50 transition-colors"
                >
                  Отменить подписку
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {cancelOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !cancelling && setCancelOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 disabled:opacity-50"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex rounded-2xl p-3 bg-rose-50 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <h3 className="mt-4 text-2xl font-black text-gray-950">Отменить подписку?</h3>
            <p className="mt-3 text-sm text-gray-600 leading-6">
              План «{planLabel}» будет деактивирован прямо сейчас. Объявления получат лимиты базового тарифа:
              приоритет в каталоге сбросится, а бейдж «{planLabel}» исчезнет с ваших объявлений.
            </p>

            {expiry && !expiry.isExpired && (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-gray-600">
                Текущий период оплачен до <span className="font-semibold text-gray-900">{expiry.formatted}</span>.
                Оплата не возвращается, после отмены вы перейдёте на базовый план немедленно.
              </div>
            )}

            {cancelError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {cancelError}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setCancelOpen(false)}
                disabled={cancelling}
                className="flex-1 rounded-full border border-zinc-200 bg-white text-gray-900 px-5 py-3 text-sm font-bold hover:bg-zinc-50 disabled:opacity-50"
              >
                Не отменять
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 rounded-full bg-rose-600 text-white px-5 py-3 text-sm font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                {cancelling ? 'Отмена…' : 'Да, отменить'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
};
