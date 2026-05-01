import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Crown,
  Sparkles,
  ShieldCheck,
  Lock,
  CheckCircle,
  XCircle,
  BadgeCheck,
  CreditCard,
  CalendarClock,
} from 'lucide-react';
import { marketAPI } from '../../utils/marketAPI';

type PlanKey = 'pro' | 'business';

interface PaymentPageProps {
  plan: PlanKey;
  onBack: () => void;
  onSuccess: (plan: string, extras?: { effectivePlan?: string; planLimits?: any; planExpiresAt?: string | null }) => void;
}

const PLAN_INFO: Record<
  PlanKey,
  {
    name: string;
    price: string;
    monthlyValue: string;
    icon: React.ComponentType<{ className?: string }>;
    features: string[];
    dark: boolean;
    note: string;
    accentLabel: string;
  }
> = {
  pro: {
    name: 'Pro Seller',
    price: '29 EUR / мес',
    monthlyValue: '29 EUR',
    icon: Sparkles,
    dark: false,
    accentLabel: 'Для активных продавцов',
    features: [
      'Приоритет в выдаче каталога',
      'Больше фото и расширенное описание',
      'Статистика просмотров и заявок',
    ],
    note: 'Подписка активируется сразу после успешной оплаты и действует 30 дней.',
  },
  business: {
    name: 'Business',
    price: '79 EUR / мес',
    monthlyValue: '79 EUR',
    icon: Crown,
    dark: true,
    accentLabel: 'Для компаний и автосалонов',
    features: [
      'Витрина автосалона или сервиса',
      'Выделенный бренд-блок на главной',
      'Менеджерские аккаунты и поддержка',
    ],
    note: 'Тариф рассчитан на постоянное присутствие бренда в AVTOTIME Market.',
  },
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Stripe?: any;
  }
}

const stripeInstanceCache = new Map<string, unknown>();
const stripeLoaderCache = new Map<string, Promise<unknown>>();

const loadStripeJs = (publishableKey: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const cachedInstance = stripeInstanceCache.get(publishableKey);
    if (cachedInstance) {
      resolve(cachedInstance);
      return;
    }

    const cachedLoader = stripeLoaderCache.get(publishableKey);
    if (cachedLoader) {
      cachedLoader.then(resolve).catch(reject);
      return;
    }

    const createInstance = () => {
      const instance = window.Stripe?.(publishableKey);
      if (!instance) {
        throw new Error('Stripe не удалось инициализировать.');
      }
      stripeInstanceCache.set(publishableKey, instance);
      return instance;
    };

    const loader = new Promise<unknown>((innerResolve, innerReject) => {
      if (window.Stripe) {
        try {
          innerResolve(createInstance());
        } catch (error) {
          innerReject(error);
        }
        return;
      }

      const existing = document.getElementById('stripe-js') as HTMLScriptElement | null;
      if (existing) {
        const handleLoad = () => {
          try {
            innerResolve(createInstance());
          } catch (error) {
            innerReject(error);
          }
        };
        existing.addEventListener('load', handleLoad, { once: true });
        existing.addEventListener('error', innerReject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = 'stripe-js';
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        try {
          innerResolve(createInstance());
        } catch (error) {
          innerReject(error);
        }
      };
      script.onerror = innerReject;
      document.head.appendChild(script);
    });

    stripeLoaderCache.set(publishableKey, loader);
    loader.then(resolve).catch((error) => {
      stripeLoaderCache.delete(publishableKey);
      reject(error);
    });
  });

type Stage = 'loading' | 'form' | 'processing' | 'success' | 'error';

