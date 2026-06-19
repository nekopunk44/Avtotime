import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  BarChart3,
  Eye,
  MessageSquareText,
  Sparkles,
  Crown,
  TrendingUp,
} from 'lucide-react';
import { marketAPI } from '../../utils/marketAPI';

interface MarketAnalyticsPageProps {
  onBack: () => void;
  onOpenTariffs?: () => void;
}

interface DailyPoint {
  day: string;
  views: number;
  leads: number;
}

interface ListingRow {
  kind: 'cars' | 'parts';
  id: number;
  _id: string;
  title: string;
  image: string;
  viewsTotal: number;
  leadsTotal: number;
  last7DaysViews: number;
  last7DaysLeads: number;
  series: DailyPoint[];
}

interface AnalyticsData {
  effectivePlan: string;
  days: string[];
  dailyTotals: DailyPoint[];
  totals: { viewsTotal: number; leadsTotal: number; last7DaysViews: number; last7DaysLeads: number };
  listings: ListingRow[];
}

const PLAN_LABEL: Record<string, string> = {
  pro: 'Pro Seller',
  business: 'Business',
};

const KIND_LABEL: Record<ListingRow['kind'], string> = {
  cars: 'Авто',
  parts: 'Запчасти',
};

const formatShortDay = (raw: string) => {
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const SimpleBars: React.FC<{ data: DailyPoint[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => Math.max(d.views, d.leads)));
  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((point) => (
        <div key={point.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex h-24 w-full items-end gap-0.5">
            <div
              className="flex-1 rounded-t bg-red-500/90"
              style={{ height: `${(point.views / max) * 100}%` }}
              title={`Просмотры: ${point.views}`}
            />
            <div
              className="flex-1 rounded-t bg-emerald-500/90"
              style={{ height: `${(point.leads / max) * 100}%` }}
              title={`Контакты: ${point.leads}`}
            />
          </div>
          <div className="whitespace-nowrap text-[10px] font-semibold text-gray-500">
            {formatShortDay(point.day)}
          </div>
        </div>
      ))}
    </div>
  );
};

