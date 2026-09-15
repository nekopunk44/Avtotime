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
import { colors, radius } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'MarketListingDetails'>;
  route: RouteProp<AppStackParamList, 'MarketListingDetails'>;
};

const SCREEN = Dimensions.get('window');

const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

export default function MarketListingDetailsScreen({ navigation, route }: Props) {
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

  return (
    <Animated.View style={[styles.container, growStyle]}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {images[imageIndex] ? (
          <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerOpen(true)}>
            <Image source={{ uri: images[imageIndex] }} style={styles.heroImage} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.heroImage, styles.noImage]}>
            <Ionicons name={category.icon as any} size={42} color={colors.textFaint} />
          </View>
        )}

        {images.length > 1 ? (
          <>
            <TouchableOpacity style={[styles.imageNav, styles.imageNavLeft]} onPress={previousImage} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.imageNav, styles.imageNavRight]} onPress={nextImage} hitSlop={8}>
              <Ionicons name="chevron-forward" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>{imageIndex + 1}/{images.length}</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelTopRow}>
          <View style={styles.categoryLine}>
            <Ionicons name={category.icon as any} size={17} color={colors.textMuted} />
            <Text style={styles.categoryText}>{category.label}</Text>
          </View>
          <View style={styles.panelActions}>
            <TouchableOpacity
              style={[styles.saveBtn, isCompared && styles.saveBtnActive]}
              onPress={toggleCompare}
              disabled={compareLoading}
              activeOpacity={0.85}
            >
              {compareLoading ? (
                <ActivityIndicator size="small" color={isCompared ? colors.onAccent : colors.text} />
              ) : (
                <Ionicons name="git-compare-outline" size={20} color={isCompared ? colors.onAccent : colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.title}>{getListingTitle(listing)}</Text>
        <Text style={styles.price}>{getListingPrice(listing, categoryId)}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={styles.locationText}>{listing.location || listing.region || 'Локация не указана'}</Text>
        </View>

        <TouchableOpacity style={styles.reviewsBtn} onPress={openReviews} activeOpacity={0.85}>
          <View style={styles.reviewsLeft}>
            <Ionicons name="star" size={17} color={colors.star} />
            <Text style={styles.reviewsText}>
              {reviewCount > 0 ? `${reviewRating ? reviewRating.toFixed(1) : '0.0'} · ${reviewCount} отзывов` : 'Отзывы'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {listing.sellerBadge ? (
          <Text style={styles.sellerBadge}>{listing.sellerBadge}</Text>
        ) : null}
      </View>

      {specs.length ? (
        <View style={styles.section}>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Описание</Text>
          <Text style={styles.description}>{listing.description}</Text>
        </View>
      ) : null}

      {listing.specialties?.length || listing.tags?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Направления</Text>
          <View style={styles.tagRow}>
            {[...(listing.specialties || []), ...(listing.tags || [])].map((tag) => (
              <Text key={tag} style={styles.tag}>{tag}</Text>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.sellerBox}>
        <View style={styles.sellerInfo}>
          {listing.sellerAvatar || listing.avatar ? (
            <Image source={{ uri: listing.sellerAvatar || listing.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.sellerTextWrap}>
            <Text style={styles.sellerTitle}>Продавец</Text>
            <Text style={styles.sellerName} numberOfLines={1}>
              {listing.seller || listing.name || (getSellerNickname(listing) ? `@${getSellerNickname(listing)}` : 'Профиль Avtotime')}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.contactBtn} onPress={openSeller}>
          <Ionicons name="person-circle-outline" size={19} color={colors.onAccent} />
          <Text style={styles.contactText}>Профиль</Text>
        </TouchableOpacity>
      </View>

      <ImageViewer uri={images[imageIndex]} visible={viewerOpen} onClose={() => setViewerOpen(false)} />
    </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 28 },
  hero: { position: 'relative', backgroundColor: colors.surfaceAlt },
  heroImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  imageNav: {
    position: 'absolute', top: '48%', width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  imageNavLeft: { left: 12 },
  imageNavRight: { right: 12 },
  imageCounter: {
    position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)',
  },
  imageCounterText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  panel: { backgroundColor: colors.surface, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  panelTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  categoryLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  panelActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  saveBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  title: { marginTop: 10, color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 29 },
  price: { marginTop: 10, color: colors.text, fontSize: 24, fontWeight: '900' },
  locationRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText: { flex: 1, color: colors.textMuted, fontSize: 14 },
  reviewsBtn: { marginTop: 12, minHeight: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  reviewsLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reviewsText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  sellerBadge: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.surfaceHi, color: colors.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  section: { marginTop: 10, backgroundColor: colors.surface, padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 12 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specItem: { width: '48%', minHeight: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, padding: 10 },
  specLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 5 },
  specValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  sellerBox: {
    marginTop: 10, marginHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.surface,
    padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  sellerTextWrap: { flex: 1 },
  sellerTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  sellerName: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 },
  contactBtn: {
    height: 46, borderRadius: radius.sm, backgroundColor: colors.accent,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7,
  },
  contactText: { color: colors.onAccent, fontSize: 15, fontWeight: '900' },
});