export const PaymentPage: React.FC<PaymentPageProps> = ({ plan, onBack, onSuccess }) => {
  const planInfo = PLAN_INFO[plan];
  const Icon = planInfo.icon;

  const [stage, setStage] = useState<Stage>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [cardError, setCardError] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [stripeLoaded, setStripeLoaded] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardElementRef = useRef<any>(null);
  const cardMountRef = useRef<HTMLDivElement>(null);
  const clientSecretRef = useRef('');
  const paymentIntentIdRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const intent = await marketAPI.createPaymentIntent(plan);
        if (cancelled) return;

        if (!intent.publishableKey) {
          setErrorMsg('Stripe не настроен. Добавьте STRIPE_PUBLISHABLE_KEY в .env сервера.');
          setStage('error');
          return;
        }

        clientSecretRef.current = intent.clientSecret;
        paymentIntentIdRef.current = intent.clientSecret.split('_secret_')[0];

        const stripe = await loadStripeJs(intent.publishableKey);
        if (cancelled) return;
        stripeRef.current = stripe;
        setStripeLoaded(true);

        setStage('form');
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Ошибка инициализации платежа');
        setStage('error');
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  useEffect(() => {
    if (!stripeLoaded || !stripeRef.current || !cardMountRef.current) return;
    if (cardElementRef.current) return;

    const elements = stripeRef.current.elements();
    const card = elements.create('card', {
      style: {
        base: {
          fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: '17px',
          color: '#101828',
          iconColor: '#475467',
          '::placeholder': { color: '#98a2b3' },
        },
        invalid: { color: '#dc2626', iconColor: '#dc2626' },
      },
      hidePostalCode: true,
      disableLink: true,
    });

    card.mount(cardMountRef.current);
    card.on('ready', () => {
      setCardReady(true);
    });
    card.on('change', (event: { error?: { message: string }; complete: boolean }) => {
      setCardError(event.error ? event.error.message : '');
      setCardComplete(event.complete);
    });

    cardElementRef.current = card;

    return () => {
      setCardReady(false);
      card.destroy();
      cardElementRef.current = null;
    };
  }, [stripeLoaded]);

  const handlePay = async () => {
    if (!stripeRef.current || !cardElementRef.current || !cardReady) return;
    setErrorMsg('');
    setStage('processing');

    try {
      const result = await stripeRef.current.confirmCardPayment(clientSecretRef.current, {
        payment_method: { card: cardElementRef.current },
      });

      if (result.error) {
        setErrorMsg(result.error.message || 'Платёж отклонён');
        setStage('form');
        return;
      }

      if (result.paymentIntent?.status === 'succeeded') {
        const confirmed = await marketAPI.confirmPayment(paymentIntentIdRef.current);
        setStage('success');
        setTimeout(
          () =>
            onSuccess(plan, {
              effectivePlan: (confirmed as any)?.effectivePlan,
              planLimits: (confirmed as any)?.planLimits,
              planExpiresAt: confirmed?.planExpiresAt || null,
            }),
          2200,
        );
      } else {
        setErrorMsg('Платёж не завершён. Попробуйте ещё раз.');
        setStage('form');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка оплаты');
      setStage('form');
    }
  };

  const isProcessing = stage === 'processing';

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top,#fff6f4_0%,#f8f8f7_42%,#f2f4f7_100%)] py-8 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mt-2 grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
          <button
            onClick={onBack}
            disabled={isProcessing}
            aria-label="Назад к тарифам"
            className="inline-flex h-14 w-14 items-center justify-center self-start rounded-2xl border border-red-200 bg-white text-red-600 shadow-[0_14px_32px_rgba(225,29,72,0.18)] transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.8]" />
          </button>

          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-red-500 shadow-sm">
            <Lock className="h-3.5 w-3.5" />
            Безопасная оплата
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">
              Оформление подписки
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600 sm:text-lg">
              Подтвердите тариф, введите данные карты и завершите оплату. Подписка активируется автоматически сразу после успешного платежа.
            </p>
          </div>
          <div className="hidden lg:block" />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
          <div className="space-y-5">
            <div
              className={[
                'overflow-hidden rounded-[32px] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7',
                planInfo.dark
                  ? 'border-black bg-[linear-gradient(180deg,#151515_0%,#09090b_100%)] text-white'
                  : 'border-[#f1d7d1] bg-[linear-gradient(180deg,#ffffff_0%,#fff7f5_100%)] text-gray-950',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={[
                    'inline-flex rounded-2xl p-3.5',
                    planInfo.dark ? 'bg-white/10 text-white' : 'bg-red-50 text-red-600 shadow-sm',
                  ].join(' ')}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div
                  className={[
                    'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]',
                    planInfo.dark ? 'bg-white/10 text-white/85' : 'bg-red-50 text-red-500',
                  ].join(' ')}
                >
                  {planInfo.accentLabel}
                </div>
              </div>

              <div className="mt-6">
                <h2 className={`text-[30px] font-black leading-none ${planInfo.dark ? 'text-white' : 'text-gray-950'}`}>
                  {planInfo.name}
                </h2>
                <div className={`mt-3 flex items-end gap-2 ${planInfo.dark ? 'text-white' : 'text-gray-900'}`}>
                  <span className="text-[34px] font-black leading-none">{planInfo.monthlyValue}</span>
                  <span className={`pb-1 text-sm font-semibold ${planInfo.dark ? 'text-white/65' : 'text-gray-500'}`}>в месяц</span>
                </div>
              </div>

              <div className={`mt-6 grid grid-cols-2 gap-3 rounded-[24px] border p-4 ${planInfo.dark ? 'border-white/10 bg-white/5' : 'border-red-100 bg-white/75'}`}>
                <div>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${planInfo.dark ? 'text-white/45' : 'text-gray-400'}`}>
                    Период
                  </div>
                  <div className={`mt-1 text-sm font-semibold ${planInfo.dark ? 'text-white' : 'text-gray-900'}`}>30 дней</div>
                </div>
                <div>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${planInfo.dark ? 'text-white/45' : 'text-gray-400'}`}>
                    Активация
                  </div>
                  <div className={`mt-1 text-sm font-semibold ${planInfo.dark ? 'text-white' : 'text-gray-900'}`}>Сразу после оплаты</div>
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {planInfo.features.map((feature) => (
                  <li
                    key={feature}
                    className={`flex items-start gap-3 text-sm leading-6 ${planInfo.dark ? 'text-white/84' : 'text-gray-700'}`}
                  >
                    <BadgeCheck className={`mt-1 h-4.5 w-4.5 shrink-0 ${planInfo.dark ? 'text-white/85' : 'text-red-500'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className={`mt-6 rounded-[24px] border p-4 text-sm leading-6 ${planInfo.dark ? 'border-white/10 bg-white/5 text-white/70' : 'border-zinc-200 bg-white text-gray-600'}`}>
                {planInfo.note}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.05)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">Защищённая обработка</div>
                  <div className="text-xs text-gray-500">Платёжные данные обрабатываются через Stripe</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/80 bg-white/88 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.07)] backdrop-blur sm:p-8">
            {stage === 'success' && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-black text-gray-950">Оплата прошла успешно</h3>
                <p className="max-w-md text-sm leading-6 text-gray-500">
                  Тариф <span className="font-bold text-gray-800">{planInfo.name}</span> активирован. Сейчас вернём вас обратно.
                </p>
              </div>
            )}

            {stage === 'error' && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
                  <XCircle className="h-8 w-8 text-rose-500" />
                </div>
                <h3 className="text-2xl font-black text-gray-950">Не удалось подготовить оплату</h3>
                <p className="max-w-md text-sm leading-6 text-rose-700">{errorMsg}</p>
                <button
                  onClick={onBack}
                  className="mt-2 rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
                >
                  Вернуться назад
                </button>
              </div>
            )}

            {stage === 'loading' && (
              <div className="animate-pulse space-y-5 py-4">
                <div className="h-5 w-44 rounded-full bg-zinc-100" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="h-20 rounded-2xl bg-zinc-100" />
                  <div className="h-20 rounded-2xl bg-zinc-100" />
                  <div className="h-20 rounded-2xl bg-zinc-100" />
                </div>
                <div className="h-14 rounded-2xl bg-zinc-100" />
                <div className="h-14 rounded-full bg-zinc-100" />
              </div>
            )}

            {(stage === 'form' || stage === 'processing') && (
              <>
                <div className="flex flex-col gap-5 border-b border-zinc-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                      <CreditCard className="h-3.5 w-3.5" />
                      Оплата картой
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-gray-950">Данные карты</h3>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500">
                      Введите карту для оплаты подписки. После завершения вы сразу получите доступ к возможностям тарифа.
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-red-100 bg-red-50/70 px-4 py-3 sm:min-w-[180px]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-400">К оплате</div>
                    <div className="mt-1 text-2xl font-black text-gray-950">{planInfo.monthlyValue}</div>
                    <div className="mt-1 text-xs text-gray-500">{planInfo.name}</div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Тариф</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">{planInfo.name}</div>
                  </div>
                  <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Списание</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">Одним платежом</div>
                  </div>
                  <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Доступ
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">На 30 дней</div>
                  </div>
                </div>

                <div className="mt-6 rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-4 sm:p-5">
                  <div className="mb-3 text-sm font-bold text-gray-900">Платёжная информация</div>
                  <div
                    ref={cardMountRef}
                    className="rounded-[20px] border border-zinc-200 bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-50"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1">Visa</span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1">Mastercard</span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1">Stripe</span>
                  </div>
                </div>

                {cardError && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {cardError}
                  </div>
                )}

                {errorMsg && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={isProcessing || !cardComplete || !cardReady}
                  className="mt-6 flex h-[58px] w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isProcessing ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Обработка оплаты...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Оплатить {planInfo.price}
                    </>
                  )}
                </button>

                <div className="mt-4 rounded-[24px] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                  <div className="flex items-start gap-3 text-sm text-emerald-900">
                    <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-600" />
                    <div>
                      <div className="font-semibold">Защищено Stripe</div>
                      <div className="mt-1 text-xs leading-5 text-emerald-800/80">
                        Данные карты не проходят через наш сервер и обрабатываются на стороне Stripe.
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
