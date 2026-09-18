import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { getMe } from '../api/auth';
import { getLikedPosts, getPostThumb, getSavedPosts, getUserPosts, Post } from '../api/posts';
import { getReviews, getUserRatingStats, ReviewItem, ReviewStats } from '../api/reviews';
import { getListingImage, getListingPrice, getListingTitle, loadMyMarketListings, MyMarketListing } from '../api/market';
import { DrivingTestResult, getDrivingResults } from '../api/driving';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { TAB_BAR_SPACE } from '../navigation/FloatingTabBar';
import { colors, font, radius, shadow, space } from '../theme';
import { Avatar, EmptyState, PressableScale, Skeleton } from '../components/ui';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList>;
  /** Профиль в соцсети и в маркете — разные экраны одной личности. */
  mode?: 'social' | 'market';
};

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

type ProfileTab = 'posts' | 'liked' | 'saved' | 'listings' | 'reviews' | 'driving';

interface TabDef {
  key: ProfileTab;
  /** Заголовок раздела: иконки в переключателе сами по себе немы. */
  title: string;
  on: keyof typeof Ionicons.glyphMap;
  off: keyof typeof Ionicons.glyphMap;
}

// В соцсети профиль — про контент и людей, в маркете — про торговлю:
// вкладки, статистика и кнопка «+» у режимов свои.
const SOCIAL_TABS: TabDef[] = [
  { key: 'posts', title: 'Мои публикации', on: 'grid', off: 'grid-outline' },
  { key: 'liked', title: 'Понравившиеся', on: 'heart', off: 'heart-outline' },
  { key: 'saved', title: 'Сохранённые', on: 'bookmark', off: 'bookmark-outline' },
];

const MARKET_TABS: TabDef[] = [
  { key: 'listings', title: 'Мои объявления', on: 'pricetags', off: 'pricetags-outline' },
  { key: 'reviews', title: 'Отзывы обо мне', on: 'star', off: 'star-outline' },
  { key: 'driving', title: 'Автокурсы', on: 'school', off: 'school-outline' },
];

const DRIVING_MODE_LABEL: Record<string, string> = {
  exam: 'Экзамен',
  practice: 'Практика',
  marathon: 'Марафон',
};

const formatWhen = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    + ', ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const formatTickets = (numbers?: number[]) => {
  const list = (numbers || []).filter((n) => Number.isFinite(n));
  if (!list.length) return 'Случайные вопросы';
  if (list.length === 1) return `Билет ${list[0]}`;
  return `Билеты ${list.slice(0, 3).join(', ')}${list.length > 3 ? ` и ещё ${list.length - 3}` : ''}`;
};

