import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getConversations, Conversation } from '../api/messages';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

export default function MessagesScreen({ navigation }: Props) {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getConversations();
      setChats(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('Chat', { userId: item._id, name: item.name, userName: item.userName })}
    >
      <Image
        source={item.profileImage ? { uri: item.profileImage } : require('../../assets/icon.png')}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.lastMsg} numberOfLines={1}>
          {item.lastMessage ?? 'Нет сообщений'}
        </Text>
      </View>
      {(item.unreadCount ?? 0) > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(c) => c._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ddd" />
            <Text style={styles.empty}>Нет диалогов</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#eee' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#111' },
  lastMsg: { fontSize: 13, color: '#888', marginTop: 2 },
  badge: {
    backgroundColor: '#111', borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { fontSize: 15, color: '#bbb' },
});
