import client from './client';
import * as SecureStore from 'expo-secure-store';

export type UserRef = string | { _id: string; userName?: string; name?: string; profileImage?: string };
export type SavedPostRef = string | { _id: string; media?: string; mediaList?: string[]; caption?: string; author?: UserRef };

export interface User {
  _id: string;
  userName: string;
  name: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  website?: string;
  instagram?: string;
  telegram?: string;
  profession?: string;
  gender?: string;
  phone?: string;
  address?: string;
  region?: string;
  preferredContact?: string;
  plan?: string;
  effectivePlan?: string;
  planExpiresAt?: string | null;
  planActivatedAt?: string | null;
  planLimits?: any;
  email?: string;
  isEmailVerified?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  banReason?: string | null;
  bannedAt?: string | null;
  followers: UserRef[];
  following: UserRef[];
  saved?: SavedPostRef[];
  /** Сохранённые ролики; в профиле владельца приходят целиком. */
  savedLoops?: Array<string | { _id: string; media: string; caption?: string; author?: { _id: string; userName?: string } }>;
}

export async function signIn(identifier: string, password: string): Promise<User> {
  const { data } = await client.post('/auth/signin', { identifier, password });
  if (data.token) {
    await SecureStore.setItemAsync('auth_token', data.token);
  }
  const { token: _token, ...user } = data.user ?? data;
  return user;
}

export async function signUp(payload: {
  name: string;
  userName: string;
  email: string;
  password: string;
}): Promise<User> {
  const { data } = await client.post('/auth/signup', payload);
  if (data.token) {
    await SecureStore.setItemAsync('auth_token', data.token);
    const { token: _token, ...user } = data.user ?? data;
    return user;
  }

  return signIn(payload.email, payload.password);
}

export async function signInWithGoogleCredential(credential: string): Promise<User> {
  const { data } = await client.post('/auth/google', { credential });
  if (data.token) {
    await SecureStore.setItemAsync('auth_token', data.token);
  }
  const { token: _token, ...user } = data.user ?? data;
  return user;
}

export async function signOut(): Promise<void> {
  try { await client.get('/auth/signout'); } catch {}
  await SecureStore.deleteItemAsync('auth_token');
}

export async function getMe(): Promise<User> {
  const { data } = await client.get('/user/current');
  // Sliding session: persist the refreshed token so the login stays valid.
  if (data?.token) {
    await SecureStore.setItemAsync('auth_token', data.token);
  }
  const { token: _token, ...user } = data ?? {};
  return user as User;
}

export async function resendVerificationEmail(): Promise<{ message?: string }> {
  const { data } = await client.post('/auth/resend-verification');
  return data;
}

export async function verifyEmailToken(token: string): Promise<{ message?: string }> {
  const { data } = await client.post('/auth/verify-email', { token });
  return data;
}
