import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  clearAllNotifications,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markNotificationAsRead,
  Notification as AppNotification,
} from '../api/notifications';
import { useSocketEvent } from '../hooks/useSocket';
import { useBadgeStore } from '../store/badgeStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };
type FilterMode = 'all' | 'unread';

const ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  like: { name: 'heart', color: colors.danger },
  comment: { name: 'chatbubble', color: '#1e88e5' },
  follow: { name: 'person-add', color: '#43a047' },
  message: { name: 'mail', color: '#8e24aa' },
  mention: { name: 'at', color: colors.text },
  listing_comment: { name: 'chatbubbles', color: '#0f8c72' },
  listing_rejected: { name: 'alert-circle', color: colors.danger },
  listing_approved: { name: 'checkmark-circle', color: '#14843b' },
  listing_appeal: { name: 'flag', color: '#9a5a00' },
  system: { name: 'settings', color: colors.textMuted },
  default: { name: 'notifications', color: '#fb8c00' },
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const normalizeLinkPath = (link?: string) => {
  if (!link) return '';
  try {
    if (/^https?:\/\//i.test(link)) {
      return new URL(link).pathname;
    }
  } catch {}
  return link.startsWith('/') ? link : `/${link}`;
};

const getIdFromPath = (path: string, prefix: string) => {
  if (!path.startsWith(prefix)) return '';
  return path.slice(prefix.length).split(/[/?#]/)[0] || '';
};

export default function NotificationsScreen({ navigation }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(
    () => (filter === 'unread' ? notifications.filter((item) => !item.isRead) : notifications),
    [filter, notifications],
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [items, unread] = await Promise.all([
        getNotifications(),
        getUnreadCount().catch(() => 0),
      ]);
      setNotifications(items);
      setUnreadCount(unread);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить уведомления');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // Mirror the unread count into the tab-bar badge store
  const setUnreadNotifications = useBadgeStore((s) => s.setUnreadNotifications);
  useEffect(() => {
    setUnreadNotifications(unreadCount);
  }, [unreadCount, setUnreadNotifications]);

  useSocketEvent<AppNotification>('notification', (notification) => {
    setNotifications((prev) => [notification, ...prev.filter((item) => item._id !== notification._id)]);
    setUnreadCount((prev) => prev + (notification.isRead ? 0 : 1));
  }, []);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const markLocalRead = (notificationId: string) => {
    setNotifications((prev) => prev.map((item) => (
      item._id === notificationId ? { ...item, isRead: true } : item
    )));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markOne = async (item: AppNotification) => {
    if (item.isRead) return;
    setBusyId(item._id);
    try {
      await markNotificationAsRead(item._id);
      markLocalRead(item._id);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отметить уведомление');
    } finally {
      setBusyId('');
    }
  };

  const handleMarkAll = async () => {
    setBulkBusy(true);
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отметить уведомления');
    } finally {
      setBulkBusy(false);
    }
  };

  const removeOne = (item: AppNotification) => {
    Alert.alert('Удалить уведомление?', item.title || item.description || 'Это уведомление исчезнет из списка.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item._id);
          try {
            await deleteNotification(item._id);
            setNotifications((prev) => prev.filter((current) => current._id !== item._id));
            if (!item.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить уведомление');
          } finally {
            setBusyId('');
          }
        },
      },
    ]);
  };

  const clearAll = () => {
    if (!notifications.length) return;
    Alert.alert('Очистить уведомления?', 'Весь список уведомлений будет удален.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Очистить',
        style: 'destructive',
        onPress: async () => {
          setBulkBusy(true);
          try {
            await clearAllNotifications();
            setNotifications([]);
            setUnreadCount(0);
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось очистить уведомления');
          } finally {
            setBulkBusy(false);
          }
        },
      },
    ]);
  };

  const openNotification = async (item: AppNotification) => {
    if (!item.isRead) {
      await markOne(item);
    }

    const linkPath = normalizeLinkPath(item.link);

    if (item.relatedType === 'post' && item.relatedId) {
      navigation.navigate('PostComments', { postId: item.relatedId });
      return;
    }

    if (item.relatedType === 'loop' && item.relatedId) {
      navigation.navigate('SocialTabs', { screen: 'Loops', params: { loopId: item.relatedId } });
      return;
    }

    if (item.relatedType === 'review') {
      navigation.navigate('MyReviews');
      return;
    }

    if (item.relatedType === 'market_listing' || item.relatedType === 'listing') {
      if (item.type === 'listing_appeal' || linkPath.startsWith('/admin')) {
        navigation.navigate('Admin');
        return;
      }

      if (item.type === 'listing_rejected' || item.type === 'listing_approved') {
        navigation.navigate('MarketTabs', { screen: 'MyListings' });
        return;
      }

      navigation.navigate('MarketTabs', { screen: 'Market' });
      return;
    }

    if (item.relatedType === 'message' && item.actor?._id) {
      navigation.navigate('Chat', {
        userId: item.actor._id,
        name: item.actor.name || item.actor.userName || 'Avtotime',
        userName: item.actor.userName || '',
      });
      return;
    }

    if ((item.relatedType === 'user' || item.type === 'follow') && (item.relatedId || item.actor?._id)) {
      navigation.navigate('UserProfile', { userId: item.relatedId || item.actor!._id });
      return;
    }

    const postId = getIdFromPath(linkPath, '/post/');
    if (postId) {
      navigation.navigate('PostComments', { postId });
      return;
    }

    const loopId = getIdFromPath(linkPath, '/loop/');
    if (loopId) {
      navigation.navigate('SocialTabs', { screen: 'Loops', params: { loopId } });
      return;
    }

    if (linkPath.startsWith('/reviews')) {
      navigation.navigate('MyReviews');
      return;
    }

    if (linkPath.startsWith('/admin')) {
      navigation.navigate('Admin');
      return;
    }

    if (linkPath.startsWith('/market')) {
      navigation.navigate('MarketTabs', { screen: 'Market' });
      return;
    }

    if (item.actor?._id) {
      navigation.navigate('UserProfile', { userId: item.actor._id });
      return;
    }

    Alert.alert('Уведомление', item.description || item.title || 'Нет связанного экрана для открытия.');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="notifications-outline" size={27} color={colors.text} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Уведомления</Text>
          <Text style={styles.subtitle}>{unreadCount ? `${unreadCount} непрочитанных` : 'Все уведомления прочитаны'}</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('NotificationSettings')}>
          <Ionicons name="options-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, filter === 'all' && styles.segmentBtnActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.segmentText, filter === 'all' && styles.segmentTextActive]}>Все</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, filter === 'unread' && styles.segmentBtnActive]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.segmentText, filter === 'unread' && styles.segmentTextActive]}>Непрочитанные</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bulkRow}>
        <TouchableOpacity
          style={[styles.bulkBtn, unreadCount === 0 && styles.bulkBtnDisabled]}
          onPress={handleMarkAll}
          disabled={!unreadCount || bulkBusy}
        >
          {bulkBusy ? <ActivityIndicator color={colors.text} /> : <Ionicons name="checkmark-done-outline" size={17} color={colors.text} />}
          <Text style={styles.bulkText}>Прочитать все</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bulkBtn, !notifications.length && styles.bulkBtnDisabled]}
          onPress={clearAll}
          disabled={!notifications.length || bulkBusy}
        >
          <Ionicons name="trash-outline" size={17} color={colors.danger} />
          <Text style={[styles.bulkText, styles.bulkTextDanger]}>Очистить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: AppNotification }) => {
    const icon = ICONS[item.type] ?? ICONS.default;
    const message = item.description || item.title || 'Уведомление';
    const avatar = item.actor?.profileImage || item.image;
    const busy = busyId === item._id;

    return (
      <View style={[styles.card, !item.isRead && styles.cardUnread]}>
        <TouchableOpacity style={styles.cardMain} onPress={() => openNotification(item)} activeOpacity={0.86}>
          <View style={[styles.iconWrap, { backgroundColor: `${icon.color}20` }]}>
            <Ionicons name={icon.name} size={21} color={icon.color} />
          </View>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : null}
          <View style={styles.cardContent}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Avtotime'}</Text>
              {!item.isRead ? <View style={styles.dot} /> : null}
            </View>
            <Text style={styles.message} numberOfLines={3}>{message}</Text>
            <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => markOne(item)}
            disabled={item.isRead || busy}
          >
            {busy ? <ActivityIndicator color={colors.textMuted} /> : <Ionicons name="checkmark-outline" size={17} color={item.isRead ? '#bbb' : '#555'} />}
            <Text style={[styles.actionText, item.isRead && styles.actionTextDisabled]}>Прочитано</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => removeOne(item)} disabled={busy}>
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
            <Text style={styles.actionTextDanger}>Удалить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={filtered}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={filtered.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={46} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>{filter === 'unread' ? 'Непрочитанных нет' : 'Уведомлений нет'}</Text>
          <Text style={styles.emptyText}>Новые события по профилю, сообщениям и объявлениям появятся здесь.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: 12, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 10, marginBottom: 2 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  heroIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  settingsBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  toolbar: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 5 },
  segment: { flexDirection: 'row', gap: 5 },
  segmentBtn: { flex: 1, height: 36, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segmentBtnActive: { backgroundColor: colors.surfaceHi },
  segmentText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: '#fff' },
  bulkRow: { flexDirection: 'row', gap: 8 },
  bulkBtn: { flex: 1, height: 42, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  bulkBtnDisabled: { opacity: 0.52 },
  bulkText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  bulkTextDanger: { color: colors.danger },
  card: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardUnread: { borderColor: '#cfe4ff', backgroundColor: '#f8fbff' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt },
  cardContent: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  message: { marginTop: 3, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  time: { marginTop: 5, color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, padding: 8 },
  actionBtn: { flex: 1, height: 36, borderRadius: 8, backgroundColor: '#f5f5f5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  actionTextDisabled: { color: colors.textFaint },
  actionTextDanger: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
