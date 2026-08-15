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
import { colors } from '../theme';

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
    // Silent when data already exists — no full-screen spinner on every return
    load(users.length > 0);
  }, [load, users.length]));

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) => [
      user.name,
      user.userName,
      user.bio,
      user.location,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalized));
  }, [query, users]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openUser = (user: User) => {
    if (user._id === me?._id) {
      navigation.navigate('SocialTabs', { screen: 'Profile' } as any);
      return;
    }
    navigation.navigate('UserProfile', { userId: user._id });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.countLine}>{users.length} профилей</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по людям"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
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
      <Ionicons name="chevron-forward" size={19} color={colors.textFaint} />
    </TouchableOpacity>
  );

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
      ListHeaderComponent={renderHeader()}
      contentContainerStyle={filtered.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={42} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>{query ? 'Никого не нашли' : 'Список пуст'}</Text>
          <Text style={styles.emptyText}>{query ? 'Попробуйте изменить запрос.' : 'Здесь появятся профили пользователей.'}</Text>
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
  countLine: { paddingTop: 6, color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  searchBox: { height: 44, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  card: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceAlt },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHi },
  avatarText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  userBody: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '900' },
  userName: { marginTop: 2, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  meta: { marginTop: 4, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
