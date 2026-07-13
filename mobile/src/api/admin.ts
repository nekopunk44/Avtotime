import client from './client';
import { User } from './auth';
import { MarketCategoryId, MarketListing } from './market';

export type AdminRange = 'day' | 'week' | 'month' | 'half-year' | 'year';

export interface AdminStatus {
  ok: boolean;
  isAdmin: boolean;
  userId: string;
  userName: string;
}

export interface AdminStats {
  ok: boolean;
  generatedAt: string;
  range: AdminRange;
  rangeLabel?: string;
  bucket?: string;
  users: {
    total: number;
    newToday: number;
    new7d: number;
    active24h: number;
    active7d: number;
  };
  listings: {
    total: number;
    newToday: number;
    pending: number;
    byType: Record<string, {
      total: number;
      newToday: number;
      pending: number;
      approved: number;
      rejected: number;
    }>;
  };
  daily: Array<{ date: string; newUsers: number; newListings: number }>;
}

export interface AdminUser extends User {
  email?: string;
  createdAt?: string;
  lastSeenAt?: string;
  posts?: unknown[];
  loops?: unknown[];
}

export interface AdminUsersPage {
  ok: boolean;
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUserDetails {
  ok: boolean;
  user: AdminUser;
  stats: {
    posts: number;
    loops: number;
    listings: number;
    followers: number;
    following: number;
  };
}

export async function getAdminStatus(): Promise<AdminStatus> {
  const { data } = await client.get('/admin/status');
  return {
    ok: !!data?.ok,
    isAdmin: !!data?.isAdmin,
    userId: String(data?.userId || ''),
    userName: String(data?.userName || ''),
  };
}

export async function getAdminStats(range: AdminRange = 'week'): Promise<AdminStats> {
  const { data } = await client.get('/admin/stats', { params: { range } });
  return data;
}

export async function getPendingMarketListings(type: MarketCategoryId): Promise<MarketListing[]> {
  const { data } = await client.get('/admin/market/pending', { params: { type } });
  return Array.isArray(data) ? data : [];
}

export async function getAppealedMarketListings(type: MarketCategoryId): Promise<MarketListing[]> {
  const { data } = await client.get('/admin/market/appeals', { params: { type } });
  return Array.isArray(data) ? data : [];
}

export async function approveMarketListing(type: MarketCategoryId, id: string): Promise<MarketListing> {
  const { data } = await client.post(`/admin/market/${type}/${encodeURIComponent(id)}/approve`);
  return data;
}

export async function rejectMarketListing(type: MarketCategoryId, id: string, reason: string): Promise<MarketListing> {
  const { data } = await client.post(`/admin/market/${type}/${encodeURIComponent(id)}/reject`, {
    reasons: [reason],
  });
  return data;
}

export async function getAdminUsers(search = '', page = 1, limit = 20): Promise<AdminUsersPage> {
  const { data } = await client.get('/admin/users', {
    params: { search: search.trim(), page, limit },
  });
  return {
    ok: !!data?.ok,
    users: Array.isArray(data?.users) ? data.users : [],
    total: Number(data?.total || 0),
    page: Number(data?.page || page),
    limit: Number(data?.limit || limit),
  };
}

export async function getAdminUserDetails(userId: string): Promise<AdminUserDetails> {
  const { data } = await client.get(`/admin/users/${encodeURIComponent(userId)}`);
  return {
    ok: !!data?.ok,
    user: data?.user,
    stats: {
      posts: Number(data?.stats?.posts || 0),
      loops: Number(data?.stats?.loops || 0),
      listings: Number(data?.stats?.listings || 0),
      followers: Number(data?.stats?.followers || 0),
      following: Number(data?.stats?.following || 0),
    },
  };
}

export async function grantAdmin(userId: string): Promise<AdminUser> {
  const { data } = await client.post(`/admin/users/${encodeURIComponent(userId)}/grant-admin`);
  return data?.user ?? data;
}

export async function revokeAdmin(userId: string): Promise<AdminUser> {
  const { data } = await client.post(`/admin/users/${encodeURIComponent(userId)}/revoke-admin`);
  return data?.user ?? data;
}

export async function banUser(userId: string, reason = 'Нарушение правил Avtotime'): Promise<AdminUser> {
  const { data } = await client.post(`/admin/users/${encodeURIComponent(userId)}/ban`, { reason });
  return data?.user ?? data;
}

export async function unbanUser(userId: string): Promise<AdminUser> {
  const { data } = await client.post(`/admin/users/${encodeURIComponent(userId)}/unban`);
  return data?.user ?? data;
}
