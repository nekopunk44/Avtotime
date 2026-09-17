import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getAuthorId,
  getListingImage,
  getListingPrice,
  getListingTitle,
  getMarketCategory,
  getMarketListingById,
  getSellerNickname,
  recordMarketLead,
  recordMarketView,
} from '../api/market';
import { getCompareType } from '../api/compare';
import { useCompare } from '../hooks/useCompare';
import { searchUsers } from '../api/users';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import ImageViewer from '../components/ImageViewer';
import { colors, font, radius, shadow, space } from '../theme';
import { Avatar, PressableScale } from '../components/ui';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'MarketListingDetails'>;
  route: RouteProp<AppStackParamList, 'MarketListingDetails'>;
};

const SCREEN = Dimensions.get('window');

const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

export default function MarketListingDetailsScreen({ navigation, route }: Props) {
  const { listing: initialListing, categoryId } = route.params;
  const me = useAuthStore((state) => state.user);
  const [listing, setListing] = useState(initialListing);
  const [imageIndex, setImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  // Список сравнения общий с витриной: правила и сообщения живут в хуке.
  const { isCompared: checkCompared, toggle: switchCompare, busyId } = useCompare();
  const category = getMarketCategory(categoryId);
  const compareType = getCompareType(categoryId);
  const reviewCount = Number(listing.reviews ?? listing.reviewsCount ?? 0);
  const reviewRating = Number(listing.rating || listing.serviceQuality || 0);
  const isCompared = checkCompared(listing.id, compareType);
  const compareLoading = busyId === listing.id;
  const images = useMemo(() => {
    const all = listing.images?.length ? listing.images : [getListingImage(listing)];
    return all.filter(Boolean);
  }, [listing]);

  // Сравнение живёт в шапке: в содержимом ему места нет, а действие нужно с
  // любого места экрана.
  useEffect(() => {
    navigation.setOptions({
      title: category.label,
      headerRight: () => (
        <PressableScale style={styles.headerCompare} scaleTo={0.92} onPress={toggleCompareRef.current}>
          {compareLoading
            ? <ActivityIndicator size="small" color={colors.text} />
            : (
              // Состояние показывает сам значок: залитый — объявление уже в
              // сравнении.
              <Ionicons
                name={isCompared ? 'git-compare' : 'git-compare-outline'}
                size={22}
                color={isCompared ? colors.accent : colors.text}
              />
            )}
        </PressableScale>
      ),
    });
  }, [category.label, navigation, isCompared, compareLoading]);

  useEffect(() => {
    // Screens like search pass trimmed listing objects; silently
    // refetch the full document and merge it in. Keep the passed data meanwhile.
    const id = initialListing._id || initialListing.id;
    if (id == null || id === '') return;

    let mounted = true;
    getMarketListingById(categoryId, id)
      .then((full) => {
        if (mounted && full) setListing((prev) => ({ ...prev, ...full }));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [categoryId, initialListing]);

  useEffect(() => {
    if (listing.id) recordMarketView(categoryId, listing.id);
  }, [categoryId, listing.id]);

  const specs = [
    { label: 'Марка', value: listing.brand },
    { label: 'Модель', value: listing.model },
    { label: 'Год', value: listing.year },
    { label: 'Пробег', value: listing.mileage },
    { label: 'Топливо', value: listing.fuel },
    { label: 'КПП', value: listing.transmission },
    { label: 'Кузов', value: listing.bodyType },
    { label: 'Привод', value: listing.driveType },
    { label: 'Двигатель', value: listing.engineVolume },
    { label: 'Места', value: listing.seats },
    { label: 'Регистрация', value: listing.registrationPlace },
    { label: 'Категория', value: listing.category || listing.partCategory || listing.partGroup },
    { label: 'Рейтинг', value: listing.rating || listing.serviceQuality ? `${listing.rating || listing.serviceQuality}/5` : '' },
    { label: 'Отзывы', value: listing.reviews ?? listing.reviewsCount },
    { label: 'Опыт', value: listing.experience ? `${listing.experience} лет` : '' },
    { label: 'Консультации', value: listing.consultations },
  ].filter((item) => item.value != null && item.value !== '');

  /**
   * Кто продавец: сперва идентификатор из объявления, иначе ищем по нику.
   * Одна функция на профиль и на переписку — разъехавшись, они однажды повели
   * бы в разные места.
   */
  const resolveSeller = async (): Promise<{ id: string; name: string; userName: string } | null> => {
    if (listing.id) recordMarketLead(categoryId, listing.id);

    const nickname = getSellerNickname(listing);
    const displayName = listing.seller || listing.name || (nickname ? `@${nickname}` : 'Продавец');

    const authorId = getAuthorId(listing);
    if (authorId && isObjectId(authorId)) {
      return { id: authorId, name: displayName, userName: nickname || '' };
    }

    if (!nickname) {
      Alert.alert('Продавец', 'Профиль продавца не указан в объявлении');
      return null;
    }

    try {
      const users = await searchUsers(nickname);
      const exact = users.find((user) => user.userName?.toLowerCase() === nickname.toLowerCase()) || users[0];
      if (exact?._id) {
        return { id: exact._id, name: exact.name || displayName, userName: exact.userName || nickname };
      }
      Alert.alert('Продавец', `Не удалось найти профиль @${nickname}`);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось открыть профиль продавца');
    }
    return null;
  };

  const openSeller = async () => {
    const seller = await resolveSeller();
    if (seller) navigation.navigate('UserProfile', { userId: seller.id });
  };

  const writeSeller = async () => {
    const seller = await resolveSeller();
    if (!seller) return;
    navigation.navigate('Chat', { userId: seller.id, name: seller.name, userName: seller.userName });
  };

  const toggleCompare = () => switchCompare(listing.id, compareType);

  // Ссылка на актуальный обработчик: шапка перерисовывается редко, а функция
  // пересоздаётся на каждый рендер.
  const toggleCompareRef = useRef(toggleCompare);
  toggleCompareRef.current = toggleCompare;

  const openReviews = () => {
    navigation.navigate('MarketReviews', { listing, categoryId });
  };

  /**
   * Раскрытие из карточки: экран начинает жизнь в её прямоугольнике и
   * разворачивается на весь экран. Прямоугольник приходит из списка — сам
   * экран знать о нём неоткуда.
   *
   * Масштаб и сдвиг, а не ширина с высотой: их считает нативный драйвер, и
   * раскрытие не спотыкается о работу JS-потока.
   */
  const origin = route.params?.origin;
  const grow = useRef(new Animated.Value(origin ? 0 : 1)).current;

  useEffect(() => {
    if (!origin) return;
    Animated.timing(grow, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [grow, origin]);

  const growStyle = origin
    ? {
      opacity: grow.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.35, 1, 1] }),
      transform: [
        {
          translateX: grow.interpolate({
            inputRange: [0, 1],
            outputRange: [origin.x + origin.width / 2 - SCREEN.width / 2, 0],
          }),
        },
        {
          translateY: grow.interpolate({
            inputRange: [0, 1],
            outputRange: [origin.y + origin.height / 2 - SCREEN.height / 2, 0],
          }),
        },
        { scaleX: grow.interpolate({ inputRange: [0, 1], outputRange: [origin.width / SCREEN.width, 1] }) },
        { scaleY: grow.interpolate({ inputRange: [0, 1], outputRange: [origin.height / SCREEN.height, 1] }) },
      ],
    }
    : null;


  // Своё объявление: писать самому себе некому, кнопку показывать незачем.
  const sellerId = getAuthorId(listing);
  const sellerNick = getSellerNickname(listing);
  const isMyListing = Boolean(
    (me?._id && sellerId && me._id === sellerId)
    || (me?.userName && sellerNick && me.userName.toLowerCase() === sellerNick.toLowerCase()),
  );

  const sellerName = listing.seller || listing.name
    || (getSellerNickname(listing) ? `@${getSellerNickname(listing)}` : 'Профиль Avtotime');

  return (
    <Animated.View style={[styles.container, growStyle]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {images.length ? (
            /* Свайп вместо стрелок: листать кадры пальцем привычнее, чем
               целиться в кнопку поверх фотографии. */
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN.width);
                setImageIndex(Math.max(0, Math.min(images.length - 1, page)));
              }}
            >
              {images.map((uri, index) => (
                <TouchableOpacity
                  key={`${uri}-${index}`}
                  activeOpacity={0.95}
                  onPress={() => setViewerOpen(true)}
                >
                  <Image source={{ uri }} style={styles.heroImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.heroImage, styles.noImage]}>
              <Ionicons name={category.icon as any} size={44} color={colors.textFaint} />
            </View>
          )}

          <View style={styles.heroCategory}>
            <Ionicons name={category.icon as any} size={14} color={colors.text} />
            <Text style={styles.heroCategoryText}>{category.label}</Text>
          </View>

          {images.length > 1 ? (
            <>
              <View style={styles.dots}>
                {images.map((uri, index) => (
                  <View
                    key={`dot-${uri}-${index}`}
                    style={[styles.dot, index === imageIndex && styles.dotActive]}
                  />
                ))}
              </View>
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>{imageIndex + 1}/{images.length}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{getListingTitle(listing)}</Text>
          <Text style={styles.price}>{getListingPrice(listing, categoryId)}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {listing.location || listing.region || 'Локация не указана'}
            </Text>
            {listing.sellerBadge ? <Text style={styles.badge}>{listing.sellerBadge}</Text> : null}
          </View>

          <PressableScale style={styles.reviewsRow} scaleTo={0.98} onPress={openReviews}>
            <Ionicons name="star" size={16} color={colors.star} />
            <Text style={styles.reviewsText}>
              {reviewCount > 0
                ? `${reviewRating ? reviewRating.toFixed(1) : '0.0'} · ${reviewCount} отзывов`
                : 'Отзывов пока нет'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </PressableScale>
        </View>

        {specs.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Характеристики</Text>
            <View style={styles.specGrid}>
              {specs.map((item) => (
                <View key={item.label} style={styles.specItem}>
                  <Text style={styles.specLabel}>{item.label}</Text>
                  <Text style={styles.specValue} numberOfLines={2}>{String(item.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {listing.description ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Описание</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>
        ) : null}

        {listing.specialties?.length || listing.tags?.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Направления</Text>
            <View style={styles.tagRow}>
              {[...(listing.specialties || []), ...(listing.tags || [])].map((tag) => (
                <Text key={tag} style={styles.tag}>{tag}</Text>
              ))}
            </View>
          </View>
        ) : null}

        <PressableScale style={styles.sellerCard} scaleTo={0.99} onPress={openSeller}>
          <Avatar
            uri={listing.sellerAvatar || listing.avatar}
            name={sellerName}
            userName={getSellerNickname(listing)}
            size={46}
          />
          <View style={styles.sellerBody}>
            <Text style={styles.sellerLabel}>Продавец</Text>
            <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
          </View>
          {/* Написать — отдельным действием: карточка целиком ведёт в профиль,
              а разговор начинают чаще, чем изучают профиль. */}
          {isMyListing ? (
            <Text style={styles.ownBadge}>Ваше</Text>
          ) : (
            <PressableScale style={styles.writeBtn} scaleTo={0.94} onPress={writeSeller}>
              <Ionicons name="chatbubble-ellipses" size={19} color={colors.onAccent} />
            </PressableScale>
          )}
        </PressableScale>

        <ImageViewer uri={images[imageIndex]} visible={viewerOpen} onClose={() => setViewerOpen(false)} />
      </ScrollView>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space.xxl },

  hero: { position: 'relative', backgroundColor: colors.surfaceAlt },
  // 4:3 вместо квадрата: под кадром остаётся место цене и заголовку.
  heroImage: { width: SCREEN.width, aspectRatio: 4 / 3, backgroundColor: colors.surfaceAlt },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  heroCategory: {
    position: 'absolute', left: space.md, top: space.md,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: space.md, height: 32, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.6)',
  },
  heroCategoryText: { color: colors.text, fontSize: font.tiny, fontWeight: '900' },
  headerCompare: {
    marginRight: space.md, width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  imageCounter: {
    position: 'absolute', right: space.md, bottom: space.md,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.65)',
  },
  imageCounterText: { color: colors.white, fontWeight: '800', fontSize: font.tiny },
  dots: {
    position: 'absolute', left: 0, right: 0, bottom: space.md,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: colors.white, width: 18 },

  // Карточки с полями вместо полос во всю ширину: экран перестаёт выглядеть
  // стопкой панелей.
  card: {
    marginTop: space.md, marginHorizontal: space.md, padding: space.lg,
    borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card,
  },
  title: { color: colors.text, fontSize: font.h2, lineHeight: 26, fontWeight: '900' },
  // Цена крупнее заголовка: за ней приходят в первую очередь.
  price: { marginTop: space.sm, color: colors.text, fontSize: font.display, fontWeight: '900' },
  metaRow: { marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { flexShrink: 1, color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  badge: {
    overflow: 'hidden', marginLeft: space.xs, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.surfaceHi,
    color: colors.text, fontSize: 10, fontWeight: '900', textTransform: 'uppercase',
  },
  reviewsRow: {
    marginTop: space.md, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: space.md,
  },
  reviewsText: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '800' },

  sectionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '900', marginBottom: space.md },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  specItem: {
    width: '48.5%', minHeight: 62, borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt, padding: space.md,
  },
  specLabel: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  specValue: { marginTop: 4, color: colors.text, fontSize: font.small, fontWeight: '900' },
  description: { color: colors.textMuted, fontSize: font.small, lineHeight: 21, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: {
    overflow: 'hidden', paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt, color: colors.textMuted, fontSize: font.tiny, fontWeight: '800',
  },

  sellerCard: {
    marginTop: space.md, marginHorizontal: space.md, padding: space.md,
    borderRadius: radius.lg, backgroundColor: colors.surface,
    flexDirection: 'row', alignItems: 'center', gap: space.md, ...shadow.card,
  },
  sellerBody: { flex: 1 },
  sellerLabel: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  sellerName: { marginTop: 2, color: colors.text, fontSize: font.body, fontWeight: '900' },
  writeBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  ownBadge: {
    overflow: 'hidden', paddingHorizontal: space.md, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    color: colors.textMuted, fontSize: font.tiny, fontWeight: '900',
  },

});
