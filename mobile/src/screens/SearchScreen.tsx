import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { getSuggestedUsers, searchUsers } from '../api/users';
import { User } from '../api/auth';
import { getFeed, Post, searchPosts, toggleLike } from '../api/posts';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

const fallbackAvatar = require('../../assets/icon.png');

const formatCount = (value: number) => {
  if (value > 999) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
};

export default function SearchScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [postResults, setPostResults] = useState<Post[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [suggestedPosts, setSuggestedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Increments per request; stale responses are ignored so a slow discover/search
  // cannot overwrite the results of a newer one.
  const requestIdRef = useRef(0);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= 2;

  const users = hasQuery ? userResults : suggestedUsers;
  const posts = hasQuery ? postResults : suggestedPosts;

  const loadDiscover = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current;
    if (!silent) setLoading(true);
    try {
      const [usersData, feedData] = await Promise.all([
        getSuggestedUsers().catch(() => []),
        getFeed().catch(() => []),
      ]);
      if (requestId !== requestIdRef.current) return;
      setSuggestedUsers(usersData);
      setSuggestedPosts(feedData.slice(0, 20));
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить рекомендации');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // Silent when discover data already exists — no full-screen spinner on every return
    loadDiscover(suggestedUsers.length > 0 || suggestedPosts.length > 0);
  }, [loadDiscover, suggestedUsers.length, suggestedPosts.length]));

  useEffect(() => {
    if (!trimmedQuery) {
      setUserResults([]);
      setPostResults([]);
      setSearching(false);
      return;
    }

    if (trimmedQuery.length < 2) {
      setUserResults([]);
      setPostResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setSearching(true);
      try {
        const [foundUsers, foundPosts] = await Promise.all([
          searchUsers(trimmedQuery).catch(() => []),
          searchPosts(trimmedQuery).catch(() => []),
        ]);
        if (requestId !== requestIdRef.current) return;
        setUserResults(foundUsers);
        setPostResults(foundPosts);
      } finally {
        if (requestId === requestIdRef.current) setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  const refresh = () => {
    setRefreshing(true);
    if (hasQuery) {
      const requestId = ++requestIdRef.current;
      Promise.all([
        searchUsers(trimmedQuery).catch(() => []),
        searchPosts(trimmedQuery).catch(() => []),
      ]).then(([foundUsers, foundPosts]) => {
        if (requestId !== requestIdRef.current) return;
        setUserResults(foundUsers);
        setPostResults(foundPosts);
      }).finally(() => {
        if (requestId === requestIdRef.current) setRefreshing(false);
      });
      return;
    }

    loadDiscover(true);
  };

  const handleLike = async (postId: string) => {
    try {
      const updated = await toggleLike(postId);
      setSuggestedPosts((prev) => prev.map((post) => (post._id === postId ? { ...post, ...updated } : post)));
      setPostResults((prev) => prev.map((post) => (post._id === postId ? { ...post, ...updated } : post)));
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить лайк');
    }
  };

  const sections = useMemo(() => {
    const s: { key: 'users' | 'posts'; title: string; data: any[] }[] = [];
    if (users.length) s.push({ key: 'users', title: hasQuery ? `Люди · ${users.length}` : 'Люди', data: users });
    if (posts.length) s.push({ key: 'posts', title: hasQuery ? `Публикации · ${posts.length}` : 'Публикации', data: posts });
    return s;
  }, [users, posts, hasQuery]);

  const openChat = (item: User) => {
    navigation.navigate('Chat', {
      userId: item._id,
      name: item.name,
      userName: item.userName,
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Пользователь или текст публикации"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      {trimmedQuery && trimmedQuery.length < 2 ? (
        <View style={styles.hint}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.hintText}>Введите минимум 2 символа для поиска.</Text>
        </View>
      ) : null}

      {searching ? (
        <View style={styles.searchingRow}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.searchingText}>Ищем...</Text>
        </View>
      ) : null}
    </View>
  );

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <TouchableOpacity
        style={styles.userMain}
        onPress={() => navigation.navigate('UserProfile', { userId: item._id })}
        activeOpacity={0.86}
      >
        <Image source={item.profileImage ? { uri: item.profileImage } : fallbackAvatar} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.name} numberOfLines={1}>{item.name || 'Пользователь'}</Text>
          <Text style={styles.username} numberOfLines={1}>@{item.userName || 'avtotime'}</Text>
          {item.bio || item.profession || item.location ? (
            <Text style={styles.userMeta} numberOfLines={1}>{item.bio || item.profession || item.location}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>
      {item._id !== user?._id ? (
        <View style={styles.userActions}>
          <TouchableOpacity style={styles.userActionBtn} onPress={() => openChat(item)}>
            <Ionicons name="chatbubble-outline" size={17} color={colors.text} />
            <Text style={styles.userActionText}>Сообщение</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.userActionBtn} onPress={() => navigation.navigate('UserProfile', { userId: item._id })}>
            <Ionicons name="person-circle-outline" size={17} color={colors.text} />
            <Text style={styles.userActionText}>Профиль</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => {
    const liked = user ? item.likes?.includes(user._id) : false;
    const image = item.mediaList?.[0] || item.media;
    const avatar = item.author?.profileImage ? { uri: item.author.profileImage } : fallbackAvatar;

    return (
      <View style={styles.postCard}>
        <TouchableOpacity
          style={styles.postAuthor}
          onPress={() => navigation.navigate('UserProfile', { userId: item.author._id })}
          activeOpacity={0.86}
        >
          <Image source={avatar} style={styles.postAvatar} />
          <View style={styles.postAuthorText}>
            <Text style={styles.name} numberOfLines={1}>{item.author?.name || 'Пользователь'}</Text>
            <Text style={styles.username} numberOfLines={1}>@{item.author?.userName || 'avtotime'}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('PostComments', { postId: item._id })} activeOpacity={0.9}>
          {image ? (
            <Image source={{ uri: image }} style={styles.postImage} />
          ) : (
            <View style={[styles.postImage, styles.textPostImage]}>
              <Ionicons name="text-outline" size={26} color={colors.textFaint} />
            </View>
          )}
          {item.caption ? <Text style={styles.caption} numberOfLines={4}>{item.caption}</Text> : null}
        </TouchableOpacity>

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.postActionBtn} onPress={() => handleLike(item._id)}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={21} color={liked ? colors.danger : colors.textMuted} />
            <Text style={styles.postActionText}>{formatCount(item.likes?.length ?? 0)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postActionBtn} onPress={() => navigation.navigate('PostComments', { postId: item._id })}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
            <Text style={styles.postActionText}>{formatCount(item.commentsCount ?? item.comments?.length ?? 0)}</Text>
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
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item: any, index) => item._id || String(index)}
      renderItem={({ item, section }: any) => (section.key === 'users' ? renderUser({ item }) : renderPost({ item }))}
      renderSectionHeader={({ section }: any) => <Text style={styles.sectionTitle}>{section.title}</Text>}
      SectionSeparatorComponent={() => <View style={{ height: 10 }} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={renderHeader()}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={sections.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        searching ? null : (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={44} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>{hasQuery ? 'Ничего не найдено' : 'Начните поиск'}</Text>
            <Text style={styles.emptyText}>
              {hasQuery ? 'Попробуйте другой запрос.' : 'Введите имя, @ник или текст публикации'}
            </Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: 12, paddingBottom: 28 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 12, marginBottom: 6 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  searchBar: { height: 46, borderRadius: 14, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 15, color: colors.text },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', paddingHorizontal: 2, marginTop: 4 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 10 },
  hintText: { flex: 1, color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  searchingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 8 },
  searchingText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  userCard: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  userMain: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceAlt },
  userInfo: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '900' },
  username: { marginTop: 2, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  userMeta: { marginTop: 4, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  userActions: { flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 8 },
  userActionBtn: { flex: 1, height: 36, borderRadius: 8, backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  userActionText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  postCard: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  postAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  postAuthorText: { flex: 1 },
  postImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  textPostImage: { alignItems: 'center', justifyContent: 'center' },
  caption: { paddingHorizontal: 12, paddingTop: 10, color: colors.text, fontSize: 14, lineHeight: 20 },
  postActions: { flexDirection: 'row', gap: 16, paddingHorizontal: 12, paddingVertical: 11 },
  postActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postActionText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
