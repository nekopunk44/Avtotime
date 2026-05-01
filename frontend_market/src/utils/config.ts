const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const normalizeApiUrl = (raw: unknown) => {
  if (typeof raw !== 'string') return '/api';

  const trimmed = trimTrailingSlashes(raw.trim());
  if (!trimmed) return '/api';

  // Accept already-correct values
  if (trimmed === '/api' || trimmed.endsWith('/api')) return trimmed;

  // If the user configured only the origin (e.g. http://localhost:8000), append /api
  return `${trimmed}/api`;
};

const getRuntimeApiOverride = (): string | null => {
  if (typeof window === 'undefined') return null;
  const value = (window as any)?.__MARKET_API_URL__;
  if (typeof value !== 'string') return null;
  const trimmed = trimTrailingSlashes(value.trim());
  return trimmed ? normalizeApiUrl(trimmed) : null;
};

// Prefer same-origin proxy by default (cookies work with SameSite=Lax).
export const API_URL = getRuntimeApiOverride() ?? normalizeApiUrl(import.meta.env.VITE_API_URL);
