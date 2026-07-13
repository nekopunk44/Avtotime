import client from './client';

export interface Notification {
  _id: string;
  type: string;
  title?: string;
  description?: string;
  isRead: boolean;
  createdAt: string;
  actor?: { _id: string; userName: string; name: string; profileImage?: string };
  actors?: { _id: string; userName: string; name: string; profileImage?: string }[];
  relatedId?: string;
  relatedType?: 'post' | 'loop' | 'story' | 'message' | 'listing' | 'user' | 'review' | 'market_listing';
  image?: string;
  link?: string;
  count?: number;
}

export type DigestFrequency = 'instant' | 'daily' | 'weekly' | 'never';

export interface NotificationPreferences {
  like: boolean;
  comment: boolean;
  follow: boolean;
  message: boolean;
  mention: boolean;
  listing_comment: boolean;
  system: boolean;
  emailNotifications: boolean;
  digestFrequency: DigestFrequency;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  like: true,
  comment: true,
  follow: true,
  message: true,
  mention: true,
  listing_comment: true,
  system: true,
  emailNotifications: false,
  digestFrequency: 'instant',
};

const normalizePreferences = (value?: Partial<NotificationPreferences> | null): NotificationPreferences => ({
  ...defaultNotificationPreferences,
  ...(value ?? {}),
});

export async function getNotifications(options: { isRead?: boolean } = {}): Promise<Notification[]> {
  const params = options.isRead === undefined ? undefined : { isRead: String(options.isRead) };
  const { data } = await client.get('/notifications', { params });
  return Array.isArray(data) ? data : data.notifications ?? [];
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await client.get('/notifications/count/unread');
  return data.unreadCount ?? data.count ?? 0;
}

export async function markAllAsRead(): Promise<void> {
  await client.patch('/notifications/mark-all-read');
}

export async function markNotificationAsRead(notificationId: string): Promise<Notification> {
  const { data } = await client.patch(`/notifications/${notificationId}/read`);
  return data;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await client.delete(`/notifications/${notificationId}`);
}

export async function clearAllNotifications(): Promise<void> {
  await client.delete('/notifications');
}

export async function registerPushToken(token: string): Promise<void> {
  await client.post('/notifications/push-token', { token });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await client.delete('/notifications/push-token', { data: { token } });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await client.get('/notifications/preferences');
  return normalizePreferences(data);
}

export async function updateNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const { data } = await client.patch('/notifications/preferences', { preferences });
  return normalizePreferences(data);
}
