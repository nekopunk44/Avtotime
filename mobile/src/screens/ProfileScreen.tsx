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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { getMe } from '../api/auth';
import { getPostThumb, getUserPosts, Post } from '../api/posts';
import { getUserRatingStats, ReviewStats } from '../api/reviews';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

const planLabel = (plan?: string) => {
  if (plan === 'business') return 'Business';
  if (plan === 'pro') return 'Pro Seller';
  return 'Базовый';
};

const emptyRatingStats: ReviewStats = {
  totalReviews: 0,
  avgRating: 0,
  ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
};

function Stars({ value }: { value: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= value ? 'star' : 'star-outline'}
          size={17}
          color={star <= value ? '#f5a400' : '#ccc'}
        />
      ))}
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const { user, setUser, logout } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [ratingStats, setRatingStats] = useState<ReviewStats>(emptyRatingStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!user?._id) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const [freshUser, postsPage, nextRatingStats] = await Promise.all([
        getMe().catch(() => user),
        getUserPosts(user._id),
        getUserRatingStats(user._id).catch(() => emptyRatingStats),
      ]);
      setUser(freshUser);
      setPosts(postsPage.posts);
      setPostsTotal(postsPage.total);
      setRatingStats(nextRatingStats);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Depend on the stable id, not the whole user object: load() calls
    // setUser, and depending on `user` would recreate load → refocus → loop.
  }, [setUser, user?._id]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (!user) return null;

  const avatar = user.profileImage ? { uri: user.profileImage } : require('../../assets/icon.png');
  const activePlan = user.effectivePlan || user.plan || 'free';

  const openFollowList = (mode: 'followers' | 'following') => {
    navigation.navigate('FollowList', {
      userId: user._id,
      mode,
      title: mode === 'followers' ? 'Подписчики' : 'Подписки',
    });
  };

  const confirmLogout = () => {
    Alert.alert('Выйти?', 'Вы выйдете из мобильного приложения.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.profileTop}>
        <Image source={avatar} style={styles.avatar} />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{user.name || 'Пользователь'}</Text>
          <Text style={styles.username}>@{user.userName || 'avtotime'}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.planBadge}>{planLabel(activePlan)}</Text>
            {user.location ? (
              <Text style={styles.locationBadge} numberOfLines={1}>{user.location}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={21} color="#111" />
        </TouchableOpacity>
      </View>

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      {!user.isEmailVerified ? (
        <TouchableOpacity
          style={styles.verifyCard}
          onPress={() => navigation.navigate('EmailVerification')}
          activeOpacity={0.86}
        >
          <View style={styles.verifyIcon}>
            <Ionicons name="mail-unread-outline" size={22} color="#a85b00" />
          </View>
          <View style={styles.verifyBody}>
            <Text style={styles.verifyTitle}>Подтвердите email</Text>
            <Text style={styles.verifyText}>Это нужно для публикаций, loops, объявлений и заявок.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#a85b00" />
        </TouchableOpacity>
      ) : null}

      <View style={styles.stats}>
        <TouchableOpacity style={styles.stat} onPress={() => {}}>
          <Text style={styles.statNum}>{postsTotal}</Text>
          <Text style={styles.statLabel}>Публикации</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stat} onPress={() => openFollowList('followers')}>
          <Text style={styles.statNum}>{user.followers?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Подписчики</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stat} onPress={() => openFollowList('following')}>
          <Text style={styles.statNum}>{user.following?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Подписки</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.ratingCard}
        onPress={() => navigation.navigate('MyReviews')}
        activeOpacity={0.86}
      >
        <View style={styles.ratingIcon}>
          <Ionicons name="star-outline" size={22} color="#f5a400" />
        </View>
        <View style={styles.ratingBody}>
          <Text style={styles.ratingTitle}>Рейтинг продавца</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingValue}>{Number(ratingStats.avgRating || 0).toFixed(1)}</Text>
            <Stars value={Math.round(Number(ratingStats.avgRating || 0))} />
            <Text style={styles.ratingCount}>{ratingStats.totalReviews} отзывов</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#aaa" />
      </TouchableOpacity>

      <View style={styles.mainActions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('CreatePost')}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.primaryText}>Публикация</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('EditProfile')}>
          <Ionicons name="create-outline" size={18} color="#111" />
          <Text style={styles.secondaryText}>Профиль</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickGrid}>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('MarketTabs', { screen: 'MyListings' })}>
          <Ionicons name="albums-outline" size={21} color="#111" />
          <Text style={styles.quickTitle}>Мои объявления</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('MarketTabs', { screen: 'Favorites' })}>
          <Ionicons name="bookmark-outline" size={21} color="#111" />
          <Text style={styles.quickTitle}>Маркет избранное</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('SavedPosts')}>
          <Ionicons name="bookmarks-outline" size={21} color="#111" />
          <Text style={styles.quickTitle}>Сохранённые посты</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('MarketAnalytics')}>
          <Ionicons name="bar-chart-outline" size={21} color="#111" />
          <Text style={styles.quickTitle}>Аналитика</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('MyReviews')}>
          <Ionicons name="star-outline" size={21} color="#111" />
          <Text style={styles.quickTitle}>Отзывы обо мне</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('Billing')}>
          <Ionicons name="card-outline" size={21} color="#111" />
          <Text style={styles.quickTitle}>Тарифы</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Публикации</Text>
        <TouchableOpacity onPress={confirmLogout}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => navigation.navigate('PostComments', { postId: item._id })}
      activeOpacity={0.85}
    >
      {getPostThumb(item) ? (
        <View>
          <Image source={{ uri: getPostThumb(item) }} style={styles.gridImage} />
          {item.mediaType === 'video' ? (
            <View style={styles.gridVideoBadge}>
              <Ionicons name="play" size={13} color="#fff" />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.gridImage, styles.gridNoImage]}>
          <Ionicons name="text-outline" size={20} color="#aaa" />
          {item.caption ? <Text style={styles.textPost} numberOfLines={3}>{item.caption}</Text> : null}
        </View>
      )}
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
      data={posts}
      keyExtractor={(item) => item._id}
      renderItem={renderPost}
      numColumns={3}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={posts.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={42} color="#bbb" />
          <Text style={styles.emptyTitle}>Публикаций пока нет</Text>
          <Text style={styles.emptyText}>Создайте первую публикацию, и она появится в профиле.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CreatePost')}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Создать</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f5f7' },
  list: { padding: 12, paddingBottom: 28 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 12, marginBottom: 12 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ececec', padding: 12 },
  avatar: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#eee' },
  profileInfo: { flex: 1 },
  name: { color: '#111', fontSize: 22, fontWeight: '900' },
  username: { marginTop: 2, color: '#777', fontSize: 13, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  planBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#111', color: '#fff', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  locationBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#f2f2f2', color: '#555', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  iconBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  bio: { color: '#333', fontSize: 14, lineHeight: 21, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ececec', padding: 12 },
  verifyCard: { borderRadius: 8, backgroundColor: '#fff8ec', borderWidth: 1, borderColor: '#ffe0ad', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifyIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff2d8', alignItems: 'center', justifyContent: 'center' },
  verifyBody: { flex: 1 },
  verifyTitle: { color: '#111', fontSize: 15, fontWeight: '900' },
  verifyText: { marginTop: 3, color: '#8a5a16', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', alignItems: 'center', paddingVertical: 12 },
  statNum: { color: '#111', fontSize: 20, fontWeight: '900' },
  statLabel: { marginTop: 2, color: '#777', fontSize: 11, fontWeight: '800' },
  ratingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ececec', padding: 12 },
  ratingIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff8ec', alignItems: 'center', justifyContent: 'center' },
  ratingBody: { flex: 1 },
  ratingTitle: { color: '#111', fontSize: 14, fontWeight: '900' },
  ratingRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  ratingValue: { color: '#111', fontSize: 18, fontWeight: '900' },
  ratingCount: { color: '#777', fontSize: 12, fontWeight: '800' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  mainActions: { flexDirection: 'row', gap: 8 },
  primaryBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryText: { color: '#111', fontSize: 14, fontWeight: '900' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickCard: { width: '48.9%', minHeight: 72, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', padding: 12, justifyContent: 'center', gap: 7 },
  quickTitle: { color: '#111', fontSize: 13, fontWeight: '900' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  sectionTitle: { color: '#111', fontSize: 18, fontWeight: '900' },
  logoutText: { color: '#d92323', fontSize: 13, fontWeight: '900' },
  gridItem: { width: '33.333%', aspectRatio: 1, padding: 1.5 },
  gridImage: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#eee' },
  gridNoImage: { alignItems: 'center', justifyContent: 'center', padding: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  gridVideoBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  textPost: { marginTop: 5, color: '#555', fontSize: 10, textAlign: 'center', lineHeight: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: '#111', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: '#777', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { marginTop: 15, height: 42, borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
