import { useEffect } from 'react';
import { Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { registerPushToken, unregisterPushToken } from '../api/notifications';
import { navigationRef } from '../navigation/navigationRef';

const PUSH_TOKEN_KEY = 'expo_push_token';

// Expo Go (SDK 53+) removed remote-push from expo-notifications. Merely
// importing the module runs its top-level push-token auto-registration, which
// throws "runtime not ready" in Expo Go — so we must not even evaluate it
// there. Lazily require it only outside Expo Go; push needs a dev/prod build.
const isExpoGo = Constants.executionEnvironment === 'storeClient';
const Notifications: typeof ExpoNotifications | undefined = isExpoGo
  ? undefined
  : require('expo-notifications');

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export interface PushData {
  type?: string;
  relatedId?: string;
  relatedType?: string;
  link?: string;
  actorId?: string;
  actorName?: string;
  actorUserName?: string;
}

function getProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

export async function registerPushNotifications(): Promise<void> {
  try {
    // Удалённые пуши не работают в Expo Go начиная с SDK 53 — нужен dev build
    if (!Notifications) {
      console.log('[push] Expo Go не поддерживает удалённые пуши — нужен dev build');
      return;
    }
    if (!Device.isDevice) return;

    const projectId = getProjectId();
    if (!projectId) {
      console.log('[push] Пропуск регистрации: нет EAS projectId в app.json');
      return;
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Уведомления',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#111111',
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await registerPushToken(token);
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  } catch (error) {
    console.log('[push] Не удалось зарегистрировать пуш-токен:', error);
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!token) return;
    await unregisterPushToken(token);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {
    // Токен почистится на сервере при первой неудачной доставке
  }
}

const getIdFromPath = (path: string, prefix: string): string | null => {
  if (!path.startsWith(prefix)) return null;
  const id = path.slice(prefix.length).split(/[/?#]/)[0];
  return /^[0-9a-fA-F]{24}$/.test(id) ? id : null;
};

function navigateFromPush(data: PushData) {
  if (!navigationRef.isReady()) return;

  const link = typeof data.link === 'string' ? data.link : '';

  try {
    if (data.relatedType === 'message' && data.actorId) {
      navigationRef.navigate('Chat', {
        userId: data.actorId,
        name: data.actorName || data.actorUserName || 'Avtotime',
        userName: data.actorUserName || '',
      });
      return;
    }

    if (data.relatedType === 'post' && data.relatedId) {
      navigationRef.navigate('PostComments', { postId: data.relatedId });
      return;
    }

    if (data.relatedType === 'loop' && data.relatedId) {
      navigationRef.navigate('SocialTabs', { screen: 'Loops', params: { loopId: data.relatedId } });
      return;
    }

    if (data.relatedType === 'review') {
      navigationRef.navigate('MyReviews');
      return;
    }

    if (data.relatedType === 'market_listing' || data.relatedType === 'listing') {
      if (data.type === 'listing_appeal' || link.startsWith('/admin')) {
        navigationRef.navigate('Admin');
        return;
      }
      if (data.type === 'listing_rejected' || data.type === 'listing_approved') {
        navigationRef.navigate('MyListings');
        return;
      }
      navigationRef.navigate('MarketTabs', { screen: 'Market' });
      return;
    }

    if ((data.relatedType === 'user' || data.type === 'follow') && (data.relatedId || data.actorId)) {
      navigationRef.navigate('UserProfile', { userId: (data.relatedId || data.actorId)! });
      return;
    }

    const postId = getIdFromPath(link, '/post/');
    if (postId) {
      navigationRef.navigate('PostComments', { postId });
      return;
    }

    const loopId = getIdFromPath(link, '/loop/');
    if (loopId) {
      navigationRef.navigate('SocialTabs', { screen: 'Loops', params: { loopId } });
      return;
    }

    if (link.startsWith('/admin')) {
      navigationRef.navigate('Admin');
      return;
    }

    if (link.startsWith('/market')) {
      navigationRef.navigate('MarketTabs', { screen: 'Market' });
      return;
    }

    navigationRef.navigate('Notifications');
  } catch {
    // Экран мог быть недоступен (например, разлогин) — молча игнорируем
  }
}

let pendingPush: PushData | null = null;
let coldStartHandled = false;

export function consumePendingPush() {
  if (!pendingPush || !navigationRef.isReady()) return;
  const data = pendingPush;
  pendingPush = null;
  navigateFromPush(data);
}

function queuePush(response: ExpoNotifications.NotificationResponse) {
  pendingPush = (response.notification.request.content.data || {}) as PushData;
  consumePendingPush();
}

// Регистрирует токен и обрабатывает тапы по пушам, пока пользователь залогинен
export function usePushNotifications(loggedIn: boolean) {
  useEffect(() => {
    if (!loggedIn || !Notifications) return;

    registerPushNotifications();

    if (!coldStartHandled) {
      coldStartHandled = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          pendingPush = (response.notification.request.content.data || {}) as PushData;
          // Даём навигатору смонтироваться после холодного старта
          setTimeout(consumePendingPush, 300);
        }
      });
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(queuePush);
    return () => subscription.remove();
  }, [loggedIn]);
}
