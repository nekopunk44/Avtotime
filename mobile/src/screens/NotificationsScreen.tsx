import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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

const FILTERS: Array<{ value: FilterMode; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'unread', label: 'Непрочитанные' },
];

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
  const [segLayouts, setSegLayouts] = useState<Array<{ x: number; width: number }>>([]);
  const thumbX = useRef(new Animated.Value(0)).current;
  const thumbW = useRef(new Animated.Value(0)).current;
  const thumbInited = useRef(false);
  const activeIndex = filter === 'unread' ? 1 : 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerSettings} onPress={() => navigation.navigate('NotificationSettings')} hitSlop={8} activeOpacity={0.8}>
          <Ionicons name="options-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    const layout = segLayouts[activeIndex];
    if (!layout) return;
    if (!thumbInited.current) {
      thumbInited.current = true;
      thumbX.setValue(layout.x);
      thumbW.setValue(layout.width);
      return;
    }
    Animated.parallel([
      Animated.spring(thumbX, { toValue: layout.x, useNativeDriver: false, friction: 10, tension: 90 }),
      Animated.spring(thumbW, { toValue: layout.width, useNativeDriver: false, friction: 10, tension: 90 }),
    ]).start();
  }, [activeIndex, segLayouts, thumbX, thumbW]);

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
      <View style={styles.segment}>
        {segLayouts.length === FILTERS.length ? (
          <Animated.View style={[styles.segThumb, { left: thumbX, width: thumbW }]} />
        ) : null}
        {FILTERS.map((item, index) => {
          const active = filter === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={styles.segmentBtn}
              onPress={() => setFilter(item.value)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setSegLayouts((prev) => {
                  if (prev[index] && prev[index].x === x && prev[index].width === width) return prev;
                  const next = [...prev];
                  next[index] = { x, width };
                  return next;
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                {item.value === 'unread' ? `Непрочитанные${unreadCount ? ` · ${unreadCount}` : ''}` : item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {notifications.length ? (
        <View style={styles.bulkRow}>
          <TouchableOpacity
            style={[styles.bulkBtn, unreadCount === 0 && styles.bulkBtnDisabled]}
            onPress={handleMarkAll}
            disabled={!unreadCount || bulkBusy}
          >
            {bulkBusy ? <ActivityIndicator color={colors.text} size="small" /> : <Ionicons name="checkmark-done-outline" size={16} color={colors.text} />}
            <Text style={styles.bulkText}>Прочитать все</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkBtn} onPress={clearAll} disabled={bulkBusy}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.bulkText, styles.bulkTextDanger]}>Очистить</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const renderItem = ({ item }: { item: AppNotification }) => {
    const icon = ICONS[item.type] ?? ICONS.default;
    const message = item.description || item.title || 'Уведомление';
    const avatar = item.actor?.profileImage || item.image;
    const danger = item.type === 'listing_rejected';

    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.cardUnread]}
        onPress={() => openNotification(item)}
        onLongPress={() => removeOne(item)}
        activeOpacity={0.85}
        disabled={busyId === item._id}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.iconWrap}>
            <Ionicons name={icon.name} size={20} color={danger ? colors.danger : colors.text} />
          </View>
        )}
        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Avtotime'}</Text>
            <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>{message}</Text>
        </View>
        {!item.isRead ? <View style={styles.dot} /> : null}
      </TouchableOpacity>
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
  header: { gap: 10, marginBottom: 4 },
  headerSettings: { marginRight: 12, padding: 4 },
  segment: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 42 },
  segThumb: { position: 'absolute', top: 4, height: 34, borderRadius: 999, backgroundColor: colors.accent },
  segmentBtn: { height: 34, marginVertical: 4, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: colors.textMuted, fontSize: 14, fontWeight: '900' },
  segmentTextActive: { color: colors.onAccent },
  bulkRow: { flexDirection: 'row', gap: 8 },
  bulkBtn: { flex: 1, height: 42, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  bulkBtnDisabled: { opacity: 0.52 },
  bulkText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  bulkTextDanger: { color: colors.danger },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  cardUnread: { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceHi },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceHi, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt },
  cardContent: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  time: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  message: { marginTop: 3, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
