import { API_URL } from './config';
import type {
  AutoTuningCreatePayload,
  AutoTuningListing,
  AppNotification,
  Car,
  CarServiceCreatePayload,
  CarServiceListing,
  ConsultationExpert,
  DryCleaningCreatePayload,
  DryCleaningListing,
} from '../types';

class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const buildApiError = async (res: Response): Promise<ApiError> => {
  let data: any = null;
  let message = `${res.status} ${res.statusText} (${res.url})`.trim();
  try {
    data = await res.json();
    if (typeof data?.message === 'string' && data.message) {
      message = data.message;
    }
  } catch {
    // body не JSON — оставляем дефолтное сообщение
  }
  return new ApiError(message, res.status, data);
};

const ensureOkJson = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    throw await buildApiError(res);
  }
  return (await res.json()) as T;
};

const ensureOk = async (res: Response): Promise<void> => {
  if (!res.ok) {
    throw await buildApiError(res);
  }
};

const appendIfDefined = (form: FormData, key: string, value: unknown) => {
  if (value === undefined || value === null) return;
  const str = typeof value === 'string' ? value : String(value);
  if (!str.trim()) return;
  form.append(key, str);
};

const DEFAULT_PUBLIC_MARKET_LIMIT = 60;
const DEFAULT_MINE_MARKET_LIMIT = 200;

export interface CarFilters {
  q?: string;
  type?: string;
  brand?: string | string[];
  model?: string | string[];
  yearFrom?: number | string;
  yearTo?: number | string;
  priceMin?: number | string;
  priceMax?: number | string;
  mileageMin?: number | string;
  mileageMax?: number | string;
  fuel?: string | string[];
  gearbox?: string | string[];
  bodyType?: string | string[];
  driveType?: string;
  seats?: string;
  region?: string;
  registrationPlace?: string;
}

export interface PartFilters {
  q?: string;
  type?: string;
  brand?: string | string[];
  model?: string | string[];
  yearFrom?: number | string;
  yearTo?: number | string;
  priceMin?: number | string;
  priceMax?: number | string;
  region?: string;
  partCategoryKey?: string;
  partGroup?: string;
}

export interface ServiceFilters {
  q?: string;
  category?: string;
  location?: string;
  priceMin?: number | string;
  priceMax?: number | string;
  minQuality?: number | string;
}

export interface ConsultationFilters {
  q?: string;
  location?: string;
  specialties?: string | string[];
  minRate?: number | string;
  maxRate?: number | string;
  isVerified?: boolean;
}

const serializeFilters = (f: Record<string, unknown>): URLSearchParams => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      v.forEach((item) => { if (item != null && item !== '') p.append(k, String(item)); });
    } else {
      p.set(k, String(v));
    }
  }
  return p;
};

const buildMarketListSuffix = (options?: { mine?: boolean; filters?: Record<string, unknown> }) => {
  const params = serializeFilters(options?.filters || {});
  if (options?.mine) {
    params.set('mine', '1');
    params.set('limit', String(DEFAULT_MINE_MARKET_LIMIT));
  } else if (!params.has('limit')) {
    params.set('limit', String(DEFAULT_PUBLIC_MARKET_LIMIT));
  }
  return `?${params.toString()}`;
};

