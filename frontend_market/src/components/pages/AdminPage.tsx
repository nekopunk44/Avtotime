import React from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  ShieldOff,
  Users,
  XCircle,
  Ban,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import { marketAPI } from '../../utils/marketAPI';
import { showMarketToast } from '../../utils/avtotime';

type AdminKind = 'cars' | 'parts' | 'car-services' | 'auto-tuning' | 'dry-cleaning' | 'consultations';
type AdminSection = 'dashboard' | 'moderation' | 'users';

const SegmentedControl = <K extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: Array<{ key: K; label: string; Icon?: React.ComponentType<{ className?: string }> }>;
  value: K;
  onChange: (key: K) => void;
  className?: string;
  ariaLabel?: string;
}) => {
  const count = Math.max(1, options.length);
  const index = Math.max(0, options.findIndex((opt) => opt.key === value));

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        'relative inline-flex items-stretch overflow-hidden rounded-full border border-gray-200 bg-white p-1 shadow-sm',
        className || '',
      ].join(' ')}
      style={
        {
          ['--seg-count' as any]: count,
          ['--seg-index' as any]: index,
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden="true"
        className={[
          'absolute top-1 bottom-1 left-1 rounded-full bg-black transition-transform duration-300',
          'ease-[cubic-bezier(0.16,1,0.3,1)]',
          'opacity-100',
        ].join(' ')}
        style={{
          width: 'calc((100% - 0.5rem) / var(--seg-count))',
          transform: 'translate3d(calc(var(--seg-index) * 100%), 0, 0)',
        }}
      />

      {options.map((opt) => {
        const active = opt.key === value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={[
              'relative z-10 inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold',
              'transition-colors select-none whitespace-nowrap active:scale-[0.98]',
              active ? 'text-white' : 'text-gray-700 hover:text-gray-900',
            ].join(' ')}
          >
            {Icon ? <Icon className={['h-4 w-4', active ? 'text-white' : 'text-gray-500'].join(' ')} /> : null}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const KINDS: Array<{ kind: AdminKind; label: string }> = [
  { kind: 'cars', label: 'Авто' },
  { kind: 'parts', label: 'Запчасти' },
  { kind: 'car-services', label: 'Автосервис' },
  { kind: 'auto-tuning', label: 'Автотюнинг' },
  { kind: 'dry-cleaning', label: 'Химчистка' },
  { kind: 'consultations', label: 'Консультации' },
];

const SECTIONS: Array<{ key: AdminSection; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Дашборд', Icon: BarChart3 },
  { key: 'moderation', label: 'Модерация', Icon: ClipboardList },
  { key: 'users', label: 'Пользователи', Icon: Users },
];

const resolveTitle = (item: any) => {
  const title = typeof item?.title === 'string' ? item.title : '';
  const name = typeof item?.name === 'string' ? item.name : '';
  return title || name || 'Без названия';
};

const resolveImage = (item: any) => {
  if (typeof item?.image === 'string' && item.image) return item.image;
  if (typeof item?.avatar === 'string' && item.avatar) return item.avatar;
  if (Array.isArray(item?.images) && typeof item.images[0] === 'string') return item.images[0];
  return '';
};

const resolveMeta = (item: any) => {
  const location =
    (typeof item?.region === 'string' && item.region) ||
    (typeof item?.location === 'string' && item.location) ||
    (typeof item?.registrationPlace === 'string' && item.registrationPlace) ||
    '';
  const nickname = typeof item?.socialNickname === 'string' ? item.socialNickname : '';
  const authorName = typeof item?.author?.userName === 'string' ? item.author.userName : '';
  return { location, nickname, authorName };
};

const safeNum = (value: unknown) => Number(value ?? 0) || 0;

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const StatCard: React.FC<{
  title: string;
  value: number;
  subtitle?: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = ({ title, value, subtitle, Icon }) => (
  <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-gray-600">{title}</div>
        <div className="mt-2 text-[28px] leading-none font-black text-gray-900 tabular-nums">
          {value.toLocaleString()}
        </div>
        {subtitle ? <div className="mt-2 text-[13px] text-gray-500">{subtitle}</div> : null}
      </div>
      <div className="shrink-0 rounded-2xl bg-gray-100 p-3 text-gray-900">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const MiniBars: React.FC<{
  daily: Array<{ date: string; newUsers: number; newListings: number }>;
  title?: string;
  subtitle?: string;
  bucket?: string;
  headerRight?: React.ReactNode;
  className?: string;
}> = ({ daily, title, subtitle, bucket, headerRight, className }) => {
  const maxUsers = Math.max(1, ...daily.map((d) => safeNum(d.newUsers)));
  const maxListings = Math.max(1, ...daily.map((d) => safeNum(d.newListings)));
  const labelEvery = daily.length <= 12 ? 1 : Math.ceil(daily.length / 8);
  const colWidth = 34;
  const chartMinWidth = Math.max(320, daily.length * colWidth);

  const formatLabel = (raw: string) => {
    const str = String(raw || '');
    if (bucket === 'hour') {
      const parts = str.split(' ');
      return parts[1] ? `${parts[1]}:00` : str;
    }
    if (bucket === 'week') return `W${str.split('-')[1] || str}`;
    if (bucket === 'month') return /^\d{4}-\d{2}$/.test(str) ? str.slice(5) : str;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str.slice(5);
    return str;
  };

  return (
    <div className={['rounded-3xl border border-gray-200 bg-white p-6 shadow-sm h-full flex flex-col', className || ''].join(' ')}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[16px] font-black text-gray-900">{title || 'Динамика'}</div>
          <div className="mt-1 text-[14px] text-gray-500">{subtitle || 'Пользователи (синий) • Объявления (черный)'}</div>
        </div>
        {headerRight ? <div className="sm:shrink-0 w-full sm:w-auto">{headerRight}</div> : null}
      </div>
      <div className="mt-4 xl:flex-1 flex flex-col">
        <div className="w-full overflow-x-auto flex-1">
          <div
            className="grid gap-2 items-stretch justify-start h-full"
            style={{ gridTemplateColumns: `repeat(${daily.length}, ${colWidth}px)`, minWidth: `${chartMinWidth}px` }}
          >
            {daily.map((d, idx) => {
              const usersH = Math.round((safeNum(d.newUsers) / maxUsers) * 100);
              const listingsH = Math.round((safeNum(d.newListings) / maxListings) * 100);
              return (
                <div key={d.date} className="flex flex-col items-center gap-2 h-full">
                  <div className="w-full flex items-end justify-center gap-1 flex-1 min-h-[140px]" title={`${d.date}: users ${d.newUsers}, listings ${d.newListings}`}>
                    <div className="w-[10px] rounded-t-md bg-sky-500" style={{ height: `${usersH}%` }} />
                    <div className="w-[10px] rounded-t-md bg-gray-900" style={{ height: `${listingsH}%` }} />
                  </div>
                  <div className="text-[11px] text-gray-500 tabular-nums">{idx % labelEvery === 0 ? formatLabel(d.date) : ' '}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const UserStatsPanel: React.FC<{
  userId: string;
  onClose: () => void;
  onGrantAdmin: (id: string) => void;
  onRevokeAdmin: (id: string) => void;
  onBan: (id: string, reason: string) => void;
  onUnban: (id: string) => void;
  currentUserId?: string;
}> = ({ userId, onClose, onGrantAdmin, onRevokeAdmin, onBan, onUnban, currentUserId }) => {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    marketAPI.getAdminUserStats(userId)
      .then((res) => setData(res))
      .catch((e) => setError(e?.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [userId]);

  const isSelf = currentUserId && String(currentUserId) === String(userId);

  const handleGrant = async () => {
    setActionLoading(true);
    try {
      await onGrantAdmin(userId);
      setData((prev: any) => prev ? { ...prev, user: { ...prev.user, isAdmin: true } } : prev);
      showMarketToast('Права администратора выданы');
    } finally { setActionLoading(false); }
  };

  const handleRevoke = async () => {
    setActionLoading(true);
    try {
      await onRevokeAdmin(userId);
      setData((prev: any) => prev ? { ...prev, user: { ...prev.user, isAdmin: false } } : prev);
      showMarketToast('Права администратора отозваны');
    } finally { setActionLoading(false); }
  };

  const handleBan = async () => {
    const reason = window.prompt('Причина блокировки (опционально):') ?? '';
    if (reason === null) return;
    setActionLoading(true);
    try {
      await onBan(userId, reason.trim());
      setData((prev: any) => prev ? { ...prev, user: { ...prev.user, isBanned: true, banReason: reason.trim() || null } } : prev);
      showMarketToast('Пользователь заблокирован');
    } finally { setActionLoading(false); }
  };

  const handleUnban = async () => {
    setActionLoading(true);
    try {
      await onUnban(userId);
      setData((prev: any) => prev ? { ...prev, user: { ...prev.user, isBanned: false, banReason: null } } : prev);
      showMarketToast('Пользователь разблокирован');
    } finally { setActionLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-3xl bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : error ? (
            <div className="text-red-600 text-[13px]">{error}</div>
          ) : data ? (
            <>
              <div className="flex items-center gap-4">
                {data.user?.profileImage ? (
                  <img src={data.user.profileImage} className="h-16 w-16 rounded-full object-cover" alt="" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[18px] font-black text-gray-900 truncate">{data.user?.name || data.user?.userName}</div>
                  <div className="text-[13px] text-gray-500">@{data.user?.userName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {data.user?.isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                        <Shield className="h-3 w-3" /> Администратор
                      </span>
                    )}
                    {data.user?.isBanned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                        <Ban className="h-3 w-3" /> Заблокирован
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600 capitalize">{data.user?.plan || 'free'}</span>
                  </div>
                </div>
              </div>

              {data.user?.isBanned && data.user?.banReason && (
                <div className="mt-3 rounded-2xl bg-red-50 px-4 py-2 text-[12px] text-red-700">
                  <span className="font-bold">Причина блокировки:</span> {data.user.banReason}
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Посты', value: data.stats?.posts },
                  { label: 'Loops', value: data.stats?.loops },
                  { label: 'Объявления', value: data.stats?.listings },
                  { label: 'Подписчики', value: data.stats?.followers },
                  { label: 'Подписки', value: data.stats?.following },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl bg-gray-50 p-3 text-center">
                    <div className="text-[20px] font-black text-gray-900 tabular-nums">{safeNum(value)}</div>
                    <div className="text-[11px] text-gray-500 font-medium">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-[13px] text-gray-600">
                <div><span className="font-bold text-gray-800">Email:</span> {data.user?.email}</div>
                <div><span className="font-bold text-gray-800">Зарегистрирован:</span> {formatDate(data.user?.createdAt)}</div>
                <div><span className="font-bold text-gray-800">Последний вход:</span> {data.user?.lastSeenAt ? formatDate(data.user.lastSeenAt) : '—'}</div>
              </div>

              {!isSelf && (
                <div className="mt-5 space-y-2">
                  <div className="flex gap-2">
                    {data.user?.isAdmin ? (
                      <button onClick={handleRevoke} disabled={actionLoading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-700 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-gray-800 disabled:opacity-50">
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                        Забрать права
                      </button>
                    ) : (
                      <button onClick={handleGrant} disabled={actionLoading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                        Сделать админом
                      </button>
                    )}
                    {data.user?.isBanned ? (
                      <button onClick={handleUnban} disabled={actionLoading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Разблокировать
                      </button>
                    ) : (
                      <button onClick={handleBan} disabled={actionLoading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-red-700 disabled:opacity-50">
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                        Заблокировать
                      </button>
                    )}
                  </div>
                  <button onClick={onClose} className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-[13px] font-bold text-gray-700 hover:bg-gray-50">
                    Закрыть
                  </button>
                </div>
              )}
              {isSelf && (
                <button onClick={onClose} className="mt-5 w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-[13px] font-bold text-gray-700 hover:bg-gray-50">
                  Закрыть
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const UsersSection: React.FC<{ currentUserId?: string }> = ({ currentUserId }) => {
  const [users, setUsers] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);

  const LIMIT = 20;

  const load = React.useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await marketAPI.getAdminUsers({ search: q, page: p, limit: LIMIT });
      setUsers(res.users || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(search, page); }, [load, search, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleGrantAdmin = async (id: string) => {
    await marketAPI.grantAdmin(id);
    setUsers((prev) => prev.map((u) => String(u._id) === id ? { ...u, isAdmin: true } : u));
  };

  const handleRevokeAdmin = async (id: string) => {
    await marketAPI.revokeAdmin(id);
    setUsers((prev) => prev.map((u) => String(u._id) === id ? { ...u, isAdmin: false } : u));
  };

  const handleBan = async (id: string, reason: string) => {
    await marketAPI.banUser(id, reason);
    setUsers((prev) => prev.map((u) => String(u._id) === id ? { ...u, isBanned: true } : u));
  };

  const handleUnban = async (id: string) => {
    await marketAPI.unbanUser(id);
    setUsers((prev) => prev.map((u) => String(u._id) === id ? { ...u, isBanned: false } : u));
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[16px] font-black text-gray-900">Пользователи</div>
          <div className="mt-1 text-[13px] text-gray-500">Всего: {total.toLocaleString()}</div>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по имени, email..."
              className="pl-9 pr-4 py-2 rounded-2xl border border-gray-200 bg-white text-[13px] font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 w-64"
            />
          </div>
          <button type="submit" className="rounded-2xl bg-black px-4 py-2 text-[13px] font-bold text-white hover:bg-gray-900">
            Найти
          </button>
        </form>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      ) : null}

      <div className="mt-4 rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : users.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-gray-500">Пользователи не найдены</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((user) => {
              const id = String(user._id || '');
              return (
                <div
                  key={id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedUserId(id)}
                >
                  {user.profileImage ? (
                    <img src={user.profileImage} className="h-10 w-10 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-gray-900 truncate">{user.name || user.userName}</span>
                      <span className="text-[12px] text-gray-500">@{user.userName}</span>
                      {user.isAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          <Shield className="h-3 w-3" /> Админ
                        </span>
                      )}
                      {user.isBanned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                          <Ban className="h-3 w-3" /> Заблокирован
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-gray-500 truncate">{user.email}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-bold text-gray-600 capitalize">{user.plan || 'free'}</div>
                    <div className="text-[11px] text-gray-400">{formatDate(user.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-2xl border border-gray-200 px-4 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-[13px] font-bold text-gray-700">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-2xl border border-gray-200 px-4 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}

      {selectedUserId && (
        <UserStatsPanel
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onGrantAdmin={handleGrantAdmin}
          onRevokeAdmin={handleRevokeAdmin}
          onBan={handleBan}
          onUnban={handleUnban}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};

export const AdminPage: React.FC<{
  isAdmin: boolean;
  onBack: () => void;
  currentUserId?: string;
}> = ({ isAdmin, onBack, currentUserId }) => {
  const [section, setSection] = React.useState<AdminSection>('dashboard');
  const [activeKind, setActiveKind] = React.useState<AdminKind>('cars');
  const [items, setItems] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [stats, setStats] = React.useState<any>(null);
  const [statsError, setStatsError] = React.useState('');
  const [statsLoading, setStatsLoading] = React.useState(false);
  const [range, setRange] = React.useState<'day' | 'week' | 'month' | 'half-year' | 'year'>('week');
  const [isLeaving, setIsLeaving] = React.useState(false);

  const RANGE_OPTIONS = [
    { key: 'day' as const, label: 'День' },
    { key: 'week' as const, label: 'Неделя' },
    { key: 'month' as const, label: 'Месяц' },
    { key: 'half-year' as const, label: 'Полгода' },
    { key: 'year' as const, label: 'Год' },
  ];

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await marketAPI.loadPendingModeration(activeKind);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeKind]);

  const loadStats = React.useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const data = await marketAPI.getAdminStats({ range });
      setStats(data);
    } catch (e: any) {
      setStats(null);
      setStatsError(e?.message || 'Не удалось загрузить статистику');
    } finally {
      setStatsLoading(false);
    }
  }, [range]);

  React.useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);
  React.useEffect(() => { if (isAdmin) void loadStats(); }, [isAdmin, loadStats]);

  const handleBack = React.useCallback(() => {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    if (reduceMotion) {
      onBack();
      return;
    }

    setIsLeaving(true);
    window.setTimeout(() => onBack(), 320);
  }, [onBack]);

  const handleApprove = async (mongoId: string) => {
    try {
      await marketAPI.approveModeration(activeKind, mongoId);
      setItems((prev) => prev.filter((i) => String(i?._id || '') !== mongoId));
      showMarketToast('Одобрено');
    } catch (e: any) {
      showMarketToast(e?.message || 'Не удалось одобрить');
    }
  };

  const handleReject = async (mongoId: string) => {
    const reason = window.prompt('Укажи причину отказа (опционально):') || '';
    const reasons = reason.trim() ? [reason.trim()] : [];
    try {
      await marketAPI.rejectModeration(activeKind, mongoId, reasons);
      setItems((prev) => prev.filter((i) => String(i?._id || '') !== mongoId));
      showMarketToast('Отклонено');
    } catch (e: any) {
      showMarketToast(e?.message || 'Не удалось отклонить');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="max-w-[520px] w-full rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            <div className="text-[18px] font-black text-gray-900">Доступ ограничен</div>
          </div>
          <div className="mt-2 text-[13px] text-gray-600 leading-6">Эта страница доступна только администратору.</div>
          <button onClick={onBack} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-5 py-3 text-[13px] font-bold text-white hover:bg-gray-900">
            <ArrowLeft className="h-4 w-4" />Назад
          </button>
        </div>
      </div>
    );
  }

  const statsUsers = stats?.users || {};
  const statsListings = stats?.listings || {};
  const byType = (statsListings?.byType || {}) as Record<string, any>;
  const generatedAt = typeof stats?.generatedAt === 'string' ? stats.generatedAt : '';
  const daily = Array.isArray(stats?.daily) ? stats.daily : [];
  const rangeLabel = typeof stats?.rangeLabel === 'string' ? stats.rangeLabel : '';
  const bucket = typeof stats?.bucket === 'string' ? stats.bucket : '';

  return (
    <motion.div
      className="min-h-screen bg-gray-50"
      initial={{ opacity: 0, y: 10 }}
      animate={isLeaving ? { opacity: 0, y: 10, scale: 0.992 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-[1536px] mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6">

        {/* Header */}
        <div className="relative">
          <div className="flex items-center justify-center h-11">
            <div className="text-[26px] font-black text-gray-900">Админка</div>
          </div>
          <button
            onClick={handleBack}
            type="button"
            className="absolute left-0 top-0 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-[13px] font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
            aria-label="Назад"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Назад</span>
          </button>
          {generatedAt ? (
            <div className="absolute right-0 top-0 h-11 flex items-center">
              <div className="hidden sm:block text-[13px] text-gray-500">
                Обновлено в <span className="font-bold text-gray-700">{formatTime(generatedAt)}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Section tabs */}
        <div className="mt-5 flex items-center justify-center">
          <SegmentedControl
            ariaLabel="Раздел админки"
            options={SECTIONS}
            value={section}
            onChange={(next) => setSection(next)}
          />
        </div>

        <div className="mt-6">
          {/* Dashboard */}
          {section === 'dashboard' && (
            <div>
              <div className="text-[16px] font-black text-gray-900">Статистика</div>
              <div className="mt-1 text-[13px] text-gray-500">Ключевые показатели за сегодня и активность пользователей.</div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="Новые пользователи сегодня" value={safeNum(statsUsers?.newToday)} subtitle={`Всего: ${safeNum(statsUsers?.total).toLocaleString()}`} Icon={Users} />
                <StatCard title="Активные пользователи (24ч)" value={safeNum(statsUsers?.active24h)} subtitle={`За 7 дней: ${safeNum(statsUsers?.active7d).toLocaleString()}`} Icon={Activity} />
                <StatCard title="Новых объявлений сегодня" value={safeNum(statsListings?.newToday)} subtitle={`Всего: ${safeNum(statsListings?.total).toLocaleString()}`} Icon={BarChart3} />
                <StatCard title="На модерации" value={safeNum(statsListings?.pending)} subtitle="Объявления со статусом pending" Icon={ClipboardList} />
              </div>

              {statsError ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">{statsError}</div> : null}

              <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
                {daily.length ? (
                  <div className="xl:col-span-8 h-full">
                    <MiniBars
                      daily={daily}
                      title={rangeLabel ? `Динамика • ${rangeLabel}` : 'Динамика'}
                      subtitle="Пользователи (синий) • Объявления (черный)"
                      bucket={bucket}
                      headerRight={
                        <div className="flex items-center justify-end">
                          <SegmentedControl
                            options={RANGE_OPTIONS}
                            value={range}
                            onChange={(next) => setRange(next)}
                            ariaLabel="Диапазон"
                          />
                        </div>
                      }
                    />
                  </div>
                ) : null}

                <div className={daily.length ? 'xl:col-span-4 h-full' : 'xl:col-span-12 h-full'}>
                  <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm h-full">
                    <div className="text-[15px] font-black text-gray-900">Сводка по разделам</div>
                    <div className="mt-1 text-[13px] text-gray-500">Всего • Сегодня • Pending</div>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100">
                      <div className="hidden sm:block">
                        <div className="grid grid-cols-[1fr_84px_84px_92px] gap-2 bg-gray-50 px-4 py-2 text-[12px] font-bold text-gray-600">
                          <div>Раздел</div><div className="text-right">Всего</div><div className="text-right">Сегодня</div><div className="text-right">Pending</div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {KINDS.map(({ kind, label }) => {
                            const row = byType?.[kind] || {};
                            return (
                              <div key={kind} className="grid grid-cols-[1fr_84px_84px_92px] gap-2 px-4 py-3 text-[13px] text-gray-700 hover:bg-gray-50">
                                <div className="font-bold text-gray-900">{label}</div>
                                <div className="text-right tabular-nums font-semibold">{safeNum(row.total)}</div>
                                <div className="text-right tabular-nums font-semibold">{safeNum(row.newToday)}</div>
                                <div className="text-right">
                                  <span className="inline-flex min-w-[44px] justify-center rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-bold text-amber-800 tabular-nums">{safeNum(row.pending)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Moderation */}
          {section === 'moderation' && (
            <div>
              <div className="text-[16px] font-black text-gray-900">Модерация</div>
              <div className="mt-1 text-[13px] text-gray-500">Выбери раздел и обработай объявления «На проверке».</div>

              <div className="mt-5 flex flex-wrap gap-2">
                {KINDS.map(({ kind, label }) => {
                  const active = activeKind === kind;
                  const pending = safeNum(byType?.[kind]?.pending);
                  return (
                    <button
                      key={kind}
                      onClick={() => setActiveKind(kind)}
                      className={['rounded-2xl px-4 py-2 text-[13px] font-bold transition-colors inline-flex items-center gap-2', active ? 'bg-black text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'].join(' ')}
                    >
                      {label}
                      {pending ? <span className={['rounded-full px-2 py-0.5 text-[11px] font-black', active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'].join(' ')}>{pending}</span> : null}
                    </button>
                  );
                })}
                <button
                  onClick={() => { void load(); void loadStats(); }}
                  className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-black"
                >
                  {isLoading || statsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Обновить
                </button>
              </div>

              {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">{error}</div> : null}

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map((item) => {
                  const mongoId = String(item?._id || '');
                  const title = resolveTitle(item);
                  const imageUrl = resolveImage(item);
                  const meta = resolveMeta(item);
                  return (
                    <div key={mongoId} className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                      {imageUrl ? <div className="h-[170px] bg-gray-100"><img src={imageUrl} alt={title} className="h-full w-full object-cover" /></div> : null}
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-black text-gray-900">{title}</div>
                            <div className="mt-1 text-[12px] text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                              {meta.location ? <span>{meta.location}</span> : null}
                              {meta.nickname ? <span className="text-gray-500">{meta.nickname}</span> : null}
                              {meta.authorName ? <span className="text-gray-500">@{meta.authorName}</span> : null}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-black text-yellow-800">На проверке</div>
                        </div>
                        {Array.isArray(item?.moderationReasons) && item.moderationReasons.length ? (
                          <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-[12px] text-gray-700">
                            <div className="font-bold text-gray-900 mb-1">Причины</div>
                            <ul className="list-disc pl-5 space-y-1">{item.moderationReasons.slice(0, 4).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                          </div>
                        ) : null}
                        <div className="mt-4 flex items-center gap-2">
                          <button onClick={() => void handleApprove(mongoId)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />Одобрить
                          </button>
                          <button onClick={() => void handleReject(mongoId)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-red-700">
                            <XCircle className="h-4 w-4" />Отклонить
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isLoading && items.length === 0 ? (
                <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-10 text-center">
                  <div className="text-[16px] font-black text-gray-900">Нет объявлений на проверке</div>
                  <div className="mt-2 text-[13px] text-gray-600">Выбери раздел или нажми «Обновить».</div>
                </div>
              ) : null}
            </div>
          )}

          {/* Users */}
          {section === 'users' && <UsersSection currentUserId={currentUserId} />}
        </div>
      </div>
    </motion.div>
  );
};
