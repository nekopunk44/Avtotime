import client, { API_URL } from './client';

export type PlanKey = 'free' | 'pro' | 'business';

export interface PlanLimits {
  maxListings: number | null;
  maxPhotos: number | null;
  maxDescriptionLen: number | null;
  listingDays: number | null;
  priority: number;
  phoneVisible: boolean;
  analyticsEnabled: boolean;
  videoEnabled: boolean;
  badge: string | null;
}

export interface PaymentRow {
  _id?: string;
  plan: PlanKey | string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | string;
  createdAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface BillingStatus {
  plan: PlanKey | string;
  effectivePlan?: PlanKey | string;
  planActivatedAt: string | null;
  planExpiresAt: string | null;
  payments: PaymentRow[];
}

export interface SetPlanResult {
  plan: PlanKey | string;
  effectivePlan: PlanKey | string;
  planActivatedAt: string | null;
  planExpiresAt: string | null;
  planLimits: PlanLimits;
}

export const WEB_TARIFFS_URL = `${API_URL}/market?view=tariffs`;

export async function getBillingStatus(): Promise<BillingStatus> {
  const { data } = await client.get('/payment/status');
  return {
    plan: data?.plan || 'free',
    effectivePlan: data?.effectivePlan || data?.plan || 'free',
    planActivatedAt: data?.planActivatedAt || null,
    planExpiresAt: data?.planExpiresAt || null,
    payments: Array.isArray(data?.payments) ? data.payments : [],
  };
}

export async function setFreePlan(): Promise<SetPlanResult> {
  const { data } = await client.patch('/user/plan', { plan: 'free' });
  return data;
}

export async function getPaymentGeo(): Promise<{ country: string | null; isCis: boolean }> {
  const { data } = await client.get('/payment/geo');
  return {
    country: data?.country || null,
    isCis: !!data?.isCis,
  };
}

// ── Подписки через сторы ────────────────────────────────────────────────────

export interface StoreBillingConfig {
  google: boolean;
  apple: boolean;
}

export type StorePurchaseProof =
  | { platform: 'google'; purchaseToken: string }
  | { platform: 'apple'; receipt: string };

export interface StorePlanResult {
  plan: PlanKey | string;
  effectivePlan: PlanKey | string;
  planActivatedAt: string | null;
  planExpiresAt: string | null;
  planLimits: PlanLimits;
}

/** Какие платформы реально настроены на сервере — остальное экран прячет. */
export async function getStoreBillingConfig(): Promise<StoreBillingConfig> {
  const { data } = await client.get('/payment/store/config');
  return { google: !!data?.google, apple: !!data?.apple };
}

/**
 * Отдаёт токен покупки серверу; тариф выдаётся только по ответу стора на
 * СЕРВЕРНЫЙ запрос — содержимому клиента бэкенд не верит.
 */
export async function verifyStorePurchase(proof: StorePurchaseProof): Promise<StorePlanResult> {
  const { data } = await client.post('/payment/store/verify', proof);
  return data;
}
