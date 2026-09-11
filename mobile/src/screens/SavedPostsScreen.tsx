import React, { useCallback, useState } from 'react';
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
import { getPostThumb, getSavedPosts, Post, toggleLike, toggleSavePost } from '../api/posts';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';
import { Avatar, Skeleton } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'SavedPosts'> };

// Russian pluralization: plural(1, [...]) → 'публикация', plural(2, [...]) → 'публикации', plural(5, [...]) → 'публикаций'
const plural = (n: number, forms: [string, string, string]) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
};

export default function SavedPostsScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getSavedPosts();
      setPosts(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить сохранённые публикации');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handleLike = async (postId: string) => {
    try {
      const updated = await toggleLike(postId);
      setPosts((prev) => prev.map((post) => (post._id === postId ? { ...post, ...updated } : post)));
    } catch {}
  };

  const removeSaved = async (postId: string) => {
    setBusyId(postId);
    try {
      const nextUser = await toggleSavePost(postId);
      if (user) setUser({ ...user, saved: nextUser.saved ?? [] });
      setPosts((prev) => prev.filter((post) => post._id !== postId));
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось убрать публикацию');
    } finally {
      setBusyId('');
    }
  };

  const renderHeader = () => (
    posts.length ? (
      <Text style={styles.countLine}>
        {posts.length} {plural(posts.length, ['публикация', 'публикации', 'публикаций'])}
      </Text>
    ) : null
  );

  const renderPost = ({ item }: { item: Post }) => {
    const image = getPostThumb(item);
    const liked = user ? item.likes?.includes(user._id) : false;
    const busy = busyId === item._id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={() => navigation.navigate('UserProfile', { userId: item.author._id })}
          activeOpacity={0.85}
        >
          <Avatar
            uri={item.author?.profileImage}
            userName={item.author?.userName}
            name={item.author?.name}
            size={40}
          />
          <View style={styles.authorText}>
            <Text style={styles.name}>{item.author?.name || 'Пользователь'}</Text>
            <Text style={styles.username}>@{item.author?.userName || 'avtotime'}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('PostComments', { postId: item._id })} activeOpacity={0.9}>
          {image ? (
            <View>
              <Image source={{ uri: image }} style={styles.postImage} />
              {item.mediaType === 'video' ? (
                <View style={styles.playOverlay}>
                  <View style={styles.playCircle}>
                    <Ionicons name="play" size={26} color="#fff" />
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.postImage, styles.noImage]}>
              <Ionicons name="text-outline" size={30} color={colors.textFaint} />
            </View>
          )}
          {item.caption ? <Text style={styles.caption} numberOfLines={4}>{item.caption}</Text> : null}
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item._id)}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={21} color={liked ? colors.danger : colors.textFaint} />
            <Text style={styles.actionText}>{item.likes?.length ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('PostComments', { postId: item._id })}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
            <Text style={styles.actionText}>{item.commentsCount ?? item.comments?.length ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeSaved(item._id)} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.text} /> : <Ionicons name="bookmark" size={21} color={colors.text} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton style={styles.skeletonThumb} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton style={{ width: '55%', height: 13 }} />
                <Skeleton style={{ width: '80%', height: 11 }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(item) => item._id}
      renderItem={renderPost}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={posts.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="bookmark-outline" size={44} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Сохранённых постов нет</Text>
          <Text style={styles.emptyText}>Нажмите значок закладки в ленте, чтобы сохранить публикацию.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  skeletonList: { padding: 12, gap: 10 },
  skeletonRow: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  skeletonThumb: { width: 72, height: 72, borderRadius: 10 },
  list: { padding: 12, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  countLine: { paddingVertical: 6, color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  card: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  authorText: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '900' },
  username: { color: colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: 1 },
  postImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  caption: { paddingHorizontal: 12, paddingTop: 10, color: colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 12, paddingVertical: 11 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  removeBtn: { marginLeft: 'auto', width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
