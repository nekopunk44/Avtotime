import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getReviews, ReviewItem, ReviewStats } from '../api/reviews';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'UserReviews'>;
  route: RouteProp<AppStackParamList, 'UserReviews'>;
};

const emptyStats: ReviewStats = {
  totalReviews: 0,
  avgRating: 0,
  ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const reviewerName = (review: ReviewItem) =>
  review.reviewer?.name || review.reviewer?.userName || 'Пользователь';

const listingTypeLabel = (type?: string) => {
  if (type === 'car') return 'Авто';
  if (type === 'car-service') return 'Сервис';
  if (type === 'auto-tuning') return 'Тюнинг';
  if (type === 'consultation') return 'Консультация';
  if (type === 'dry-cleaning') return 'Химчистка';
  return 'Отзыв';
};

function Stars({ value, size = 17 }: { value: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= value ? 'star' : 'star-outline'}
          size={size}
          color={star <= value ? colors.star : colors.textFaint}
        />
      ))}
    </View>
  );
}

export default function UserReviewsScreen({ route, navigation }: Props) {
  const { userId, title } = route.params;
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await getReviews({ targetUserId: userId });
      setReviews(response.reviews);
      setStats(response.stats);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить отзывы');
      setReviews([]);
      setStats(emptyStats);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: title || 'Отзывы' });
    load();
  }, [load, navigation, title]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const avg = Number(stats.avgRating || 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <View style={styles.summary}>
        <View style={styles.scoreBox}>
          <Text style={styles.score}>{avg.toFixed(1)}</Text>
          <Stars value={Math.round(avg)} />
          <Text style={styles.scoreMeta}>{stats.totalReviews} отзывов</Text>
        </View>
        <View style={styles.breakdown}>
          {[5, 4, 3, 2, 1].map((item) => {
            const count = stats.ratingBreakdown[String(item) as '1' | '2' | '3' | '4' | '5'] || 0;
            const width = stats.totalReviews ? `${Math.max(8, (count / stats.totalReviews) * 100)}%` : '0%';
            return (
              <View key={item} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item}</Text>
                <View style={styles.breakdownTrack}>
                  <View style={[styles.breakdownFill, { width: width as any }]} />
                </View>
                <Text style={styles.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={21} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {reviews.length ? reviews.map((review) => (
        <View key={review._id} style={styles.card}>
          <View style={styles.cardTop}>
            {review.reviewer?.profileImage ? (
              <Image source={{ uri: review.reviewer.profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{reviewerName(review).slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.authorBlock}>
              <Text style={styles.authorName}>{reviewerName(review)}</Text>
              <Text style={styles.dateText}>{formatDate(review.createdAt)}</Text>
            </View>
            <Stars value={review.rating} />
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.typePill}>{listingTypeLabel(review.listingType)}</Text>
            {review.isVerifiedPurchase ? <Text style={styles.verifiedPill}>Проверенная сделка</Text> : null}
          </View>

          {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
          {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
          {review.pros?.length ? (
            <Text style={styles.listText}><Text style={styles.listStrong}>Плюсы: </Text>{review.pros.join(', ')}</Text>
          ) : null}
          {review.cons?.length ? (
            <Text style={styles.listText}><Text style={styles.listStrong}>Минусы: </Text>{review.cons.join(', ')}</Text>
          ) : null}
        </View>
      )) : (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={42} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Отзывов пока нет</Text>
          <Text style={styles.emptyText}>Когда пользователи оставят отзывы по объявлениям этого профиля, они появятся здесь.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: 12, paddingBottom: 30, gap: 10 },
  summary: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  scoreBox: { width: 108, alignItems: 'center', justifyContent: 'center' },
  score: { color: colors.text, fontSize: 34, fontWeight: '900' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scoreMeta: { marginTop: 5, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  breakdown: { flex: 1, gap: 6, justifyContent: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  breakdownLabel: { width: 12, color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  breakdownTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 4, backgroundColor: colors.star },
  breakdownCount: { width: 24, color: colors.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  errorBox: { borderRadius: 12, backgroundColor: 'rgba(255,90,95,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,90,95,0.25)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  authorBlock: { flex: 1 },
  authorName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  dateText: { marginTop: 2, color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  typePill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 11, fontWeight: '900' },
  verifiedPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(61,214,140,0.14)', color: colors.success, fontSize: 11, fontWeight: '900' },
  reviewTitle: { marginTop: 10, color: colors.text, fontSize: 15, fontWeight: '900' },
  comment: { marginTop: 5, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  listText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  listStrong: { color: colors.text, fontWeight: '900' },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 42, paddingHorizontal: 20 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
