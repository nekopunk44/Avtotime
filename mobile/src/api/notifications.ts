import client from './client';

export interface Notification {
  _id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  sender?: { _id: string; username: string; name: string; profileImage: string };
}

export async function getNotifications(): Promise<Notification[]> {
  const { data } = await client.get('/notifications');
  return Array.isArray(data) ? data : data.notifications ?? [];
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await client.get('/notifications/count/unread');
  return data.count ?? 0;
}

export async function markAllAsRead(): Promise<void> {
  await client.patch('/notifications/mark-all-read');
}
