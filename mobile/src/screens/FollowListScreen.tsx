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
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User } from '../api/auth';
import { getFollowers, getFollowing } from '../api/users';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'FollowList'>;
  route: RouteProp<AppStackParamList, 'FollowList'>;
};

export default function FollowListScreen({ navigation, route }: Props) {
  const { userId, mode, title } = route.params;
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = mode === 'followers' ? await getFollowers(userId) : await getFollowing(userId);
      setUsers(data);
      navigation.setOptions({ title });
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить список');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, navigation, title, userId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) => [
      user.name,
      user.userName,
      user.bio,
      user.location,
    ].join(' ').toLowerCase().includes(normalized));
  }, [query, users]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openUser = (user: User) => {
    if (user._id === me?._id) {
      navigation.navigate('Tabs', { screen: 'Profile' } as any);
      return;
    }
    navigation.navigate('UserProfile', { userId: user._id });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={mode === 'followers' ? 'people-outline' : 'person-add-outline'} size={27} color="#111" />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{users.length} профилей</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#777" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по людям"
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

  const renderItem = ({ item }: { item: User }) => (
    <TouchableOpacity style={styles.card} onPress={() => openUser(item)} activeOpacity={0.86}>
      {item.profileImage ? (
        <Image source={{ uri: item.profileImage }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{(item.name || item.userName || 'A').slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.userBody}>
        <Text style={styles.name} numberOfLines={1}>{item.name || 'Пользователь'}</Text>
        <Text style={styles.userName} numberOfLines={1}>@{item.userName || 'avtotime'}</Text>
        {item.bio || item.location ? (
          <Text style={styles.meta} numberOfLines={1}>{item.bio || item.location}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={19} color="#aaa" />
    </TouchableOpacity>
  );

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
          <Ionicons name="people-outline" size={42} color="#bbb" />
          <Text style={styles.emptyTitle}>{query ? 'Никого не нашли' : 'Список пуст'}</Text>
          <Text style={styles.emptyText}>{query ? 'Попробуйте изменить запрос.' : 'Здесь появятся профили пользователей.'}</Text>
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
  card: { borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#eee' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  userBody: { flex: 1 },
  name: { color: '#111', fontSize: 16, fontWeight: '900' },
  userName: { marginTop: 2, color: '#777', fontSize: 12, fontWeight: '800' },
  meta: { marginTop: 4, color: '#555', fontSize: 12, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: '#111', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: '#777', fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
