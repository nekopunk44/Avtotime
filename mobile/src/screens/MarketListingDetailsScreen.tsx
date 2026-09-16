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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  canCompareListing,
  CompareItem,
  getCompareItems,
  getCompareType,
  saveCompareItems,
  toggleCompareItem,
} from '../api/compare';
import { searchUsers } from '../api/users';
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
  const insets = useSafeAreaInsets();
  const { listing: initialListing, categoryId } = route.params;
  const [listing, setListing] = useState(initialListing);
  const [imageIndex, setImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const category = getMarketCategory(categoryId);
  const compareType = getCompareType(categoryId);
  const reviewCount = Number(listing.reviews ?? listing.reviewsCount ?? 0);
  const reviewRating = Number(listing.rating || listing.serviceQuality || 0);
  const isCompared = typeof listing.id === 'number' && compareItems.some((item) => item.id === listing.id && item.type === compareType);
  const images = useMemo(() => {
    const all = listing.images?.length ? listing.images : [getListingImage(listing)];
    return all.filter(Boolean);
  }, [listing]);

  useEffect(() => {
    navigation.setOptions({ title: category.label });
  }, [category.label, navigation]);

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

  useEffect(() => {
    let mounted = true;
    getCompareItems()
      .then((items) => {
        if (mounted) setCompareItems(items);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

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

  const openSeller = async () => {
    if (listing.id) recordMarketLead(categoryId, listing.id);

    const authorId = getAuthorId(listing);
    if (authorId && isObjectId(authorId)) {
      navigation.navigate('UserProfile', { userId: authorId });
      return;
    }

    const nickname = getSellerNickname(listing);
    if (!nickname) {
      Alert.alert('Продавец', 'Профиль продавца не указан в объявлении');
      return;
    }

    try {
      const users = await searchUsers(nickname);
      const exact = users.find((user) => user.userName?.toLowerCase() === nickname.toLowerCase()) || users[0];
      if (exact?._id) {
        navigation.navigate('UserProfile', { userId: exact._id });
        return;
      }
      Alert.alert('Продавец', `Не удалось найти профиль @${nickname}`);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось открыть профиль продавца');
    }
  };

  const nextImage = () => {
    if (!images.length) return;
    setImageIndex((prev) => (prev + 1) % images.length);
  };

  const previousImage = () => {
    if (!images.length) return;
    setImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const toggleCompare = async () => {
    if (!canCompareListing(listing) || typeof listing.id !== 'number') {
      Alert.alert('Сравнение', 'Это объявление нельзя добавить в сравнение.');
      return;
    }

    const nextItem = { id: listing.id, type: compareType };
    const nextItems = toggleCompareItem(compareItems, nextItem);
    const alreadyCompared = compareItems.some((item) => item.id === nextItem.id && item.type === nextItem.type);

    if (!alreadyCompared && nextItems.length === compareItems.length && compareItems.length >= 2 && compareItems[0]?.type === nextItem.type) {
      Alert.alert('Сравнение', 'Можно сравнить максимум два объявления одного типа.');
      return;
    }

    setCompareLoading(true);
    try {
      const saved = await saveCompareItems(nextItems);
      setCompareItems(saved);
      if (!alreadyCompared && compareItems.length > 0 && compareItems[0]?.type !== nextItem.type) {
        Alert.alert('Сравнение', 'Список сравнения был заменён, потому что можно сравнивать только один тип объявлений за раз.');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить сравнение');
    } finally {
      setCompareLoading(false);
    }
  };

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


  const sellerName = listing.seller || listing.name
    || (getSellerNickname(listing) ? `@${getSellerNickname(listing)}` : 'Профиль Avtotime');

  return (
    <Animated.View style={[styles.container, growStyle]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {images[imageIndex] ? (
            <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerOpen(true)}>
              <Image source={{ uri: images[imageIndex] }} style={styles.heroImage} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.heroImage, styles.noImage]}>
              <Ionicons name={category.icon as any} size={44} color={colors.textFaint} />
            </View>
          )}

          {/* Затемнение снизу: под ним начинается карточка, и стык не режет кадр. */}
          <View style={styles.heroScrim} pointerEvents="none" />

          <View style={styles.heroCategory}>
            <Ionicons name={category.icon as any} size={14} color={colors.text} />
            <Text style={styles.heroCategoryText}>{category.label}</Text>
          </View>

          {images.length > 1 ? (
            <>
              <TouchableOpacity style={[styles.imageNav, styles.imageNavLeft]} onPress={previousImage} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.imageNav, styles.imageNavRight]} onPress={nextImage} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </TouchableOpacity>
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
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </PressableScale>

        <ImageViewer uri={images[imageIndex]} visible={viewerOpen} onClose={() => setViewerOpen(false)} />
      </ScrollView>

      {/* Главное действие закреплено внизу: до него не нужно долистывать
          характеристики и описание. */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space.sm }]}>
        <PressableScale
          style={[styles.compareBtn, isCompared && styles.compareBtnActive]}
          scaleTo={0.94}
          onPress={toggleCompare}
        >
          {compareLoading
            ? <ActivityIndicator size="small" color={isCompared ? colors.onAccent : colors.text} />
            : <Ionicons name="git-compare" size={20} color={isCompared ? colors.onAccent : colors.text} />}
        </PressableScale>

        <PressableScale style={styles.primaryBtn} scaleTo={0.98} onPress={openSeller}>
          <Ionicons name="person-circle-outline" size={19} color={colors.onAccent} />
          <Text style={styles.primaryText}>Профиль продавца</Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 110 },

  hero: { position: 'relative', backgroundColor: colors.surfaceAlt },
  // 4:3 вместо квадрата: под кадром остаётся место цене и заголовку.
  heroImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.surfaceAlt },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  heroScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 90,
    backgroundColor: 'rgba(8,8,10,0.35)',
  },
  heroCategory: {
    position: 'absolute', left: space.md, top: space.md,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: space.md, height: 32, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.6)',
  },
  heroCategoryText: { color: colors.text, fontSize: font.tiny, fontWeight: '900' },
  imageNav: {
    position: 'absolute', top: '46%', width: 38, height: 38, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  imageNavLeft: { left: space.md },
  imageNavRight: { right: space.md },
  imageCounter: {
    position: 'absolute', right: space.md, bottom: space.md,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.65)',
  },
  imageCounterText: { color: colors.white, fontWeight: '800', fontSize: font.tiny },

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

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingTop: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  compareBtn: {
    width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  compareBtnActive: { backgroundColor: colors.accent },
  primaryBtn: {
    flex: 1, height: 52, borderRadius: radius.pill, backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  primaryText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
});
