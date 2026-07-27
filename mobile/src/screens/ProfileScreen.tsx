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
import { colors, font, radius, shadow, space } from '../theme';
import { EmptyState, PressableScale, Skeleton } from '../components/ui';

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
          color={star <= value ? colors.star : colors.surfaceHi}
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
      if (!silent) Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Depend on the stable id, not the whole user object: load() calls
    // setUser, and depending on `user` would recreate load → refocus → loop.
  }, [setUser, user?._id]);

  // Refresh silently on focus — the header renders instantly from the stored
  // user, so there's no full-screen spinner blocking the screen.
  useFocusEffect(useCallback(() => {
    load(true);
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
      <View style={styles.hero}>
        <PressableScale style={styles.heroSettings} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={20} color="#fff" />
        </PressableScale>
        <Image source={avatar} style={styles.avatar} />
        <Text style={styles.name}>{user.name || 'Пользователь'}</Text>
        <Text style={styles.username}>@{user.userName || 'avtotime'}</Text>
        <View style={styles.badgeRow}>
          <Text style={styles.planBadge}>{planLabel(activePlan)}</Text>
          {user.location ? <Text style={styles.locationBadge} numberOfLines={1}>{user.location}</Text> : null}
        </View>
      </View>

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      {!user.isEmailVerified ? (
        <PressableScale style={styles.verifyCard} onPress={() => navigation.navigate('EmailVerification')}>
          <View style={styles.verifyIcon}>
            <Ionicons name="mail-unread-outline" size={22} color={colors.warning} />
          </View>
          <View style={styles.verifyBody}>
            <Text style={styles.verifyTitle}>Подтвердите email</Text>
            <Text style={styles.verifyText}>Это нужно для публикаций, loops, объявлений и заявок.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.warning} />
        </PressableScale>
      ) : null}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{postsTotal}</Text>
          <Text style={styles.statLabel}>Публикации</Text>
        </View>
        <PressableScale style={styles.stat} onPress={() => openFollowList('followers')}>
          <Text style={styles.statNum}>{user.followers?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Подписчики</Text>
        </PressableScale>
        <PressableScale style={styles.stat} onPress={() => openFollowList('following')}>
          <Text style={styles.statNum}>{user.following?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Подписки</Text>
        </PressableScale>
      </View>

      <PressableScale style={styles.ratingCard} onPress={() => navigation.navigate('MyReviews')}>
        <View style={styles.ratingIcon}>
          <Ionicons name="star" size={20} color={colors.star} />
        </View>
        <View style={styles.ratingBody}>
          <Text style={styles.ratingTitle}>Рейтинг продавца</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingValue}>{Number(ratingStats.avgRating || 0).toFixed(1)}</Text>
            <Stars value={Math.round(Number(ratingStats.avgRating || 0))} />
            <Text style={styles.ratingCount}>{ratingStats.totalReviews} отзывов</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </PressableScale>

      <View style={styles.mainActions}>
        <PressableScale style={styles.primaryBtn} onPress={() => navigation.navigate('CreatePost')}>
          <Ionicons name="add" size={18} color={colors.onAccent} />
          <Text style={styles.primaryText}>Публикация</Text>
        </PressableScale>
        <PressableScale style={styles.secondaryBtn} onPress={() => navigation.navigate('EditProfile')}>
          <Ionicons name="create-outline" size={18} color={colors.text} />
          <Text style={styles.secondaryText}>Профиль</Text>
        </PressableScale>
      </View>

      <View style={styles.quickGrid}>
        {[
          { icon: 'bookmarks-outline', label: 'Сохранённые посты', go: () => navigation.navigate('SavedPosts') },
          { icon: 'star-outline', label: 'Отзывы обо мне', go: () => navigation.navigate('MyReviews') },
        ].map((q) => (
          <PressableScale key={q.label} style={styles.quickCard} onPress={q.go}>
            <View style={styles.quickIcon}>
              <Ionicons name={q.icon as any} size={19} color={colors.text} />
            </View>
            <Text style={styles.quickTitle} numberOfLines={2}>{q.label}</Text>
          </PressableScale>
        ))}
      </View>

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Публикации</Text>
        <PressableScale onPress={confirmLogout}>
          <Text style={styles.logoutText}>Выйти</Text>
        </PressableScale>
      </View>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <PressableScale
      style={styles.gridItem}
      scaleTo={0.95}
      onPress={() => navigation.navigate('PostComments', { postId: item._id })}
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
          <Ionicons name="text-outline" size={20} color={colors.textFaint} />
          {item.caption ? <Text style={styles.textPost} numberOfLines={3}>{item.caption}</Text> : null}
        </View>
      )}
    </PressableScale>
  );

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(item) => item._id}
      renderItem={renderPost}
      numColumns={3}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={posts.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        loading ? (
          <View style={styles.skeletonGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.gridItem}>
                <Skeleton style={styles.gridImage} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="images-outline"
            title="Публикаций пока нет"
            subtitle="Создайте первую публикацию, и она появится в профиле."
            actionLabel="Создать"
            onAction={() => navigation.navigate('CreatePost')}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: space.md, paddingBottom: space.xxl },
  emptyList: { flexGrow: 1, padding: space.md, paddingBottom: space.xxl },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  header: { gap: space.md, marginBottom: space.md },

  hero: { backgroundColor: colors.ink, borderRadius: radius.xl, paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: 'center', ...shadow.card },
  heroSettings: { position: 'absolute', top: space.md, right: space.md, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceAlt, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  name: { color: colors.white, fontSize: font.h1, fontWeight: '900', marginTop: space.md },
  username: { marginTop: 2, color: 'rgba(255,255,255,0.65)', fontSize: font.small, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md, justifyContent: 'center' },
  planBadge: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.accent, color: colors.onAccent, paddingHorizontal: 11, paddingVertical: 5, fontSize: font.tiny, fontWeight: '900' },
  locationBadge: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', color: colors.white, paddingHorizontal: 11, paddingVertical: 5, fontSize: font.tiny, fontWeight: '900' },

  bio: { color: colors.text, fontSize: font.body, lineHeight: 21, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow.card },
  verifyCard: { borderRadius: radius.lg, backgroundColor: 'rgba(246,178,61,0.14)', padding: space.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifyIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: 'rgba(246,178,61,0.22)', alignItems: 'center', justifyContent: 'center' },
  verifyBody: { flex: 1 },
  verifyTitle: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  verifyText: { marginTop: 3, color: colors.textMuted, fontSize: font.tiny, lineHeight: 17, fontWeight: '700' },

  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', paddingVertical: space.md, ...shadow.card },
  statNum: { color: colors.text, fontSize: font.h2, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: font.tiny, fontWeight: '800' },

  ratingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, ...shadow.card },
  ratingIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: 'rgba(245,197,24,0.15)', alignItems: 'center', justifyContent: 'center' },
  ratingBody: { flex: 1 },
  ratingTitle: { color: colors.text, fontSize: font.small, fontWeight: '900' },
  ratingRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  ratingValue: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  ratingCount: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  mainActions: { flexDirection: 'row', gap: space.sm },
  primaryBtn: { flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, ...shadow.card },
  primaryText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
  secondaryBtn: { flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, ...shadow.card },
  secondaryText: { color: colors.text, fontSize: font.body, fontWeight: '900' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quickCard: { width: '48.5%', minHeight: 92, borderRadius: radius.lg, backgroundColor: colors.surface, padding: space.md, justifyContent: 'space-between', gap: 12, ...shadow.card },
  quickIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { color: colors.text, fontSize: font.small, fontWeight: '900', lineHeight: 18 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: space.xs },
  sectionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  logoutText: { color: colors.danger, fontSize: font.small, fontWeight: '900' },

  gridItem: { width: '33.333%', aspectRatio: 1, padding: 2 },
  gridImage: { width: '100%', height: '100%', borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  gridNoImage: { alignItems: 'center', justifyContent: 'center', padding: 7, backgroundColor: colors.surface },
  gridVideoBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  textPost: { marginTop: 5, color: colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
});
