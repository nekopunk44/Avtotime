import React, { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '../store/toastStore';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFollowStatus, getUserById, toggleFollow } from '../api/users';
import { getPostThumb, getUserPosts, Post } from '../api/posts';
import { getUserRatingStats, ReviewStats } from '../api/reviews';
import { useAuthStore } from '../store/authStore';
import { User } from '../api/auth';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors, font, radius, shadow, space } from '../theme';
import ReportSheet from '../components/ReportSheet';
import { Avatar, EmptyState, PressableScale } from '../components/ui';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'UserProfile'>;
  route: RouteProp<AppStackParamList, 'UserProfile'>;
};

const getUserRefId = (ref: User['followers'][number]) => (typeof ref === 'string' ? ref : ref._id);

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

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  // Содержимое всплывает при открытии: переход к чужому профилю перестаёт
  // быть подменой экрана.
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appear]);
  const me = useAuthStore((s) => s.user);
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [ratingStats, setRatingStats] = useState<ReviewStats>(emptyRatingStats);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [freshUser, postsPage, status, nextRatingStats] = await Promise.all([
        getUserById(userId),
        getUserPosts(userId),
        getFollowStatus(userId).catch(() => ({ isFollowing: false })),
        getUserRatingStats(userId).catch(() => emptyRatingStats),
      ]);
      setUser(freshUser);
      // В шапке ник, а не имя: имя и так крупно стоит строкой ниже, а ник
      // короче и однозначно называет, чей это профиль.
      navigation.setOptions({ title: freshUser.userName ? `@${freshUser.userName}` : 'Профиль' });
      setPosts(postsPage.posts);
      setPostsTotal(postsPage.total);
      setIsFollowing(status.isFollowing);
      setRatingStats(nextRatingStats);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось загрузить профиль', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation, userId]);

  const hasProfile = !!user;
  useFocusEffect(useCallback(() => {
    // Silent when profile data already exists — no full-screen spinner on every return
    loadProfile(hasProfile);
  }, [loadProfile, hasProfile]));

  const refresh = () => {
    setRefreshing(true);
    loadProfile(true);
  };

  const handleFollow = async () => {
    if (!user) return;
    setFollowLoading(true);
    try {
      await toggleFollow(userId);
      setIsFollowing((prev) => !prev);
      setUser((prev) => (prev ? {
        ...prev,
        followers: isFollowing
          ? prev.followers.filter((item) => getUserRefId(item) !== me?._id)
          : [...prev.followers, me!._id],
      } : prev));
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось обновить подписку', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const openFollowList = (mode: 'followers' | 'following') => {
    navigation.navigate('FollowList', {
      userId,
      mode,
      title: mode === 'followers' ? 'Подписчики' : 'Подписки',
    });
  };

  const openUrl = async (value?: string) => {
    if (!value) return;
    const url = value.startsWith('http') ? value : `https://${value}`;
    try {
      await Linking.openURL(url);
    } catch {
      showToast('Не удалось открыть ссылку', 'error');
    }
  };

  if (loading || !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const isMe = me?._id === userId;

  const rating = Number(ratingStats.avgRating || 0);
  const hasRating = ratingStats.totalReviews > 0;

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.header,
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      {/* Личность на самом фоне, как в своём профиле: карточка вокруг имени
          только дробила экран. */}
      <View style={styles.hero}>
        <Avatar uri={user.profileImage} userName={user.userName} name={user.name} size={72} />
        <View style={styles.heroInfo}>
          <Text style={styles.name} numberOfLines={1}>{user.name || 'Пользователь'}</Text>
          <Text style={styles.username} numberOfLines={1}>@{user.userName || 'avtotime'}</Text>
          {user.profession || user.location ? (
            <View style={styles.metaRow}>
              <Ionicons
                name={user.profession ? 'briefcase-outline' : 'location-outline'}
                size={13}
                color={colors.textFaint}
              />
              <Text style={styles.metaText} numberOfLines={1}>{user.profession || user.location}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

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

      {/* Рейтинг строкой, а не карточкой в половину экрана: цифра со звёздами
          и переход к отзывам — всё, что от неё нужно. */}
      <PressableScale
        style={styles.ratingRow}
        scaleTo={0.98}
        onPress={() => navigation.navigate('UserReviews', {
          userId,
          title: user.name || user.userName || 'Отзывы',
        })}
      >
        <Ionicons name="star" size={16} color={hasRating ? colors.star : colors.textFaint} />
        <Text style={styles.ratingText}>
          {hasRating ? `${rating.toFixed(1)} · ${ratingStats.totalReviews} отзывов` : 'Отзывов пока нет'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </PressableScale>

      {isMe ? (
        <PressableScale style={styles.primaryBtn} scaleTo={0.98} onPress={() => navigation.navigate('EditProfile')}>
          <Ionicons name="create-outline" size={18} color={colors.onAccent} />
          <Text style={styles.primaryText}>Редактировать профиль</Text>
        </PressableScale>
      ) : (
        <View style={styles.actions}>
          <PressableScale
            style={[styles.primaryBtn, styles.primaryGrow, isFollowing && styles.followingBtn]}
            scaleTo={0.98}
            onPress={handleFollow}
          >
            {followLoading ? (
              <ActivityIndicator color={isFollowing ? colors.text : colors.onAccent} />
            ) : (
              <>
                <Ionicons
                  name={isFollowing ? 'checkmark' : 'person-add-outline'}
                  size={18}
                  color={isFollowing ? colors.text : colors.onAccent}
                />
                <Text style={[styles.primaryText, isFollowing && styles.followingText]}>
                  {isFollowing ? 'Вы подписаны' : 'Подписаться'}
                </Text>
              </>
            )}
          </PressableScale>

          {/* Сообщение и жалоба — значками: подписка тут главное действие. */}
          <PressableScale
            style={styles.iconBtn}
            scaleTo={0.94}
            onPress={() => navigation.navigate('Chat', { userId, name: user.name, userName: user.userName ?? '' })}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.text} />
          </PressableScale>
          <PressableScale style={styles.iconBtn} scaleTo={0.94} onPress={() => setShowReport(true)}>
            <Ionicons name="ellipsis-horizontal" size={19} color={colors.text} />
          </PressableScale>
        </View>
      )}

      {user.website || user.instagram || user.telegram ? (
        <View style={styles.linkRow}>
          {user.website ? (
            <PressableScale style={styles.linkChip} scaleTo={0.95} onPress={() => openUrl(user.website)}>
              <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
              <Text style={styles.linkText} numberOfLines={1}>{user.website.replace(/^https?:\/\//, '')}</Text>
            </PressableScale>
          ) : null}
          {user.instagram ? (
            <View style={styles.linkChip}>
              <Ionicons name="logo-instagram" size={14} color={colors.textMuted} />
              <Text style={styles.linkText} numberOfLines={1}>{user.instagram}</Text>
            </View>
          ) : null}
          {user.telegram ? (
            <View style={styles.linkChip}>
              <Ionicons name="paper-plane-outline" size={14} color={colors.textMuted} />
              <Text style={styles.linkText} numberOfLines={1}>{user.telegram}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Публикации</Text>
        {postsTotal ? <Text style={styles.sectionCount}>{postsTotal}</Text> : null}
      </View>
    </Animated.View>
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
              <Ionicons name="play" size={13} color={colors.white} />
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
    <>
      <FlatList
        style={styles.container}
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderPost}
        numColumns={3}
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={posts.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <EmptyState
            icon="images-outline"
            title="Публикаций пока нет"
            subtitle="Когда пользователь опубликует посты, они появятся здесь."
          />
        }
      />
      <ReportSheet
        visible={showReport}
        targetType="user"
        targetId={userId}
        onClose={() => setShowReport(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  list: { padding: space.md, paddingBottom: space.xxl },
  emptyList: { flexGrow: 1, padding: space.md, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.md },

  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.xs, paddingTop: space.xs },
  heroInfo: { flex: 1 },
  name: { color: colors.text, fontSize: font.h1, fontWeight: '900' },
  username: { marginTop: 2, color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  metaText: { flexShrink: 1, color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  bio: { color: colors.textMuted, fontSize: font.small, lineHeight: 20, fontWeight: '600', paddingHorizontal: space.xs },

  stats: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.lg, paddingVertical: space.sm, ...shadow.card,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.xs },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
  statNum: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  statLabel: { marginTop: 3, color: colors.textMuted, fontSize: font.tiny, fontWeight: '800', letterSpacing: 0.2 },

  ratingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 46, paddingHorizontal: space.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  ratingText: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '800' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  primaryBtn: {
    height: 48, borderRadius: radius.pill, backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  primaryGrow: { flex: 1 },
  primaryText: { color: colors.onAccent, fontSize: font.small, fontWeight: '900' },
  followingBtn: { backgroundColor: colors.surfaceAlt },
  followingText: { color: colors.text },
  iconBtn: {
    width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },

  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  linkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    maxWidth: '100%', height: 34, paddingHorizontal: space.md,
    borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
  },
  linkText: { flexShrink: 1, color: colors.textMuted, fontSize: font.tiny, fontWeight: '800' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  sectionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  sectionCount: { color: colors.textFaint, fontSize: font.small, fontWeight: '900' },

  gridItem: { width: '33.333%', aspectRatio: 1, padding: 2 },
  gridImage: { width: '100%', height: '100%', borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  gridNoImage: { alignItems: 'center', justifyContent: 'center', padding: 7, backgroundColor: colors.surface },
  gridVideoBadge: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  textPost: { marginTop: 5, color: colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
