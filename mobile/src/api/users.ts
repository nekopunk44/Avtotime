import client from './client';
import { User } from './auth';

export async function searchUsers(query: string): Promise<User[]> {
  const { data } = await client.get('/users/search', { params: { q: query } });
  return Array.isArray(data) ? data : data.users ?? [];
}

export async function getUserById(userId: string): Promise<User> {
  const { data } = await client.get(`/users/${userId}`);
  return data;
}

export async function toggleFollow(targetUserId: string): Promise<void> {
  await client.post(`/users/follow/${targetUserId}`);
}

export async function getFollowStatus(targetUserId: string): Promise<{ isFollowing: boolean }> {
  const { data } = await client.get(`/users/${targetUserId}/follow-status`);
  return data;
}

export async function getSuggestedUsers(): Promise<User[]> {
  const { data } = await client.get('/users/suggested');
  return Array.isArray(data) ? data : [];
}