export const marketAPI = {
  async getAdminStatus(): Promise<{ ok: boolean; isAdmin: boolean; userId?: string; userName?: string }> {
    const res = await fetch(`${API_URL}/admin/status`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<{ ok: boolean; isAdmin: boolean; userId?: string; userName?: string }>(res);
  },

  async getAdminStats(options?: { range?: 'day' | 'week' | 'month' | 'half-year' | 'year' }): Promise<{
    ok: boolean;
    generatedAt?: string;
    range?: string;
    rangeLabel?: string;
    bucket?: string;
    users?: { total?: number; newToday?: number; new7d?: number; active24h?: number; active7d?: number };
    listings?: {
      total?: number;
      newToday?: number;
      pending?: number;
      byType?: Record<string, { total?: number; newToday?: number; pending?: number; approved?: number; rejected?: number }>;
    };
    daily?: Array<{ date: string; newUsers: number; newListings: number }>;
  }> {
    const params = new URLSearchParams();
    if (options?.range) params.set('range', options.range);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/admin/stats${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson(res);
  },

  async loadPendingModeration(kind: string): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('type', kind);
    const res = await fetch(`${API_URL}/admin/market/pending?${params.toString()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<any[]>(res);
  },

  async approveModeration(kind: string, mongoId: string): Promise<any> {
    const res = await fetch(`${API_URL}/admin/market/${encodeURIComponent(kind)}/${encodeURIComponent(mongoId)}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<any>(res);
  },

  async rejectModeration(kind: string, mongoId: string, reasons?: string[]): Promise<any> {
    const res = await fetch(`${API_URL}/admin/market/${encodeURIComponent(kind)}/${encodeURIComponent(mongoId)}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ reasons: Array.isArray(reasons) ? reasons : [] }),
    });
    return ensureOkJson<any>(res);
  },

  async loadNotifications(options?: { isRead?: boolean }): Promise<AppNotification[]> {
    const params = new URLSearchParams();
    if (options?.isRead === true) params.set('isRead', 'true');
    if (options?.isRead === false) params.set('isRead', 'false');
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_URL}/notifications${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<AppNotification[]>(res);
  },

  async loadUnreadNotificationsCount(): Promise<number> {
    const res = await fetch(`${API_URL}/notifications/count/unread`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const data = await ensureOkJson<{ unreadCount?: number }>(res);
    return Number(data?.unreadCount ?? 0) || 0;
  },

  async markNotificationRead(notificationId: string): Promise<AppNotification> {
    const res = await fetch(
      `${API_URL}/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }
    );
    return ensureOkJson<AppNotification>(res);
  },

  async markAllNotificationsRead(): Promise<void> {
    const res = await fetch(`${API_URL}/notifications/mark-all-read`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await ensureOk(res);
  },

  async loadCars(options?: { mine?: boolean; filters?: CarFilters }): Promise<Car[]> {
    const suffix = buildMarketListSuffix({ mine: options?.mine, filters: options?.filters as Record<string, unknown> });
    const res = await fetch(`${API_URL}/market/cars${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<Car[]>(res);
  },

  async loadParts(options?: { mine?: boolean; filters?: PartFilters }): Promise<Car[]> {
    const suffix = buildMarketListSuffix({ mine: options?.mine, filters: options?.filters as Record<string, unknown> });
    const res = await fetch(`${API_URL}/market/parts${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<Car[]>(res);
  },

  async updateCar(mongoId: string, patch: Partial<Record<string, unknown>>): Promise<Car> {
    const form = new FormData();
    Object.entries(patch || {}).forEach(([key, value]) => appendIfDefined(form, key, value));

    const res = await fetch(`${API_URL}/market/cars/${encodeURIComponent(mongoId)}`, {
      method: 'PATCH',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<Car>(res);
  },

  async deleteCar(mongoId: string): Promise<void> {
    const res = await fetch(`${API_URL}/market/cars/${encodeURIComponent(mongoId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await ensureOk(res);
  },

  async createCar(listing: {
    offerType: string;
    brand: string;
    model: string;
    year: string;
    mileage: string;
    fuel: string;
    body: string;
    drive: string;
    gearbox: string;
    engineVolume: string;
    seats: string;
    registration: string;
    region: string;
    price: string;
    currency: string;
    title: string;
    description: string;
    images: File[];
    videoUrl?: string;
  }): Promise<Car> {
    const form = new FormData();
    appendIfDefined(form, 'offerType', listing.offerType);
    appendIfDefined(form, 'brand', listing.brand);
    appendIfDefined(form, 'model', listing.model);
    appendIfDefined(form, 'year', listing.year);
    appendIfDefined(form, 'mileage', listing.mileage);
    appendIfDefined(form, 'fuel', listing.fuel);
    appendIfDefined(form, 'body', listing.body);
    appendIfDefined(form, 'drive', listing.drive);
    appendIfDefined(form, 'gearbox', listing.gearbox);
    appendIfDefined(form, 'engineVolume', listing.engineVolume);
    appendIfDefined(form, 'seats', listing.seats);
    appendIfDefined(form, 'registration', listing.registration);
    appendIfDefined(form, 'region', listing.region);
    appendIfDefined(form, 'price', listing.price);
    appendIfDefined(form, 'currency', listing.currency);
    appendIfDefined(form, 'title', listing.title);
    appendIfDefined(form, 'description', listing.description);
    appendIfDefined(form, 'videoUrl', listing.videoUrl);

    const files = Array.isArray(listing.images) ? listing.images : [];
    for (const file of files) {
      form.append('images', file);
    }

    const res = await fetch(`${API_URL}/market/cars`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<Car>(res);
  },

  async createPart(listing: {
    offerType: string;
    brand: string;
    model: string;
    year: string;
    region: string;
    price: string;
    currency: string;
    title: string;
    description: string;
    partGroup: string;
    partCategory: string;
    partCategoryKey?: string;
    images: File[];
    videoUrl?: string;
  }): Promise<Car> {
    const form = new FormData();
    appendIfDefined(form, 'offerType', listing.offerType);
    appendIfDefined(form, 'brand', listing.brand);
    appendIfDefined(form, 'model', listing.model);
    appendIfDefined(form, 'year', listing.year);
    appendIfDefined(form, 'region', listing.region);
    appendIfDefined(form, 'price', listing.price);
    appendIfDefined(form, 'currency', listing.currency);
    appendIfDefined(form, 'title', listing.title);
    appendIfDefined(form, 'description', listing.description);
    appendIfDefined(form, 'partGroup', listing.partGroup);
    appendIfDefined(form, 'partCategory', listing.partCategory);
    appendIfDefined(form, 'partCategoryKey', listing.partCategoryKey);
    appendIfDefined(form, 'videoUrl', listing.videoUrl);

    const files = Array.isArray(listing.images) ? listing.images : [];
    for (const file of files) {
      form.append('images', file);
    }

    const res = await fetch(`${API_URL}/market/parts`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<Car>(res);
  },

  async updatePart(mongoId: string, patch: Partial<Record<string, unknown>>): Promise<Car> {
    const form = new FormData();
    Object.entries(patch || {}).forEach(([key, value]) => appendIfDefined(form, key, value));

    const res = await fetch(`${API_URL}/market/parts/${encodeURIComponent(mongoId)}`, {
      method: 'PATCH',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<Car>(res);
  },

  async deletePart(mongoId: string): Promise<void> {
    const res = await fetch(`${API_URL}/market/parts/${encodeURIComponent(mongoId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await ensureOk(res);
  },

  async loadCarServices(options?: { mine?: boolean; filters?: ServiceFilters }): Promise<CarServiceListing[]> {
    const suffix = buildMarketListSuffix({ mine: options?.mine, filters: options?.filters as Record<string, unknown> });
    const res = await fetch(`${API_URL}/market/car-services${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<CarServiceListing[]>(res);
  },

  async updateCarService(mongoId: string, patch: Partial<Record<string, unknown>>): Promise<CarServiceListing> {
    const form = new FormData();
    Object.entries(patch || {}).forEach(([key, value]) => appendIfDefined(form, key, value));

    const res = await fetch(`${API_URL}/market/car-services/${encodeURIComponent(mongoId)}`, {
      method: 'PATCH',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<CarServiceListing>(res);
  },

  async deleteCarService(mongoId: string): Promise<void> {
    const res = await fetch(`${API_URL}/market/car-services/${encodeURIComponent(mongoId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await ensureOk(res);
  },

  async createCarService(service: CarServiceCreatePayload): Promise<CarServiceListing> {
    const form = new FormData();
    appendIfDefined(form, 'category', service.category);
    appendIfDefined(form, 'title', service.title);
    appendIfDefined(form, 'location', service.location);
    appendIfDefined(form, 'serviceQuality', service.serviceQuality);
    appendIfDefined(form, 'reviews', service.reviews);
    appendIfDefined(form, 'price', service.price);
    appendIfDefined(form, 'pricePrefix', service.pricePrefix);
    appendIfDefined(form, 'unit', service.unit);

    if (service.imageFile) {
      form.append('image', service.imageFile);
    } else {
      appendIfDefined(form, 'image', service.image);
    }

    const res = await fetch(`${API_URL}/market/car-services`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<CarServiceListing>(res);
  },

  async loadAutoTuning(options?: { mine?: boolean; filters?: ServiceFilters }): Promise<AutoTuningListing[]> {
    const suffix = buildMarketListSuffix({ mine: options?.mine, filters: options?.filters as Record<string, unknown> });
    const res = await fetch(`${API_URL}/market/auto-tuning${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<AutoTuningListing[]>(res);
  },

  async updateAutoTuning(mongoId: string, patch: Partial<Record<string, unknown>>): Promise<AutoTuningListing> {
    const form = new FormData();
    Object.entries(patch || {}).forEach(([key, value]) => appendIfDefined(form, key, value));

    const res = await fetch(`${API_URL}/market/auto-tuning/${encodeURIComponent(mongoId)}`, {
      method: 'PATCH',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<AutoTuningListing>(res);
  },

  async deleteAutoTuning(mongoId: string): Promise<void> {
    const res = await fetch(`${API_URL}/market/auto-tuning/${encodeURIComponent(mongoId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await ensureOk(res);
  },

  async createAutoTuning(listing: AutoTuningCreatePayload): Promise<AutoTuningListing> {
    const form = new FormData();
    appendIfDefined(form, 'title', listing.title);
    appendIfDefined(form, 'category', listing.category);
    appendIfDefined(form, 'location', listing.location);
    appendIfDefined(form, 'rating', listing.rating);
    appendIfDefined(form, 'reviews', listing.reviews);
    appendIfDefined(form, 'price', listing.price);
    appendIfDefined(form, 'badge', listing.badge);
    appendIfDefined(form, 'tags', JSON.stringify(listing.tags || []));

    if (listing.imageFile) {
      form.append('image', listing.imageFile);
    } else {
      appendIfDefined(form, 'image', listing.image);
    }

    const res = await fetch(`${API_URL}/market/auto-tuning`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<AutoTuningListing>(res);
  },

  async loadConsultations(options?: { mine?: boolean; filters?: ConsultationFilters }): Promise<ConsultationExpert[]> {
    const suffix = buildMarketListSuffix({ mine: options?.mine, filters: options?.filters as Record<string, unknown> });

    const res = await fetch(`${API_URL}/market/consultations${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<ConsultationExpert[]>(res);
  },

  async updateConsultation(mongoId: string, patch: Partial<Record<string, unknown>>): Promise<ConsultationExpert> {
    const form = new FormData();
    Object.entries(patch || {}).forEach(([key, value]) => appendIfDefined(form, key, value));

    const res = await fetch(`${API_URL}/market/consultations/${encodeURIComponent(mongoId)}`, {
      method: 'PATCH',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<ConsultationExpert>(res);
  },

  async deleteConsultation(mongoId: string): Promise<void> {
    const res = await fetch(`${API_URL}/market/consultations/${encodeURIComponent(mongoId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await ensureOk(res);
  },

  async loadDryCleaning(options?: { mine?: boolean; filters?: ServiceFilters }): Promise<DryCleaningListing[]> {
    const suffix = buildMarketListSuffix({ mine: options?.mine, filters: options?.filters as Record<string, unknown> });

    const res = await fetch(`${API_URL}/market/dry-cleaning${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson<DryCleaningListing[]>(res);
  },

  async updateDryCleaning(mongoId: string, patch: Partial<Record<string, unknown>>): Promise<DryCleaningListing> {
    const form = new FormData();
    Object.entries(patch || {}).forEach(([key, value]) => appendIfDefined(form, key, value));

    const res = await fetch(`${API_URL}/market/dry-cleaning/${encodeURIComponent(mongoId)}`, {
      method: 'PATCH',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<DryCleaningListing>(res);
  },

  async deleteDryCleaning(mongoId: string): Promise<void> {
    const res = await fetch(`${API_URL}/market/dry-cleaning/${encodeURIComponent(mongoId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await ensureOk(res);
  },

  async createDryCleaning(listing: DryCleaningCreatePayload): Promise<DryCleaningListing> {
    const form = new FormData();
    appendIfDefined(form, 'title', listing.title);
    appendIfDefined(form, 'category', listing.category);
    appendIfDefined(form, 'location', listing.location);
    appendIfDefined(form, 'rating', listing.rating);
    appendIfDefined(form, 'reviews', listing.reviews);
    appendIfDefined(form, 'price', listing.price);
    appendIfDefined(form, 'badge', listing.badge);
    appendIfDefined(form, 'tags', JSON.stringify(listing.tags || []));

    if (listing.imageFile) {
      form.append('image', listing.imageFile);
    } else {
      appendIfDefined(form, 'image', listing.image);
    }

    const res = await fetch(`${API_URL}/market/dry-cleaning`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<DryCleaningListing>(res);
  },

  async saveProfile(data: {
    name?: string;
    userName?: string;
    bio?: string;
    profession?: string;
    gender?: string;
    location?: string;
    phone?: string;
    address?: string;
    region?: string;
    preferredContact?: string;
  }): Promise<Record<string, unknown>> {
    const form = new FormData();
    (Object.entries(data) as [string, unknown][]).forEach(([k, v]) => appendIfDefined(form, k, v));
    const res = await fetch(`${API_URL}/user/editProfile`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    return ensureOkJson<Record<string, unknown>>(res);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_URL}/user/changePassword`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    await ensureOk(res);
  },

  async logoutAll(): Promise<void> {
    const res = await fetch(`${API_URL}/user/logoutAll`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await ensureOk(res);
  },

  async setPlan(plan: 'free' | 'pro' | 'business'): Promise<{
    plan: string;
    effectivePlan: string;
    planActivatedAt: string | null;
    planExpiresAt: string | null;
    planLimits: any;
  }> {
    const res = await fetch(`${API_URL}/user/plan`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ plan }),
    });
    return ensureOkJson(res);
  },

  async createPaymentIntent(plan: 'pro' | 'business'): Promise<{
    clientSecret: string;
    publishableKey: string;
    amount: number;
    currency: string;
    label: string;
  }> {
    const res = await fetch(`${API_URL}/payment/create-intent`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ plan }),
    });
    return ensureOkJson(res);
  },

  async confirmPayment(paymentIntentId: string): Promise<{
    plan: string;
    effectivePlan?: string;
    planActivatedAt?: string | null;
    planExpiresAt?: string | null;
    planLimits?: any;
  }> {
    const res = await fetch(`${API_URL}/payment/confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ paymentIntentId }),
    });
    return ensureOkJson(res);
  },

  async getPaymentStatus(): Promise<{
    plan: string;
    planExpiresAt: string | null;
    planActivatedAt: string | null;
    payments: Array<{ plan: string; amount: number; currency: string; createdAt: string; status: string }>;
  }> {
    const res = await fetch(`${API_URL}/payment/status`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson(res);
  },

  async recordListingView(type: 'cars' | 'parts', id: number): Promise<void> {
    try {
      await fetch(`${API_URL}/market/${type}/${encodeURIComponent(String(id))}/view`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
    } catch {
      // analytics tracking is best-effort; never throw
    }
  },

  async recordListingLead(type: 'cars' | 'parts', id: number): Promise<void> {
    try {
      await fetch(`${API_URL}/market/${type}/${encodeURIComponent(String(id))}/lead`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
    } catch {
      // ignore
    }
  },

  async getMarketAnalyticsSummary(): Promise<{
    effectivePlan: string;
    days: string[];
    dailyTotals: Array<{ day: string; views: number; leads: number }>;
    totals: { viewsTotal: number; leadsTotal: number; last7DaysViews: number; last7DaysLeads: number };
    listings: Array<{
      kind: 'cars' | 'parts';
      id: number;
      _id: string;
      title: string;
      image: string;
      viewsTotal: number;
      leadsTotal: number;
      last7DaysViews: number;
      last7DaysLeads: number;
      series: Array<{ day: string; views: number; leads: number }>;
    }>;
  }> {
    const res = await fetch(`${API_URL}/market/analytics/summary`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson(res);
  },

  async getAdminUsers(options?: { search?: string; page?: number; limit?: number }): Promise<{
    ok: boolean;
    users: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const params = new URLSearchParams();
    if (options?.search) params.set('search', options.search);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/admin/users${suffix}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson(res);
  },

  async getAdminUserStats(userId: string): Promise<{
    ok: boolean;
    user: any;
    stats: { posts: number; loops: number; listings: number; followers: number; following: number };
  }> {
    const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson(res);
  },

  async grantAdmin(userId: string): Promise<{ ok: boolean; user: any }> {
    const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/grant-admin`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson(res);
  },

  async revokeAdmin(userId: string): Promise<{ ok: boolean; user: any }> {
    const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/revoke-admin`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson(res);
  },

  async banUser(userId: string, reason?: string): Promise<{ ok: boolean; user: any }> {
    const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/ban`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ reason: reason || '' }),
    });
    return ensureOkJson(res);
  },

  async unbanUser(userId: string): Promise<{ ok: boolean; user: any }> {
    const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/unban`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return ensureOkJson(res);
  },
};
