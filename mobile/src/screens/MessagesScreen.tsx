import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation, deleteConversation, getConversations } from '../api/messages';
import { useSocketEvent } from '../hooks/useSocket';
import { useBadgeStore } from '../store/badgeStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors, font, radius, shadow, space } from '../theme';
import { Card, EmptyState, PressableScale, Skeleton } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

const fallbackAvatar = require('../../assets/icon.png');

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

export default function MessagesScreen({ navigation }: Props) {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const setUnreadMessages = useBadgeStore((s) => s.setUnreadMessages);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getConversations();
      setChats(data);
      setUnreadMessages(data.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0));
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить диалоги');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useSocketEvent('newMessage', () => {
    load(true);
  }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return chats;
    return chats.filter((item) => [item.name, item.userName, item.lastMessage].join(' ').toLowerCase().includes(normalized));
  }, [chats, query]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openChat = (item: Conversation) => {
    navigation.navigate('Chat', { userId: item._id, name: item.name, userName: item.userName ?? '' });
  };

  const removeConversation = (item: Conversation) => {
    Alert.alert('Удалить переписку?', `Диалог с ${item.name || item.userName} будет очищен.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(item._id);
          try {
            await deleteConversation(item._id);
            setChats((prev) => prev.filter((chat) => chat._id !== item._id));
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить переписку');
          } finally {
            setDeletingId('');
          }
        },
      },
    ]);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="chatbubbles" size={24} color={colors.accent} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Сообщения</Text>
          <Text style={styles.subtitle}>{chats.length ? `${chats.length} диалогов` : 'Диалогов пока нет'}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по диалогам"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <Ionicons name="close-circle" size={18} color={colors.textFaint} onPress={() => setQuery('')} />
        ) : null}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Conversation }) => {
    const deleting = deletingId === item._id;
    const unread = item.unreadCount ?? 0;
    return (
      <PressableScale
        scaleTo={0.98}
        onPress={() => openChat(item)}
        onLongPress={() => removeConversation(item)}
        style={[styles.cellWrap, deleting && { opacity: 0.5 }]}
      >
        <Card style={styles.card}>
          <Image source={item.profileImage ? { uri: item.profileImage } : fallbackAvatar} style={styles.avatar} />
          <View style={styles.info}>
            <View style={styles.topLine}>
              <Text style={styles.name} numberOfLines={1}>{item.name || 'Пользователь'}</Text>
              <Text style={styles.time}>{formatDate(item.lastMessageAt)}</Text>
            </View>
            <Text style={[styles.lastMsg, unread > 0 && styles.lastMsgUnread]} numberOfLines={1}>
              {item.lastMessage || 'Нет сообщений'}
            </Text>
          </View>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          ) : null}
        </Card>
      </PressableScale>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.cellWrap}>
              <Card style={styles.card}>
                <Skeleton style={styles.avatar} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton style={{ width: '55%', height: 13 }} />
                  <Skeleton style={{ width: '80%', height: 11 }} />
                </View>
              </Card>
            </View>
          ))}
        </View>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        <EmptyState
          icon="chatbubbles-outline"
          title={query ? 'Ничего не найдено' : 'Нет диалогов'}
          subtitle={query ? 'Попробуйте изменить запрос.' : 'Откройте профиль пользователя и напишите ему, чтобы начать чат.'}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.md, paddingBottom: space.xxl, gap: space.sm },
  emptyList: { flexGrow: 1, padding: space.md },
  header: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1 },
  title: { color: colors.text, fontSize: font.display, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  searchBox: { height: 46, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, ...shadow.card },
  searchInput: { flex: 1, color: colors.text, fontSize: font.body },

  cellWrap: {},
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt },
  info: { flex: 1 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: font.body, fontWeight: '900', color: colors.text },
  time: { fontSize: font.tiny, color: colors.textFaint, fontWeight: '800' },
  lastMsg: { fontSize: font.small, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  lastMsgUnread: { color: colors.text, fontWeight: '800' },
  badge: { backgroundColor: colors.accent, borderRadius: 11, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: colors.onAccent, fontSize: font.tiny, fontWeight: '900' },
});
