import client from './client';
import { User } from './auth';
import { getUploadFile } from '../utils/upload';

export interface ProfileUpdatePayload {
  name: string;
  userName: string;
  bio?: string;
  location?: string;
  website?: string;
  instagram?: string;
  telegram?: string;
}

export async function searchUsers(query: string): Promise<User[]> {
  const { data } = await client.get('/user/search', { params: { q: query } });
  return Array.isArray(data) ? data : data.users ?? [];
}

export async function getUserById(userId: string): Promise<User> {
  const { data } = await client.get(`/user/${userId}`);
  return data;
}

export async function toggleFollow(targetUserId: string): Promise<void> {
  await client.post(`/user/follow/${targetUserId}`);
}

export async function getFollowStatus(targetUserId: string): Promise<{ isFollowing: boolean }> {
  const { data } = await client.get(`/user/${targetUserId}/follow-status`);
  return data;
}

export async function getFollowers(userId: string): Promise<User[]> {
  const { data } = await client.get(`/user/${userId}/followers`);
  return Array.isArray(data) ? data : data.followers ?? [];
}

export async function getFollowing(userId: string): Promise<User[]> {
  const { data } = await client.get(`/user/${userId}/following`);
  return Array.isArray(data) ? data : data.following ?? [];
}

export async function getSuggestedUsers(): Promise<User[]> {
  const { data } = await client.get('/user/suggested');
  return Array.isArray(data) ? data : [];
}

export async function updateProfile(payload: ProfileUpdatePayload, profileImageUri?: string): Promise<User> {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value ?? '');
  });

  if (profileImageUri) {
    formData.append('profileImage', getUploadFile(profileImageUri, 'avatar.jpg'));
  }

  const { data } = await client.post('/user/editProfile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await client.patch('/user/changePassword', { currentPassword, newPassword });
}

export async function logoutAllSessions(): Promise<void> {
  await client.post('/user/logoutAll');
}

export async function deleteProfile(password: string): Promise<void> {
  await client.delete('/user/profile', { data: { password } });
}
