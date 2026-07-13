import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  getSellerNickname,
  recordMarketLead,
  recordMarketView,
} from '../api/market';
import {
  addFavorite,
  checkFavorite,
  getFavoriteListingType,
  getListingObjectId,
  removeFavorite,
} from '../api/favorites';
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

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'MarketListingDetails'>;
  route: RouteProp<AppStackParamList, 'MarketListingDetails'>;
};

const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

export default function MarketListingDetailsScreen({ navigation, route }: Props) {
  const { listing, categoryId } = route.params;
  const [imageIndex, setImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const category = getMarketCategory(categoryId);
  const listingObjectId = getListingObjectId(listing);
  const favoriteType = getFavoriteListingType(categoryId);
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
    if (listing.id) recordMarketView(categoryId, listing.id);
  }, [categoryId, listing.id]);

  useEffect(() => {
    if (!listingObjectId) return;

    let mounted = true;
    checkFavorite(listingObjectId, favoriteType)
      .then((value) => {
        if (mounted) setIsFavorite(value);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [favoriteType, listingObjectId]);

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

  const toggleSaved = async () => {
    if (!listingObjectId) {
      Alert.alert('Избранное', 'У этого объявления нет идентификатора для сохранения.');
      return;
    }

    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await removeFavorite(listingObjectId, favoriteType);
        setIsFavorite(false);
      } else {
        await addFavorite(listing, categoryId);
        setIsFavorite(true);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить избранное');
    } finally {
      setFavoriteLoading(false);
    }
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {images[imageIndex] ? (
          <Image source={{ uri: images[imageIndex] }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.noImage]}>
            <Ionicons name={category.icon as any} size={42} color="#aaa" />
          </View>
        )}

        {images.length > 1 ? (
          <>
            <TouchableOpacity style={[styles.imageNav, styles.imageNavLeft]} onPress={previousImage}>
              <Ionicons name="chevron-back" size={24} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.imageNav, styles.imageNavRight]} onPress={nextImage}>
              <Ionicons name="chevron-forward" size={24} color="#111" />
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
            <Ionicons name={category.icon as any} size={17} color="#555" />
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
                <ActivityIndicator size="small" color={isCompared ? '#fff' : '#111'} />
              ) : (
                <Ionicons name="git-compare-outline" size={20} color={isCompared ? '#fff' : '#111'} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isFavorite && styles.saveBtnActive]}
              onPress={toggleSaved}
              disabled={favoriteLoading}
              activeOpacity={0.85}
            >
              {favoriteLoading ? (
                <ActivityIndicator size="small" color={isFavorite ? '#fff' : '#111'} />
              ) : (
                <Ionicons name={isFavorite ? 'bookmark' : 'bookmark-outline'} size={20} color={isFavorite ? '#fff' : '#111'} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.title}>{getListingTitle(listing)}</Text>
        <Text style={styles.price}>{getListingPrice(listing, categoryId)}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color="#777" />
          <Text style={styles.locationText}>{listing.location || listing.region || 'Локация не указана'}</Text>
        </View>

        <TouchableOpacity style={styles.reviewsBtn} onPress={openReviews} activeOpacity={0.85}>
          <View style={styles.reviewsLeft}>
            <Ionicons name="star" size={17} color="#f5a400" />
            <Text style={styles.reviewsText}>
              {reviewCount > 0 ? `${reviewRating ? reviewRating.toFixed(1) : '0.0'} · ${reviewCount} отзывов` : 'Отзывы'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#777" />
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
              <Ionicons name="person-outline" size={20} color="#777" />
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
          <Ionicons name="person-circle-outline" size={19} color="#fff" />
          <Text style={styles.contactText}>Профиль</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  content: { paddingBottom: 28 },
  hero: { position: 'relative', backgroundColor: '#e9e9e9' },
  heroImage: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  imageNav: {
    position: 'absolute', top: '48%', width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  imageNavLeft: { left: 12 },
  imageNavRight: { right: 12 },
  imageCounter: {
    position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)',
  },
  imageCounterText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  panel: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  panelTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  categoryLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryText: { color: '#555', fontSize: 13, fontWeight: '700' },
  panelActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  saveBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  title: { marginTop: 10, color: '#111', fontSize: 24, fontWeight: '900', lineHeight: 29 },
  price: { marginTop: 10, color: '#111', fontSize: 24, fontWeight: '900' },
  locationRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText: { flex: 1, color: '#666', fontSize: 14 },
  reviewsBtn: { marginTop: 12, minHeight: 44, borderRadius: 8, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  reviewsLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reviewsText: { color: '#111', fontSize: 14, fontWeight: '900' },
  sellerBadge: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: '#111', color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  section: { marginTop: 10, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  sectionTitle: { color: '#111', fontSize: 17, fontWeight: '900', marginBottom: 12 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specItem: { width: '48%', minHeight: 64, borderRadius: 8, backgroundColor: '#f4f4f4', padding: 10 },
  specLabel: { color: '#777', fontSize: 11, fontWeight: '700', marginBottom: 5 },
  specValue: { color: '#111', fontSize: 14, fontWeight: '800' },
  description: { color: '#333', fontSize: 14, lineHeight: 21 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f2f2f2', color: '#444', fontSize: 12, fontWeight: '700' },
  sellerBox: {
    marginTop: 10, marginHorizontal: 12, borderRadius: 8, backgroundColor: '#fff',
    padding: 12, borderWidth: 1, borderColor: '#eee',
  },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  sellerTextWrap: { flex: 1 },
  sellerTitle: { color: '#777', fontSize: 12, fontWeight: '700' },
  sellerName: { color: '#111', fontSize: 16, fontWeight: '900', marginTop: 2 },
  contactBtn: {
    height: 46, borderRadius: 8, backgroundColor: '#111',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7,
  },
  contactText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
