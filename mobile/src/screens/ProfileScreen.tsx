import React, { useCallback, useRef, useState } from 'react';
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
import { getPostThumb, getSavedPosts, getUserPosts, Post } from '../api/posts';
import { getReviews, getUserRatingStats, ReviewItem, ReviewStats } from '../api/reviews';
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

type ProfileTab = 'posts' | 'saved' | 'reviews';

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'posts', label: 'Публикации' },
  { key: 'saved', label: 'Сохранённые' },
  { key: 'reviews', label: 'Отзывы' },
];

export default function ProfileScreen({ navigation }: Props) {
  const { user, setUser } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [ratingStats, setRatingStats] = useState<ReviewStats>(emptyRatingStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState<ProfileTab>('posts');
  const [saved, setSaved] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const savedLoaded = useRef(false);
  const reviewsLoaded = useRef(false);

  const selectTab = useCallback((next: ProfileTab) => {
    setTab(next);
    if (next === 'saved' && !savedLoaded.current) {
      savedLoaded.current = true;
      setSavedLoading(true);
      getSavedPosts().then(setSaved).catch(() => {}).finally(() => setSavedLoading(false));
    }
    if (next === 'reviews' && !reviewsLoaded.current && user?._id) {
      reviewsLoaded.current = true;
      setReviewsLoading(true);
      getReviews({ targetUserId: user._id }).then((r) => setReviews(r.reviews)).catch(() => {}).finally(() => setReviewsLoading(false));
    }
  }, [user?._id]);

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
    // Also silently reload the data of the currently open tab.
    if (tab === 'saved') {
      getSavedPosts().then(setSaved).catch(() => {});
    }
    if (tab === 'reviews' && user?._id) {
      getReviews({ targetUserId: user._id }).then((r) => setReviews(r.reviews)).catch(() => {});
    }
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

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.hero}>
        <PressableScale style={styles.heroSettings} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={20} color="#fff" />
        </PressableScale>
        <View style={styles.heroRow}>
          <Image source={avatar} style={styles.avatar} />
          <View style={styles.heroInfo}>
            <Text style={styles.name} numberOfLines={1}>{user.name || 'Пользователь'}</Text>
            <Text style={styles.username} numberOfLines={1}>@{user.userName || 'avtotime'}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.planBadge}>{planLabel(activePlan)}</Text>
              {user.location ? <Text style={styles.locationBadge} numberOfLines={1}>{user.location}</Text> : null}
            </View>
          </View>
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
        <View style={styles.statDivider} />
        <PressableScale style={styles.stat} onPress={() => openFollowList('followers')}>
          <Text style={styles.statNum}>{user.followers?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Подписчики</Text>
        </PressableScale>
        <View style={styles.statDivider} />
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

      <View style={styles.tabsRow}>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <PressableScale
              key={t.key}
              scaleTo={0.97}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => selectTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]} numberOfLines={1}>{t.label}</Text>
            </PressableScale>
          ))}
        </View>
        <PressableScale style={styles.addBtn} onPress={() => navigation.navigate('CreatePost')}>
          <Ionicons name="add" size={24} color={colors.onAccent} />
        </PressableScale>
      </View>
    </View>
  );

  const renderReview = ({ item }: { item: ReviewItem }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        {item.reviewer?.profileImage ? (
          <Image source={{ uri: item.reviewer.profileImage }} style={styles.reviewAvatar} />
        ) : (
          <View style={[styles.reviewAvatar, styles.reviewAvatarFallback]}>
            <Text style={styles.reviewAvatarText}>{(item.reviewer?.name || 'A').slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.reviewAuthor}>
          <Text style={styles.reviewName} numberOfLines={1}>{item.reviewer?.name || 'Пользователь'}</Text>
          <Stars value={item.rating} />
        </View>
      </View>
      {item.title ? <Text style={styles.reviewTitle}>{item.title}</Text> : null}
      {item.comment ? <Text style={styles.reviewComment}>{item.comment}</Text> : null}
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

  const isGrid = tab !== 'reviews';
  const data: any[] = tab === 'posts' ? posts : tab === 'saved' ? saved : reviews;
  const tabLoading = tab === 'posts' ? loading : tab === 'saved' ? savedLoading : reviewsLoading;
  const empty = tab === 'posts'
    ? { icon: 'images-outline' as const, title: 'Публикаций пока нет', subtitle: 'Нажмите + вверху, чтобы создать первую публикацию.' }
    : tab === 'saved'
      ? { icon: 'bookmark-outline' as const, title: 'Нет сохранённых постов', subtitle: 'Сохраняйте понравившиеся посты, чтобы вернуться к ним позже.' }
      : { icon: 'star-outline' as const, title: 'Отзывов пока нет', subtitle: 'Отзывы по вашим объявлениям появятся здесь.' };

  return (
    <FlatList
      key={isGrid ? 'grid' : 'list'}
      style={styles.container}
      data={data}
      keyExtractor={(item: any) => item._id}
      renderItem={(isGrid ? renderPost : renderReview) as any}
      numColumns={isGrid ? 3 : 1}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={data.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        tabLoading ? (
          isGrid ? (
            <View style={styles.skeletonGrid}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={styles.gridItem}>
                  <Skeleton style={styles.gridImage} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.tabLoading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )
        ) : (
          <EmptyState icon={empty.icon} title={empty.title} subtitle={empty.subtitle} />
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

  hero: { backgroundColor: colors.ink, borderRadius: radius.xl, padding: space.lg, ...shadow.card },
  heroSettings: { position: 'absolute', top: space.md, right: space.md, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  heroInfo: { flex: 1, paddingRight: 36 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surfaceAlt, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  name: { color: colors.white, fontSize: font.h2, fontWeight: '900' },
  username: { marginTop: 2, color: 'rgba(255,255,255,0.65)', fontSize: font.small, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm, justifyContent: 'flex-start' },
  planBadge: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.accent, color: colors.onAccent, paddingHorizontal: 11, paddingVertical: 5, fontSize: font.tiny, fontWeight: '900' },
  locationBadge: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', color: colors.white, paddingHorizontal: 11, paddingVertical: 5, fontSize: font.tiny, fontWeight: '900' },

  bio: { color: colors.text, fontSize: font.body, lineHeight: 21, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow.card },
  verifyCard: { borderRadius: radius.lg, backgroundColor: 'rgba(246,178,61,0.14)', padding: space.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifyIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: 'rgba(246,178,61,0.22)', alignItems: 'center', justifyContent: 'center' },
  verifyBody: { flex: 1 },
  verifyTitle: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  verifyText: { marginTop: 3, color: colors.textMuted, fontSize: font.tiny, lineHeight: 17, fontWeight: '700' },

  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.sm, ...shadow.card },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.xs },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
  statNum: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  statLabel: { marginTop: 3, color: colors.textMuted, fontSize: font.tiny, fontWeight: '800', letterSpacing: 0.2 },

  ratingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, ...shadow.card },
  ratingIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: 'rgba(245,197,24,0.15)', alignItems: 'center', justifyContent: 'center' },
  ratingBody: { flex: 1 },
  ratingTitle: { color: colors.text, fontSize: font.small, fontWeight: '900' },
  ratingRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  ratingValue: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  ratingCount: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  tabs: { flex: 1, flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4 },
  tabBtn: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBtnActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '900' },
  tabTextActive: { color: colors.onAccent },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  tabLoading: { paddingVertical: space.xxl, alignItems: 'center' },

  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm, ...shadow.card },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceAlt },
  reviewAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  reviewAuthor: { flex: 1, gap: 3 },
  reviewName: { color: colors.text, fontSize: font.small, fontWeight: '900' },
  reviewTitle: { marginTop: 10, color: colors.text, fontSize: font.body, fontWeight: '900' },
  reviewComment: { marginTop: 6, color: colors.textMuted, fontSize: font.small, lineHeight: 19, fontWeight: '600' },

  gridItem: { width: '33.333%', aspectRatio: 1, padding: 2 },
  gridImage: { width: '100%', height: '100%', borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  gridNoImage: { alignItems: 'center', justifyContent: 'center', padding: 7, backgroundColor: colors.surface },
  gridVideoBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  textPost: { marginTop: 5, color: colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
});
