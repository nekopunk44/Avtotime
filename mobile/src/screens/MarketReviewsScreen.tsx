import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DimensionValue,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  addReview,
  deleteReview,
  getReviews,
  getReviewListingType,
  markReviewHelpful,
  markReviewUnhelpful,
  ReviewItem,
  ReviewStats,
  updateReview,
} from '../api/reviews';
import { getAuthorId, getListingImage, getListingTitle } from '../api/market';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'MarketReviews'>;
  route: RouteProp<AppStackParamList, 'MarketReviews'>;
};

const emptyStats: ReviewStats = {
  totalReviews: 0,
  avgRating: 0,
  ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
};

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getUserName = (review: ReviewItem) =>
  review.reviewer?.name || review.reviewer?.userName || 'Пользователь';

export default function MarketReviewsScreen({ navigation, route }: Props) {
  const { listing, categoryId } = route.params;
  const user = useAuthStore((s) => s.user);
  const targetUserId = getAuthorId(listing);
  const listingId = listing._id || '';
  const listingType = getReviewListingType(categoryId);
  const listingTitle = getListingTitle(listing);
  const listingImage = getListingImage(listing);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');

  const myReview = useMemo(
    () => reviews.find((review) => review.reviewer?._id === user?._id),
    [reviews, user?._id],
  );
  const isMyListing = !!user?._id && targetUserId === user._id;

  const hydrateForm = useCallback((review?: ReviewItem) => {
    if (!review) {
      setRating(5);
      setTitle('');
      setComment('');
      setPros('');
      setCons('');
      return;
    }

    setRating(review.rating || 5);
    setTitle(review.title || '');
    setComment(review.comment || '');
    setPros(review.pros?.join(', ') || '');
    setCons(review.cons?.join(', ') || '');
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const response = await getReviews({
        targetUserId,
        listingId: listingId || undefined,
        listingType,
      });
      setReviews(response.reviews);
      setStats(response.stats);
      const own = response.reviews.find((review) => review.reviewer?._id === user?._id);
      hydrateForm(own);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить отзывы');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hydrateForm, listingId, listingType, targetUserId, user?._id]);

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: 'Отзывы' });
    load();
  }, [load, navigation]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const submit = async () => {
    if (!targetUserId) {
      Alert.alert('Отзывы', 'У объявления нет автора для отзыва.');
      return;
    }

    if (isMyListing) {
      Alert.alert('Отзывы', 'Нельзя оставить отзыв самому себе.');
      return;
    }

    if (!comment.trim() && !title.trim()) {
      Alert.alert('Отзывы', 'Добавьте короткий заголовок или текст отзыва.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        targetUserId,
        listingId: listingId || undefined,
        listingType,
        rating,
        title,
        comment,
        pros: splitList(pros),
        cons: splitList(cons),
      };

      if (myReview) {
        await updateReview(myReview._id, payload);
      } else {
        await addReview(payload);
      }

      await load(true);
      Alert.alert('Готово', myReview ? 'Отзыв обновлен' : 'Отзыв опубликован');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось сохранить отзыв');
    } finally {
      setSubmitting(false);
    }
  };

  const removeOwnReview = () => {
    if (!myReview) return;

    Alert.alert('Удалить отзыв?', 'Отзыв исчезнет из карточки продавца.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            await deleteReview(myReview._id);
            hydrateForm();
            await load(true);
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить отзыв');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const mark = async (review: ReviewItem, type: 'helpful' | 'unhelpful') => {
    try {
      if (type === 'helpful') {
        await markReviewHelpful(review._id);
      } else {
        await markReviewUnhelpful(review._id);
      }
      await load(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить оценку отзыва');
    }
  };

  const renderStars = (value: number, interactive = false) => (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          disabled={!interactive}
          onPress={() => setRating(star)}
          activeOpacity={0.75}
        >
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={interactive ? 31 : 17}
            color={star <= value ? '#f5a400' : '#ccc'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        {listingImage ? (
          <Image source={{ uri: listingImage }} style={styles.listingImage} />
        ) : (
          <View style={[styles.listingImage, styles.noImage]}>
            <Ionicons name="car-sport-outline" size={24} color={colors.textFaint} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Отзывы по объявлению</Text>
          <Text style={styles.listingTitle} numberOfLines={2}>{listingTitle}</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.scoreBox}>
          <Text style={styles.score}>{Number(stats.avgRating || 0).toFixed(1)}</Text>
          {renderStars(Math.round(Number(stats.avgRating || 0)))}
          <Text style={styles.scoreMeta}>{stats.totalReviews} отзывов</Text>
        </View>
        <View style={styles.breakdown}>
          {[5, 4, 3, 2, 1].map((item) => {
            const count = stats.ratingBreakdown[String(item) as '1' | '2' | '3' | '4' | '5'] || 0;
            const width = (stats.totalReviews ? `${Math.max(8, (count / stats.totalReviews) * 100)}%` : '0%') as DimensionValue;
            return (
              <View key={item} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item}</Text>
                <View style={styles.breakdownTrack}>
                  <View style={[styles.breakdownFill, { width }]} />
                </View>
                <Text style={styles.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {!targetUserId ? (
        <View style={styles.notice}>
          <Ionicons name="alert-circle-outline" size={21} color="#9a5a00" />
          <Text style={styles.noticeText}>У объявления нет автора, отзывы недоступны.</Text>
        </View>
      ) : isMyListing ? (
        <View style={styles.notice}>
          <Ionicons name="person-circle-outline" size={21} color={colors.textMuted} />
          <Text style={styles.noticeText}>Это ваше объявление. Отзывы может оставить другой пользователь.</Text>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.formHeader}>
            <Text style={styles.sectionTitle}>{myReview ? 'Ваш отзыв' : 'Оставить отзыв'}</Text>
            {myReview ? (
              <TouchableOpacity onPress={removeOwnReview} disabled={submitting} style={styles.deleteReviewBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.deleteReviewText}>Удалить</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {renderStars(rating, true)}
          <TextInput
            style={styles.input}
            placeholder="Заголовок"
            placeholderTextColor={colors.textFaint}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Что понравилось или не понравилось?"
            placeholderTextColor={colors.textFaint}
            value={comment}
            onChangeText={setComment}
            multiline
            textAlignVertical="top"
          />
          <TextInput
            style={styles.input}
            placeholder="Плюсы через запятую"
            placeholderTextColor={colors.textFaint}
            value={pros}
            onChangeText={setPros}
          />
          <TextInput
            style={styles.input}
            placeholder="Минусы через запятую"
            placeholderTextColor={colors.textFaint}
            value={cons}
            onChangeText={setCons}
          />
          <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={submit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={colors.onAccent} />
                <Text style={styles.submitText}>{myReview ? 'Обновить отзыв' : 'Опубликовать'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Все отзывы</Text>
      </View>

      {reviews.length ? reviews.map((review) => (
        <View key={review._id} style={styles.reviewCard}>
          <View style={styles.reviewTop}>
            {review.reviewer?.profileImage ? (
              <Image source={{ uri: review.reviewer.profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{getUserName(review).slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.reviewAuthor}>
              <Text style={styles.authorName}>{getUserName(review)}</Text>
              <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
            </View>
            {renderStars(review.rating)}
          </View>
          {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
          {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
          {review.pros?.length ? (
            <Text style={styles.listText}><Text style={styles.listTextStrong}>Плюсы: </Text>{review.pros.join(', ')}</Text>
          ) : null}
          {review.cons?.length ? (
            <Text style={styles.listText}><Text style={styles.listTextStrong}>Минусы: </Text>{review.cons.join(', ')}</Text>
          ) : null}
          <View style={styles.reviewActions}>
            <TouchableOpacity style={styles.voteBtn} onPress={() => mark(review, 'helpful')}>
              <Ionicons name="thumbs-up-outline" size={16} color={colors.textMuted} />
              <Text style={styles.voteText}>{review.helpful?.length || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.voteBtn} onPress={() => mark(review, 'unhelpful')}>
              <Ionicons name="thumbs-down-outline" size={16} color={colors.textMuted} />
              <Text style={styles.voteText}>{review.unhelpful?.length || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )) : (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={38} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Отзывов пока нет</Text>
          <Text style={styles.emptyText}>Первый отзыв появится здесь после публикации.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 12, paddingBottom: 30, gap: 10 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 10 },
  listingImage: { width: 76, height: 76, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  kicker: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  listingTitle: { marginTop: 4, color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  summary: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12 },
  scoreBox: { width: 108, alignItems: 'center', justifyContent: 'center' },
  score: { color: colors.text, fontSize: 34, fontWeight: '900' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scoreMeta: { marginTop: 5, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  breakdown: { flex: 1, gap: 6, justifyContent: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  breakdownLabel: { width: 12, color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  breakdownTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 4, backgroundColor: '#f5a400' },
  breakdownCount: { width: 24, color: colors.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12 },
  noticeText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  form: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  deleteReviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)' },
  deleteReviewText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.bg, color: colors.text, fontSize: 14, paddingHorizontal: 12 },
  textArea: { minHeight: 92, paddingTop: 11, lineHeight: 20 },
  submitBtn: { height: 48, borderRadius: 10, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: colors.onAccent, fontSize: 15, fontWeight: '900' },
  listHeader: { marginTop: 4, paddingHorizontal: 2 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  reviewAuthor: { flex: 1 },
  authorName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  reviewDate: { marginTop: 2, color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  reviewTitle: { marginTop: 10, color: colors.text, fontSize: 15, fontWeight: '900' },
  reviewComment: { marginTop: 5, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  listText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  listTextStrong: { color: colors.text, fontWeight: '900' },
  reviewActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  voteBtn: { height: 34, borderRadius: 8, paddingHorizontal: 10, backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: 5 },
  voteText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 34 },
  emptyTitle: { marginTop: 8, color: colors.text, fontSize: 16, fontWeight: '900' },
  emptyText: { marginTop: 4, color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