export const MarketAnalyticsPage: React.FC<MarketAnalyticsPageProps> = ({
  onBack,
  onOpenTariffs,
}) => {
  const stickyTopOffset = 'calc(var(--market-header-height, 120px) + 16px)';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await marketAPI.getMarketAnalyticsSummary();
        if (cancelled) return;
        setData(result);
      } catch (err: any) {
        if (cancelled) return;
        const code = err?.data?.code || err?.response?.data?.code || '';
        const msg = err?.data?.message || err?.message || 'Не удалось загрузить аналитику';
        setError(msg);
        setErrorCode(code);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedListings = useMemo(() => {
    if (!data) return [] as ListingRow[];
    return [...data.listings].sort((a, b) => b.viewsTotal - a.viewsTotal);
  }, [data]);

  const planLabel = data?.effectivePlan ? PLAN_LABEL[data.effectivePlan] || data.effectivePlan : '';

  return (
    <section className="min-h-screen bg-[#f6f6f6] py-6 sm:py-14">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-5 sm:mb-0">
          <button
            onClick={onBack}
            aria-label="Назад в настройки"
            className="inline-flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-red-200 bg-white text-red-600 shadow-[0_8px_20px_rgba(225,29,72,0.14)] transition-all hover:bg-red-50"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.8]" />
          </button>
          <div className="sm:hidden">
            <div className="text-lg font-black text-gray-950">Аналитика</div>
            <div className="text-xs text-gray-500">Просмотры и контакты за 7 дней</div>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-center text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-600 shadow-sm">
            <BarChart3 className="h-4 w-4" />
            Аналитика
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">
            Статистика объявлений
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Просмотры и контакты по вашим объявлениям за последние 7 дней.
          </p>
        </div>

        {loading ? (
          <div className="mt-10 flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Считаем статистику...
          </div>
        ) : error ? (
          <div className="mt-10 rounded-[32px] border border-zinc-200 bg-white p-8 text-center sm:p-10">
            <div className="mb-3 inline-flex rounded-2xl bg-amber-50 p-3 text-amber-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="text-lg font-bold text-gray-900">{error}</div>
            {errorCode === 'ANALYTICS_DISABLED' && (
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                Подробная статистика просмотров и контактов доступна на тарифах Pro Seller и Business.
              </p>
            )}
            {onOpenTariffs && (
              <button
                onClick={onOpenTariffs}
                className="mt-5 rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
              >
                Посмотреть тарифы
              </button>
            )}
          </div>
        ) : data ? (
          <>
            <div className="mt-4 sm:mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <Tile
                label="Всего просмотров"
                value={data.totals.viewsTotal}
                accent="text-red-600"
                icon={<Eye className="h-5 w-5" />}
              />
              <Tile
                label="Всего контактов"
                value={data.totals.leadsTotal}
                accent="text-emerald-600"
                icon={<MessageSquareText className="h-5 w-5" />}
              />
              <Tile
                label="Просмотры за 7 дней"
                value={data.totals.last7DaysViews}
                accent="text-red-600"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <Tile
                label="Контакты за 7 дней"
                value={data.totals.last7DaysLeads}
                accent="text-emerald-600"
                icon={<TrendingUp className="h-5 w-5" />}
              />
            </div>

            <div className="mt-4 sm:mt-8 grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
              <div className="rounded-[24px] sm:rounded-[32px] border border-zinc-200 bg-white p-4 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-500">
                      Активность
                    </div>
                    <div className="mt-1 text-lg font-black text-gray-950">Последние 7 дней</div>
                  </div>
                  <div className="hidden items-center gap-3 text-xs text-gray-600 sm:flex">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                      Просмотры
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                      Контакты
                    </span>
                  </div>
                </div>
                <SimpleBars data={data.dailyTotals} />
              </div>

              <div className="rounded-[24px] sm:rounded-[32px] bg-black p-4 sm:p-7 text-white shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/50">
                  Тариф
                </div>
                <div className="mt-2 flex items-center gap-2 text-2xl font-black">
                  {data.effectivePlan === 'business' ? (
                    <Crown className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  {planLabel}
                </div>
                <p className="mt-3 text-sm text-white/75">
                  Аналитика просмотров и контактов обновляется в реальном времени и доступна, пока действует тариф Pro или Business.
                </p>
                {onOpenTariffs && (
                  <button
                    onClick={onOpenTariffs}
                    className="mt-6 w-full rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-zinc-100"
                  >
                    Управлять тарифом
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 sm:mt-8 rounded-[24px] sm:rounded-[32px] border border-zinc-200 bg-white p-4 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-500">
                По объявлениям
              </div>
              <div className="mt-1 mb-5 text-lg font-black text-gray-950">Ваши объявления</div>

              {sortedListings.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  Пока нет опубликованных объявлений в категориях «Авто» и «Запчасти».
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {sortedListings.map((row) => (
                    <li
                      key={`${row.kind}-${row._id}`}
                      className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                        {row.image ? (
                          <img
                            src={row.image}
                            alt={row.title}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-gray-950">{row.title}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                          {KIND_LABEL[row.kind]}
                        </div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-6 sm:flex">
                        <div className="text-right">
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                            Просмотры
                          </div>
                          <div className="text-base font-black text-gray-950">
                            {row.viewsTotal}
                            <span className="ml-1 text-[11px] font-bold text-red-600">
                              +{row.last7DaysViews}/нед
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                            Контакты
                          </div>
                          <div className="text-base font-black text-gray-950">
                            {row.leadsTotal}
                            <span className="ml-1 text-[11px] font-bold text-emerald-600">
                              +{row.last7DaysLeads}/нед
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end sm:hidden">
                        <div className="text-sm font-black text-red-600">{row.viewsTotal} 👁</div>
                        <div className="text-sm font-black text-emerald-600">{row.leadsTotal} 💬</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};

const Tile: React.FC<{
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
}> = ({ label, value, accent, icon }) => (
  <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white px-3 py-3 sm:px-5 sm:py-4 shadow-[0_8px_28px_rgba(0,0,0,0.04)]">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 leading-tight">
        {label}
      </div>
      <div className={`${accent} shrink-0`}>{icon}</div>
    </div>
    <div className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-black text-gray-950">{value}</div>
  </div>
);
