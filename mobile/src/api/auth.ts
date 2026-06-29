import client from './client';
import * as SecureStore from 'expo-secure-store';

export interface User {
  _id: string;
  username: string;
  name: string;
  profileImage: string;
  bio?: string;
  followers: string[];
  following: string[];
}

export async function signIn(identifier: string, password: string): Promise<User> {
  const { data } = await client.post('/auth/signin', { identifier, password });
  if (data.token) {
    await SecureStore.setItemAsync('auth_token', data.token);
  }
  return data.user ?? data;
}

export async function signUp(payload: {
  name: string;
  username: string;
  email: string;
  password: string;
}): Promise<User> {
  const { data } = await client.post('/auth/signup', payload);
  if (data.token) {
    await SecureStore.setItemAsync('auth_token', data.token);
  }
  return data.user ?? data;
}

export async function signOut(): Promise<void> {
  try { await client.post('/auth/signout'); } catch {}
  await SecureStore.deleteItemAsync('auth_token');
}

export async function getMe(): Promise<User> {
  const { data } = await client.get('/auth/me');
  return data;
}
