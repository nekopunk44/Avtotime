import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Image,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getNotifications, markAllAsRead, Notification } from '../api/notifications';

const ICONS: Record<string, { name: string; color: string }> = {
  like:     { name: 'heart',         color: '#e53935' },
  comment:  { name: 'chatbubble',    color: '#1e88e5' },
  follow:   { name: 'person-add',    color: '#43a047' },
  message:  { name: 'mail',          color: '#8e24aa' },
  default:  { name: 'notifications', color: '#fb8c00' },
};

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifs(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleMarkAll = async () => {
    await markAllAsRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const icon = ICONS[item.type] ?? ICONS.default;
    return (
      <View style={[styles.row, !item.isRead && styles.unread]}>
        <View style={[styles.iconWrap, { backgroundColor: icon.color + '20' }]}>
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>
        {item.sender?.profileImage ? (
          <Image source={{ uri: item.sender.profileImage }} style={styles.avatar} />
        ) : null}
        <View style={styles.content}>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>
            {new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
        {!item.isRead && <View style={styles.dot} />}
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;

  return (
    <View style={styles.container}>
      {notifs.some((n) => !n.isRead) && (
        <TouchableOpacity style={styles.markBtn} onPress={handleMarkAll}>
          <Text style={styles.markText}>Отметить все прочитанными</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifs}
        keyExtractor={(n) => n._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="notifications-off-outline" size={48} color="#ddd" />
            <Text style={styles.empty}>Уведомлений нет</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  markBtn: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  markText: { color: '#0066ff', fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  unread: { backgroundColor: '#f0f7ff' },
  iconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee' },
  content: { flex: 1 },
  message: { fontSize: 14, color: '#222', lineHeight: 19 },
  time: { fontSize: 12, color: '#aaa', marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0066ff' },
  empty: { fontSize: 15, color: '#bbb' },
});
