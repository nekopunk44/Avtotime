import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import {
  FavoriteItem,
  FavoriteListingType,
  getCategoryIdFromFavoriteType,
  getFavorites,
  removeFavorite,
} from '../api/favorites';
import { getMarketCategory, MarketCategoryId, MarketListing } from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors, font, radius, space, shadow } from '../theme';
import { PressableScale, Skeleton } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

const FILTERS: Array<{ label: string; type?: FavoriteListingType }> = [
  { label: 'Все' },
  { label: 'Авто', type: 'car' },
  { label: 'Запчасти', type: 'part' },
  { label: 'Сервисы', type: 'car-service' },
  { label: 'Тюнинг', type: 'auto-tuning' },
  { label: 'Эксперты', type: 'consultation' },
  { label: 'Чистка', type: 'dry-cleaning' },
];

// Визуальная карточка: фото ведёт, цена живёт на снимке, текст поддерживает.
// Каскадный вход по ~40 мс на карточку — как в ленте.
function FavoriteCard({
  item,
  index,
  removing,
  onOpen,
  onRemove,
}: {
  item: FavoriteItem;
  index: number;
  removing: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: Math.min(index, 8) * 40, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: Math.min(index, 8) * 40, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, index]);

  const category = getMarketCategory(getCategoryIdFromFavoriteType(item.listingType));

  return (
    <Animated.View style={[styles.cardWrap, { opacity, transform: [{ translateY }] }]}>
      <PressableScale style={styles.card} onPress={onOpen} scaleTo={0.97}>
        <View style={styles.imageWrap}>
          {item.listingImage ? (
            <Image source={{ uri: item.listingImage }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.noImage]}>
              <Ionicons name={category.icon as never} size={30} color={colors.textFaint} />
            </View>
          )}

          {/* Тёмная плашка снизу: цена читается на любом фото. */}
          <View style={styles.priceScrim}>
            <Text style={styles.price} numberOfLines={1}>
              {item.listingPrice || 'Цена по запросу'}
            </Text>
          </View>

          <View style={styles.categoryBadge}>
            <Ionicons name={category.icon as never} size={11} color={colors.text} />
            <Text style={styles.categoryBadgeText}>{category.shortLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.removeBtn}
            onPress={onRemove}
            disabled={removing}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            {removing ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="bookmark" size={16} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item.listingTitle || 'Объявление'}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

export default function FavoritesScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<FavoriteListingType | undefined>();
  const requestIdRef = React.useRef(0);
  const hasDataRef = React.useRef(false);
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [error, setError] = useState('');

  const activeCategory = useMemo(
    () => (filter ? getMarketCategory(getCategoryIdFromFavoriteType(filter)) : null),
    [filter],
  );

  const load = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current;
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getFavorites(filter);
      if (requestId !== requestIdRef.current) return;
      hasDataRef.current = true;
      setItems(data);
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;
      setError(e.response?.data?.message || 'Не удалось загрузить избранное');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    load(hasDataRef.current);
  }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openItem = (item: FavoriteItem) => {
    const categoryId: MarketCategoryId = getCategoryIdFromFavoriteType(item.listingType);
    const listing: MarketListing = {
      _id: item.listingId,
      title: item.listingTitle || 'Объявление',
      image: item.listingImage || '',
      price: item.listingPrice || '',
    };

    navigation.navigate('MarketListingDetails', { listing, categoryId });
  };

  const deleteItem = (item: FavoriteItem) => {
    Alert.alert('Удалить из избранного?', item.listingTitle || 'Объявление', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => performDelete(item) },
    ]);
  };

  const performDelete = async (item: FavoriteItem) => {
    setRemovingId(item._id);
    try {
      await removeFavorite(item.listingId, item.listingType);
      setItems((prev) => prev.filter((favorite) => favorite._id !== item._id));
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить из избранного');
    } finally {
      setRemovingId('');
    }
  };

  const renderFilter = ({ item }: { item: typeof FILTERS[number] }) => {
    const active = item.type === filter;
    return (
      <TouchableOpacity
        style={[styles.filterBtn, active && styles.filterBtnActive]}
        onPress={() => setFilter(item.type)}
        activeOpacity={0.85}
      >
        <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  const listHeader = items.length ? (
    <View style={styles.countRow}>
      <Text style={styles.countNumber}>{items.length}</Text>
      <Text style={styles.countLabel}>
        {activeCategory ? `в разделе «${activeCategory.shortLabel}»` : 'в избранном'}
      </Text>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FlatList
          data={FILTERS}
          horizontal
          keyExtractor={(item) => item.type || 'all'}
          renderItem={renderFilter}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        />
      </View>

      {loading ? (
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton style={styles.skeletonImage} />
              <Skeleton style={{ width: '80%', height: 12, marginTop: 8 }} />
              <Skeleton style={{ width: '50%', height: 12, marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          key="grid"
          numColumns={2}
          keyExtractor={(item) => item._id}
          columnWrapperStyle={items.length ? styles.gridRow : undefined}
          renderItem={({ item, index }) => (
            <FavoriteCard
              item={item}
              index={index}
              removing={removingId === item._id}
              onOpen={() => openItem(item)}
              onRemove={() => deleteItem(item)}
            />
          )}
          ListHeaderComponent={listHeader}
          contentContainerStyle={items.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bookmark-outline" size={30} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>{error || 'Пока ничего не сохранено'}</Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Потяните экран вниз, чтобы повторить загрузку.'
                  : activeCategory
                    ? `Сохранённые объявления раздела ${activeCategory.shortLabel.toLowerCase()} появятся здесь.`
                    : 'Нажимайте на закладку в объявлениях, чтобы собрать быстрый список.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.lg },
  filters: { gap: space.sm, paddingTop: space.md, paddingBottom: space.xs },
  filterBtn: {
    height: 36,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg - 2,
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  filterBtnActive: { backgroundColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  filterTextActive: { color: colors.onAccent },

  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    paddingHorizontal: space.xs,
    paddingBottom: space.md,
  },
  countNumber: { color: colors.text, fontSize: font.display, fontWeight: '900' },
  countLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },

  list: { padding: space.md, paddingTop: space.lg },
  gridRow: { gap: space.md },
  cardWrap: { flex: 1, maxWidth: '50%', marginBottom: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingBottom: space.md,
    ...shadow.card,
  },
  imageWrap: { width: '100%', aspectRatio: 0.92, backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  priceScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.xl,
    paddingBottom: space.sm + 2,
    backgroundColor: 'rgba(8,8,10,0.55)',
  },
  price: { color: colors.white, fontSize: font.h3, fontWeight: '900' },
  categoryBadge: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.6)',
  },
  categoryBadgeText: { color: colors.text, fontSize: font.tiny, fontWeight: '800' },
  removeBtn: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '800',
    lineHeight: 18,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 2,
  },

  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    padding: space.md,
    paddingTop: space.lg,
  },
  skeletonCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.sm,
    paddingBottom: space.md,
  },
  skeletonImage: { width: '100%', aspectRatio: 0.95, borderRadius: radius.md },

  emptyList: { flexGrow: 1, justifyContent: 'center', padding: space.xxl },
  emptyState: { alignItems: 'center' },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: space.md, color: colors.text, fontSize: font.h3, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: space.xs + 2, color: colors.textMuted, fontSize: font.small, lineHeight: 19, textAlign: 'center' },
});
