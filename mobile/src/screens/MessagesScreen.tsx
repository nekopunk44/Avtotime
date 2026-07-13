import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation, deleteConversation, getConversations } from '../api/messages';
import { useSocketEvent } from '../hooks/useSocket';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getConversations();
      setChats(data);
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
    return chats.filter((item) => [
      item.name,
      item.userName,
      item.lastMessage,
    ].join(' ').toLowerCase().includes(normalized));
  }, [chats, query]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openChat = (item: Conversation) => {
    navigation.navigate('Chat', {
      userId: item._id,
      name: item.name,
      userName: item.userName ?? '',
    });
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
          <Ionicons name="chatbubbles-outline" size={27} color="#111" />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Сообщения</Text>
          <Text style={styles.subtitle}>{chats.length ? `${chats.length} диалогов` : 'Диалогов пока нет'}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#777" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по диалогам"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Conversation }) => {
    const deleting = deletingId === item._id;

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={() => openChat(item)} activeOpacity={0.86}>
          <Image
            source={item.profileImage ? { uri: item.profileImage } : require('../../assets/icon.png')}
            style={styles.avatar}
          />
          <View style={styles.info}>
            <View style={styles.topLine}>
              <Text style={styles.name} numberOfLines={1}>{item.name || 'Пользователь'}</Text>
              <Text style={styles.time}>{formatDate(item.lastMessageAt)}</Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>@{item.userName || 'avtotime'}</Text>
            <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage || 'Нет сообщений'}</Text>
          </View>
          {(item.unreadCount ?? 0) > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openChat(item)}>
            <Ionicons name="chatbubble-outline" size={17} color="#111" />
            <Text style={styles.actionText}>Открыть</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => removeConversation(item)} disabled={deleting}>
            {deleting ? <ActivityIndicator color="#d92323" /> : <Ionicons name="trash-outline" size={17} color="#d92323" />}
            <Text style={styles.actionTextDanger}>Удалить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
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
          <Ionicons name="chatbubbles-outline" size={46} color="#bbb" />
          <Text style={styles.emptyTitle}>{query ? 'Ничего не найдено' : 'Нет диалогов'}</Text>
          <Text style={styles.emptyText}>
            {query ? 'Попробуйте изменить запрос.' : 'Откройте профиль пользователя и нажмите “Сообщение”, чтобы начать чат.'}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f5f7' },
  list: { padding: 12, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 10, marginBottom: 2 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  heroIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1 },
  title: { color: '#111', fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#666', fontSize: 13, fontWeight: '800' },
  searchBox: { height: 44, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: '#111', fontSize: 15 },
  card: { borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#eee' },
  info: { flex: 1 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '900', color: '#111' },
  time: { fontSize: 11, color: '#999', fontWeight: '800' },
  userName: { marginTop: 2, fontSize: 12, color: '#777', fontWeight: '800' },
  lastMsg: { fontSize: 13, color: '#555', marginTop: 4, fontWeight: '700' },
  badge: { backgroundColor: '#111', borderRadius: 10, minWidth: 21, height: 21, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', padding: 8 },
  actionBtn: { flex: 1, height: 36, borderRadius: 8, backgroundColor: '#f5f5f5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionText: { color: '#111', fontSize: 12, fontWeight: '900' },
  actionTextDanger: { color: '#d92323', fontSize: 12, fontWeight: '900' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: '#111', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: '#777', fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