/** Иконка вкладки: две копии крест-накрест — цвет нативным драйвером не анимируется. */
function TabIcon({ tab, active }: { tab: TabDef; active: boolean }) {
  const a = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, a]);

  return (
    <View style={styles.tabIconBox}>
      <Animated.View style={{ opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
        <Ionicons name={tab.off} size={20} color={colors.textMuted} />
      </Animated.View>
      <Animated.View
        style={[
          styles.tabIconTop,
          {
            opacity: a,
            transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
      >
        <Ionicons name={tab.on} size={20} color={colors.onAccent} />
      </Animated.View>
    </View>
  );
}

/**
 * Переключатель разделов: индикатор физически едет к выбранной иконке.
 * Позиция и признак «уже размещён» живут в экране, а не здесь: смена
 * numColumns пересоздаёт список вместе с шапкой, и собственное состояние
 * переключателя обнулилось бы — индикатор прыгал бы вместо скольжения.
 */
function TabSwitcher({
  tabs, value, onChange, slide, placed,
}: {
  tabs: TabDef[];
  value: ProfileTab;
  onChange: (key: ProfileTab) => void;
  slide: Animated.Value;
  placed: React.MutableRefObject<boolean>;
}) {
  const [width, setWidth] = useState(0);

  const index = Math.max(0, tabs.findIndex((t) => t.key === value));
  const seg = width > 0 ? (width - 8) / tabs.length : 0;
  const targetX = 4 + seg * index;

  useEffect(() => {
    if (width <= 0) return;
    if (!placed.current) {
      placed.current = true;
      slide.setValue(targetX);
      return;
    }
    Animated.spring(slide, { toValue: targetX, useNativeDriver: true, speed: 15, bounciness: 8 }).start();
  }, [targetX, width, slide, placed]);

  return (
    <View style={styles.tabs} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {seg > 0 ? (
        <Animated.View style={[styles.tabIndicator, { width: seg, transform: [{ translateX: slide }] }]} />
      ) : null}
      {tabs.map((t) => (
        <PressableScale
          key={t.key}
          scaleTo={0.94}
          style={styles.tabBtn}
          onPress={() => onChange(t.key)}
        >
          <TabIcon tab={t} active={t.key === value} />
        </PressableScale>
      ))}
    </View>
  );
}

/** Мягкая смена содержимого раздела вместо мгновенной подмены. */
function TabFade({ trigger, children }: { trigger: string; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [trigger, a]);

  return (
    <Animated.View
      style={{
        opacity: a,
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function ProfileScreen({ navigation, mode = 'social' }: Props) {
  const isMarket = mode === 'market';
  const { user, setUser } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [listings, setListings] = useState<MyMarketListing[]>([]);
  const [ratingStats, setRatingStats] = useState<ReviewStats>(emptyRatingStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState<ProfileTab>(isMarket ? 'listings' : 'posts');
  const [saved, setSaved] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [driving, setDriving] = useState<DrivingTestResult[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [likedLoading, setLikedLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [drivingLoading, setDrivingLoading] = useState(false);
  const savedLoaded = useRef(false);
  const likedLoaded = useRef(false);
  const reviewsLoaded = useRef(false);
  const drivingLoaded = useRef(false);
  // Живут в экране, чтобы пережить пересоздание списка при смене раздела.
  const tabSlide = useRef(new Animated.Value(0)).current;
  const tabPlaced = useRef(false);

  const selectTab = useCallback((next: ProfileTab) => {
    setTab(next);
    if (next === 'saved' && !savedLoaded.current) {
      savedLoaded.current = true;
      setSavedLoading(true);
      getSavedPosts().then(setSaved).catch(() => {}).finally(() => setSavedLoading(false));
    }
    if (next === 'liked' && !likedLoaded.current) {
      likedLoaded.current = true;
      setLikedLoading(true);
      getLikedPosts().then(setLiked).catch(() => {}).finally(() => setLikedLoading(false));
    }
    if (next === 'reviews' && !reviewsLoaded.current && user?._id) {
      reviewsLoaded.current = true;
      setReviewsLoading(true);
      getReviews({ targetUserId: user._id }).then((r) => setReviews(r.reviews)).catch(() => {}).finally(() => setReviewsLoading(false));
    }
    if (next === 'driving' && !drivingLoaded.current) {
      drivingLoaded.current = true;
      setDrivingLoading(true);
      getDrivingResults({ limit: 30 }).then(setDriving).catch(() => {}).finally(() => setDrivingLoading(false));
    }
  }, [user?._id]);

  const load = useCallback(async (silent = false) => {
    if (!user?._id) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      if (isMarket) {
        const [freshUser, myListings, nextRatingStats] = await Promise.all([
          getMe().catch(() => user),
          loadMyMarketListings().catch(() => [] as MyMarketListing[]),
          getUserRatingStats(user._id).catch(() => emptyRatingStats),
        ]);
        setUser(freshUser);
        setListings(myListings);
        setRatingStats(nextRatingStats);
      } else {
        const [freshUser, postsPage] = await Promise.all([
          getMe().catch(() => user),
          getUserPosts(user._id),
        ]);
        setUser(freshUser);
        setPosts(postsPage.posts);
        setPostsTotal(postsPage.total);
      }
    } catch (e: any) {
      if (!silent) Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Depend on the stable id, not the whole user object: load() calls
    // setUser, and depending on `user` would recreate load → refocus → loop.
  }, [setUser, user?._id, isMarket]);

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
    if (tab === 'liked') {
      getLikedPosts().then(setLiked).catch(() => {});
    }
    if (tab === 'reviews' && user?._id) {
      getReviews({ targetUserId: user._id }).then((r) => setReviews(r.reviews)).catch(() => {});
    }
    if (tab === 'driving') {
      getDrivingResults({ limit: 30 }).then(setDriving).catch(() => {});
    }
    load(true);
  };

  if (!user) return null;

  const activePlan = user.effectivePlan || user.plan || 'free';
  const tabs = isMarket ? MARKET_TABS : SOCIAL_TABS;
  const activeTab = tabs.find((t) => t.key === tab) || tabs[0];
  const tabLoading =
    tab === 'saved' ? savedLoading
      : tab === 'liked' ? likedLoading
        : tab === 'reviews' ? reviewsLoading
          : tab === 'driving' ? drivingLoading
            : loading;
  // Пока раздел грузится, счётчик молчит — ноль читался бы как «пусто».
  const sectionCount = tabLoading
    ? null
    : tab === 'posts'
      ? postsTotal
      : tab === 'liked'
        ? liked.length
        : tab === 'saved'
          ? saved.length
          : tab === 'driving'
            ? driving.length
            : tab === 'listings'
            ? listings.length
            : ratingStats.totalReviews;

  const openFollowList = (mode: 'followers' | 'following') => {
    navigation.navigate('FollowList', {
      userId: user._id,
      mode,
      title: mode === 'followers' ? 'Подписчики' : 'Подписки',
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Личность лежит на самом фоне в обоих режимах; тариф — только в
          маркете, к соцсети уровень продавца отношения не имеет. */}
      <View style={styles.heroPlain}>
        <Avatar uri={user.profileImage} userName={user.userName} name={user.name} size={72} />
        <View style={styles.heroInfo}>
          <Text style={styles.namePlain} numberOfLines={1}>{user.name || 'Пользователь'}</Text>
          <Text style={styles.usernamePlain} numberOfLines={1}>@{user.userName || 'avtotime'}</Text>
          {isMarket ? (
            <View style={styles.badgeRow}>
              <Text style={styles.planBadge}>{planLabel(activePlan)}</Text>
              {user.location ? <Text style={styles.locationChip} numberOfLines={1}>{user.location}</Text> : null}
            </View>
          ) : user.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textFaint} />
              <Text style={styles.locationText} numberOfLines={1}>{user.location}</Text>
            </View>
          ) : null}
        </View>
        <PressableScale style={styles.settingsPlain} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </PressableScale>
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

      {isMarket ? (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{listings.length}</Text>
            <Text style={styles.statLabel}>Объявления</Text>
          </View>
          <View style={styles.statDivider} />
          <PressableScale style={styles.stat} onPress={() => navigation.navigate('MyReviews')}>
            <Text style={styles.statNum}>{ratingStats.totalReviews}</Text>
            <Text style={styles.statLabel}>Отзывы</Text>
          </PressableScale>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{Number(ratingStats.avgRating || 0).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Рейтинг</Text>
          </View>
        </View>
      ) : (
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
      )}

      <View style={styles.tabsRow}>
        <TabSwitcher tabs={tabs} value={tab} onChange={selectTab} slide={tabSlide} placed={tabPlaced} />
        <PressableScale
          style={styles.addBtn}
          onPress={() => navigation.navigate(isMarket ? 'CreateMarketListing' : 'CreatePost')}
        >
          <Ionicons name="add" size={24} color={colors.onAccent} />
        </PressableScale>
      </View>

      <TabFade trigger={`title-${tab}`}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{activeTab.title}</Text>
          {sectionCount !== null ? <Text style={styles.sectionCount}>{sectionCount}</Text> : null}
        </View>
      </TabFade>
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

  const renderListing = ({ item }: { item: MyMarketListing }) => (
    <PressableScale
      style={styles.gridItem}
      scaleTo={0.95}
      onPress={() => navigation.navigate('MarketListingDetails', { listing: item.listing, categoryId: item.categoryId })}
    >
      {getListingImage(item.listing) ? (
        <View>
          <Image source={{ uri: getListingImage(item.listing) }} style={styles.gridImage} />
          <View style={styles.gridPrice}>
            <Text style={styles.gridPriceText} numberOfLines={1}>{getListingPrice(item.listing, item.categoryId)}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.gridImage, styles.gridNoImage]}>
          <Ionicons name="pricetag-outline" size={20} color={colors.textFaint} />
          <Text style={styles.textPost} numberOfLines={3}>{getListingTitle(item.listing)}</Text>
        </View>
      )}
    </PressableScale>
  );

  /**
   * Строка истории автокурсов. Тап повторяет тот же билет, а для прогонов без
   * единственного билета (марафон, случайные вопросы) открывает разбор.
   */
  const renderDrivingResult = ({ item }: { item: DrivingTestResult }) => {
    const ticket = item.ticketNumbers?.length === 1 ? item.ticketNumbers[0] : undefined;
    const percentage = Math.round(Number(item.percentage || 0));
    return (
      <PressableScale
        style={styles.drivingCard}
        scaleTo={0.98}
        onPress={() => (ticket
          ? navigation.navigate('DrivingQuiz', { mode: item.mode, ticketNumber: ticket })
          : navigation.navigate('DrivingResults', { mode: item.mode }))}
      >
        <View style={[styles.drivingScore, item.passed ? styles.drivingScorePassed : styles.drivingScoreFailed]}>
          <Text style={[styles.drivingScoreText, item.passed && styles.drivingScoreTextPassed]}>{percentage}%</Text>
        </View>
        <View style={styles.drivingBody}>
          <Text style={styles.drivingTitle} numberOfLines={1}>{formatTickets(item.ticketNumbers)}</Text>
          <Text style={styles.drivingMeta} numberOfLines={1}>
            {DRIVING_MODE_LABEL[item.mode] || item.mode}
            {' · '}{item.correctAnswers}/{item.totalQuestions}
            {formatWhen(item.createdAt) ? ` · ${formatWhen(item.createdAt)}` : ''}
          </Text>
        </View>
        <Ionicons
          name={item.passed ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={item.passed ? colors.success : colors.danger}
        />
      </PressableScale>
    );
  };

  const isGrid = tab !== 'reviews' && tab !== 'driving';
  const data: any[] =
    tab === 'posts' ? posts
      : tab === 'liked' ? liked
        : tab === 'saved' ? saved
          : tab === 'listings' ? listings
            : tab === 'driving' ? driving
              : reviews;
  const empty = tab === 'posts'
    ? { icon: 'images-outline' as const, title: 'Публикаций пока нет', subtitle: 'Нажмите + вверху, чтобы создать первую публикацию.' }
    : tab === 'liked'
      ? { icon: 'heart-outline' as const, title: 'Пока ничего не понравилось', subtitle: 'Посты, которым вы поставите лайк, соберутся здесь.' }
      : tab === 'saved'
        ? { icon: 'bookmark-outline' as const, title: 'Нет сохранённых постов', subtitle: 'Сохраняйте понравившиеся посты, чтобы вернуться к ним позже.' }
        : tab === 'listings'
          ? { icon: 'pricetags-outline' as const, title: 'Объявлений пока нет', subtitle: 'Нажмите + вверху, чтобы разместить первое объявление.' }
          : tab === 'driving'
            ? { icon: 'school-outline' as const, title: 'Билеты ещё не решались', subtitle: 'Пройдите билет в разделе «Автокурсы» — история попыток появится здесь.' }
            : { icon: 'star-outline' as const, title: 'Отзывов пока нет', subtitle: 'Отзывы по вашим объявлениям появятся здесь.' };

  return (
    <FlatList
      key={isGrid ? 'grid' : 'list'}
      style={styles.container}
      data={data}
      keyExtractor={(item: any) => item.key || item._id}
      renderItem={(isGrid
        ? (tab === 'listings' ? renderListing : renderPost)
        : tab === 'driving' ? renderDrivingResult : renderReview) as any}
      numColumns={isGrid ? 3 : 1}
      // Именно элемент, а не функция: функция каждый рендер — новый ТИП
      // компонента, шапка размонтировалась бы, и индикатор вкладок вместо
      // скольжения возникал бы на новом месте заново.
      ListHeaderComponent={renderHeader()}
      contentContainerStyle={data.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        // trigger включает состояние загрузки: подсказка проявляется и когда
        // меняется вкладка, и когда скелетоны сменяются пустотой.
        <TabFade trigger={`${tab}-${tabLoading}`}>
          {tabLoading ? (
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
          )}
        </TabFade>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: space.md, paddingBottom: TAB_BAR_SPACE },
  emptyList: { flexGrow: 1, padding: space.md, paddingBottom: TAB_BAR_SPACE },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  header: { gap: space.md, marginBottom: space.md },

  heroInfo: { flex: 1 },
  heroPlain: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.xs, paddingTop: space.xs },
  namePlain: { color: colors.text, fontSize: font.h1, fontWeight: '900' },
  usernamePlain: { marginTop: 2, color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  locationText: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  settingsPlain: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7, justifyContent: 'flex-start' },
  planBadge: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.accent, color: colors.onAccent, paddingHorizontal: 11, paddingVertical: 5, fontSize: font.tiny, fontWeight: '900' },
  locationChip: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, color: colors.textMuted, paddingHorizontal: 11, paddingVertical: 5, fontSize: font.tiny, fontWeight: '900' },

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

  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  tabs: { flex: 1, flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4 },
  tabIndicator: { position: 'absolute', left: 0, top: 4, bottom: 4, borderRadius: radius.pill, backgroundColor: colors.accent },
  tabBtn: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabIconBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  tabIconTop: { position: 'absolute' },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.card },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, paddingHorizontal: space.xs },
  sectionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  sectionCount: { color: colors.textFaint, fontSize: font.small, fontWeight: '900' },
  tabLoading: { paddingVertical: space.xxl, alignItems: 'center' },

  drivingCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    marginBottom: space.sm, ...shadow.card,
  },
  drivingScore: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  drivingScorePassed: { backgroundColor: 'rgba(61,214,140,0.16)' },
  drivingScoreFailed: { backgroundColor: colors.surfaceAlt },
  drivingScoreText: { color: colors.textMuted, fontSize: font.small, fontWeight: '900' },
  drivingScoreTextPassed: { color: colors.success },
  drivingBody: { flex: 1 },
  drivingTitle: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  drivingMeta: { marginTop: 4, color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },

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
  gridPrice: { position: 'absolute', left: 6, bottom: 6, maxWidth: '85%', borderRadius: radius.pill, backgroundColor: 'rgba(8,8,10,0.72)', paddingHorizontal: 8, paddingVertical: 3 },
  gridPriceText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  textPost: { marginTop: 5, color: colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
});
