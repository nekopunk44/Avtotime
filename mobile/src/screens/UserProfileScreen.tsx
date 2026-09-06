import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { colors } from '../theme';
import ReportSheet from '../components/ReportSheet';

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
      navigation.setOptions({ title: freshUser.name || freshUser.userName });
      setPosts(postsPage.posts);
      setPostsTotal(postsPage.total);
      setIsFollowing(status.isFollowing);
      setRatingStats(nextRatingStats);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить профиль');
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
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить подписку');
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
      Alert.alert('Ссылка', 'Не удалось открыть ссылку');
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
  const avatar = user.profileImage ? { uri: user.profileImage } : require('../../assets/icon.png');

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.profileTop}>
        <Image source={avatar} style={styles.avatar} />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{user.name || 'Пользователь'}</Text>
          <Text style={styles.username}>@{user.userName || 'avtotime'}</Text>
          {user.profession || user.location ? (
            <Text style={styles.meta} numberOfLines={1}>{user.profession || user.location}</Text>
          ) : null}
        </View>
      </View>

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{postsTotal}</Text>
          <Text style={styles.statLabel}>Публикации</Text>
        </View>
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
        activeOpacity={0.86}
        onPress={() => navigation.navigate('UserReviews', {
          userId,
          title: user.name || user.userName || 'Отзывы',
        })}
      >
        <View style={styles.ratingIcon}>
          <Ionicons name="star-outline" size={22} color={colors.star} />
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
      </TouchableOpacity>

      {isMe ? (
        <View style={styles.mainActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('EditProfile')}>
            <Ionicons name="create-outline" size={18} color={colors.onAccent} />
            <Text style={styles.primaryText}>Редактировать</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mainActions}>
          <TouchableOpacity
            style={[styles.primaryBtn, isFollowing && styles.followingBtn]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator color={isFollowing ? colors.text : colors.onAccent} />
            ) : (
              <>
                <Ionicons name={isFollowing ? 'checkmark-outline' : 'person-add-outline'} size={18} color={isFollowing ? colors.text : colors.onAccent} />
                <Text style={[styles.primaryText, isFollowing && styles.followingText]}>
                  {isFollowing ? 'Вы подписаны' : 'Подписаться'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Chat', { userId, name: user.name, userName: user.userName ?? '' })}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryText}>Сообщение</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowReport(true)}
            accessibilityLabel="Пожаловаться"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {(user.website || user.instagram || user.telegram || user.location) ? (
        <View style={styles.infoCard}>
          {user.location ? (
            <View style={styles.infoLine}>
              <Ionicons name="location-outline" size={17} color={colors.textMuted} />
              <Text style={styles.infoText}>{user.location}</Text>
            </View>
          ) : null}
          {user.website ? (
            <TouchableOpacity style={styles.infoLine} onPress={() => openUrl(user.website)}>
              <Ionicons name="globe-outline" size={17} color={colors.textMuted} />
              <Text style={styles.infoLink} numberOfLines={1}>{user.website}</Text>
            </TouchableOpacity>
          ) : null}
          {user.instagram ? (
            <Text style={styles.infoText}>Instagram: {user.instagram}</Text>
          ) : null}
          {user.telegram ? (
            <Text style={styles.infoText}>Telegram: {user.telegram}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Публикации</Text>
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
    </TouchableOpacity>
  );

  return (
    <>
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
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={42} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Публикаций пока нет</Text>
          <Text style={styles.emptyText}>Когда пользователь опубликует посты, они появятся здесь.</Text>
        </View>
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
  list: { padding: 12, paddingBottom: 28 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 12, marginBottom: 12 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  avatar: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.surfaceAlt },
  profileInfo: { flex: 1 },
  name: { color: colors.text, fontSize: 22, fontWeight: '900' },
  username: { marginTop: 2, color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  meta: { marginTop: 6, color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  bio: { color: colors.textMuted, fontSize: 14, lineHeight: 21, backgroundColor: colors.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', paddingVertical: 12 },
  statNum: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  ratingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  ratingIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(246,178,61,0.14)', alignItems: 'center', justifyContent: 'center' },
  ratingBody: { flex: 1 },
  ratingTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  ratingRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  ratingValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  ratingCount: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  mainActions: { flexDirection: 'row', gap: 8 },
  primaryBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { color: colors.onAccent, fontSize: 14, fontWeight: '900' },
  followingBtn: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  followingText: { color: colors.text },
  secondaryBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  iconBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  infoCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12, gap: 8 },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  infoLink: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  sectionTitleRow: { paddingHorizontal: 2 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  gridItem: { width: '33.333%', aspectRatio: 1, padding: 1.5 },
  gridImage: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: colors.surfaceAlt },
  gridNoImage: { alignItems: 'center', justifyContent: 'center', padding: 7, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  gridVideoBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  textPost: { marginTop: 5, color: colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
