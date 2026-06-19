import React, { useEffect, useState } from 'react';
import { CalendarClock, ChevronLeft, Crown, Loader2, Receipt, Sparkles } from 'lucide-react';
import { marketAPI } from '../../utils/marketAPI';

interface PaymentHistoryPageProps {
  onBack: () => void;
  onOpenTariffs?: () => void;
}

interface PaymentRow {
  plan: string;
  amount: number;
  currency: string;
  createdAt: string;
  status: string;
}

const PLAN_LABEL: Record<string, string> = {
  pro: 'Pro Seller',
  business: 'Business',
  free: 'Базовый',
};

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  succeeded: { text: 'Оплачен', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { text: 'В обработке', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed: { text: 'Ошибка', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const formatAmount = (amount: number, currency: string) => {
  const value = (amount / 100).toFixed(2);
  const code = (currency || 'eur').toUpperCase();
  const symbol = code === 'EUR' ? '€' : code === 'USD' ? '$' : '';
  return symbol ? `${value} ${symbol}` : `${value} ${code}`;
};

const formatDate = (raw: string) => {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PaymentHistoryPage: React.FC<PaymentHistoryPageProps> = ({ onBack, onOpenTariffs }) => {
  const stickyTopOffset = 'calc(var(--market-header-height, 120px) + 16px)';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await marketAPI.getPaymentStatus();
        if (cancelled) return;
        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setCurrentPlan(data.plan || 'free');
        setPlanExpiresAt(data.planExpiresAt || null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить историю');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const expiryFormatted = planExpiresAt ? formatDate(planExpiresAt) : null;
  const currentPlanLabel = PLAN_LABEL[currentPlan] || 'Базовый';
  const successfulPayments = payments.filter((payment) => payment.status === 'succeeded');
  const totalSpent = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const lastPayment = successfulPayments[0] || payments[0] || null;

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95)_0%,rgba(246,246,246,1)_45%,rgba(242,242,242,1)_100%)] pb-12 pt-6 sm:pt-8 sm:pb-16">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="flex items-center gap-3 mb-5 sm:mb-0">
          <button
            onClick={onBack}
            aria-label="Назад в настройки"
            className="inline-flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-red-200 bg-white text-red-600 shadow-[0_8px_20px_rgba(225,29,72,0.14)] transition-all hover:bg-red-50"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.8]" />
          </button>
          <div className="sm:hidden">
            <div className="text-lg font-black text-gray-950">История платежей</div>
            <div className="text-xs text-gray-500">Тариф, оплаты и статусы</div>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-center text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-5 py-2 text-xs font-bold uppercase tracking-[0.24em] text-red-600 shadow-[0_10px_30px_rgba(239,68,68,0.08)]">
            <Receipt className="h-4 w-4" />
            Платежи
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-gray-950 sm:text-5xl">История платежей</h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-gray-600">
            Вся информация по тарифу, сроку действия и последним оплатам.
          </p>
        </div>

        <div className="mt-4 sm:mt-8 grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start">
          <div className="rounded-[24px] sm:rounded-[30px] bg-[linear-gradient(180deg,#0b0b0d_0%,#18181b_100%)] p-4 sm:p-7 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">Текущий план</div>
                <div className="mt-2 sm:mt-3 text-2xl sm:text-[2.4rem] font-black leading-none">{currentPlanLabel}</div>
              </div>
              {!loading && !error && payments.length > 0 && (
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80">
                  {payments.length} {payments.length === 1 ? 'оплата' : 'оплат'}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/5 p-2 text-white/80">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white/85">Действует до</div>
                  <div className="mt-1 text-sm text-white/65">{expiryFormatted || 'Нет активного срока'}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-1">
              <div className="rounded-[18px] sm:rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-3 sm:px-4 sm:py-4">
                <div className="text-[11px] sm:text-sm text-white/55">Оплат</div>
                <div className="mt-1 sm:mt-2 text-xl sm:text-3xl font-black text-white">{successfulPayments.length}</div>
              </div>
              <div className="rounded-[18px] sm:rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-3 sm:px-4 sm:py-4">
                <div className="text-[11px] sm:text-sm text-white/55">Итого</div>
                <div className="mt-1 sm:mt-2 text-base sm:text-3xl font-black text-white">
                  {formatAmount(totalSpent, successfulPayments[0]?.currency || 'eur')}
                </div>
              </div>
              <div className="rounded-[18px] sm:rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-3 sm:px-4 sm:py-4">
                <div className="text-[11px] sm:text-sm text-white/55">Последний</div>
                <div className="mt-1 sm:mt-2 text-[11px] sm:text-base font-black text-white">{lastPayment ? formatDate(lastPayment.createdAt) : 'Пока нет'}</div>
              </div>
            </div>

            {onOpenTariffs && (
              <button
                onClick={onOpenTariffs}
                className="mt-6 w-full rounded-full bg-white px-5 py-3.5 text-sm font-bold text-black transition-colors hover:bg-zinc-100"
              >
                Управлять тарифом
              </button>
            )}
          </div>

          <div className="rounded-[24px] sm:rounded-[30px] border border-zinc-200 bg-white p-4 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="inline-flex rounded-xl sm:rounded-2xl bg-red-50 p-2.5 sm:p-3 text-red-600 shrink-0">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-3xl font-black text-gray-950">Журнал платежей</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
                  Все списания, статусы оплат и время каждой операции по вашему аккаунту.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20 text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Загружаем историю...
              </div>
            ) : error ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : payments.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mb-3 inline-flex rounded-2xl bg-zinc-100 p-3 text-gray-400">
                  <Receipt className="h-6 w-6" />
                </div>
                <div className="text-lg font-bold text-gray-900">Платежей пока нет</div>
                <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
                  Когда вы оплатите Pro или Business, история появится здесь.
                </p>
                {onOpenTariffs && (
                  <button
                    onClick={onOpenTariffs}
                    className="mt-5 rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
                  >
                    Посмотреть тарифы
                  </button>
                )}
              </div>
            ) : (
              <ul className="mt-8 space-y-4">
                {payments.map((payment, index) => {
                  const statusInfo = STATUS_LABEL[payment.status] || {
                    text: payment.status,
                    tone: 'bg-zinc-50 text-gray-700 border-zinc-200',
                  };

                  return (
                    <li
                      key={`${payment.createdAt}-${index}`}
                      className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfb_100%)] p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="shrink-0 rounded-2xl bg-red-50 p-3 text-red-600">
                            {payment.plan === 'business' ? <Crown className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-bold text-gray-950">{PLAN_LABEL[payment.plan] || payment.plan}</div>
                            <div className="mt-1 text-sm text-gray-500">{formatDate(payment.createdAt)}</div>
                          </div>
                        </div>

                        <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                          <div className="whitespace-nowrap text-xl sm:text-2xl font-black text-gray-950">
                            {formatAmount(payment.amount, payment.currency)}
                          </div>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusInfo.tone}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
