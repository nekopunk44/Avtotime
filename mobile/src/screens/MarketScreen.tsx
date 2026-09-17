import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  filterMarketListings,
  getListingImage,
  getPlaceDistances,
  getListingPrice,
  getListingTitle,
  getMarketCategory,
  getMarketCategoryFromListingType,
  loadMarketListings,
  MARKET_CATEGORIES,
  MarketCategoryId,
  MarketListing,
  searchMarketListings,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors, font, radius, shadow, space } from '../theme';
import { Card, EmptyState, PressableScale, Skeleton } from '../components/ui';
import { canCompareListing, getCompareType } from '../api/compare';
import { useCompare } from '../hooks/useCompare';
import MarketFiltersSheet, {
  countActiveFilters,
  emptyMarketFilters,
  MarketFilters,
} from '../components/MarketFiltersSheet';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

export default function MarketScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<MarketFilters>(emptyMarketFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Раздел живёт в фильтрах: без выбора экран показывает весь маркет.
  const categoryId = filters.type;
  const activeCategory = useMemo(
    () => (categoryId ? MARKET_CATEGORIES.find((item) => item.id === categoryId) : undefined),
    [categoryId],
  );

  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const prevQueryRef = useRef(query);
  const PAGE_SIZE = 40;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const activeFilterCount = countActiveFilters(filters);
  const filtered = activeFilterCount > 0;

  const { isCompared, toggle: toggleCompare, busyId } = useCompare();

  const loadListings = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current;
    hasLoadedRef.current = true;
    if (!silent) setLoading(true);
    setError('');
    try {
      // near* — не условие выборки, а порядок показа. И пока он включён, город
      // не сужает выдачу: иначе соседние города не попали бы в неё вовсе.
      const { nearCity, nearLat, nearLng, type, ...serverFilters } = filters;
      const near = nearLat !== null && nearLng !== null;
      // Кроме раздела: он один умеет постраничную выдачу через свою ручку.
      const narrowed = countActiveFilters({ ...filters, type: '' }) > 0;
      const paged = Boolean(type) && !narrowed;

      const data = paged
        ? await loadMarketListings(type as MarketCategoryId, { q: query, page: 1, limit: PAGE_SIZE })
        : await (query.trim() ? searchMarketListings : filterMarketListings)({
          ...serverFilters,
          ...(near ? { region: '' } : {}),
          q: query,
          ...(type ? { type } : {}),
        });
      if (requestId !== requestIdRef.current) return;
      setListings(data);
      setPage(1);
      setHasMore(paged && data.length === PAGE_SIZE);
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;
      setError(e.response?.data?.message || 'Не удалось загрузить объявления');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [categoryId, query, filters]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || !hasMore || !categoryId) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const more = await loadMarketListings(categoryId, { q: query, page: next, limit: PAGE_SIZE });
      if (requestId !== requestIdRef.current) return;
      setListings((prev) => {
        const seen = new Set(prev.map((item) => String(item._id || item.id)));
        return [...prev, ...more.filter((item) => !seen.has(String(item._id || item.id)))];
      });
      setPage(next);
      setHasMore(more.length === PAGE_SIZE);
    } catch {
      // scrolling again retries
    } finally {
      setLoadingMore(false);
    }
  }, [categoryId, query, page, hasMore, loading, loadingMore, refreshing]);

  const loadListingsRef = useRef(loadListings);
  loadListingsRef.current = loadListings;

  useEffect(() => {
    // Silent when the reload is caused by typing, so the list (and the
    // TextInput in its header) stays mounted and the keyboard stays open.
    const queryChanged = prevQueryRef.current !== query;
    prevQueryRef.current = query;
    const id = setTimeout(() => loadListings(queryChanged), queryChanged && query.trim() ? 350 : 0);
    return () => clearTimeout(id);
  }, [loadListings, query]);

  useFocusEffect(useCallback(() => {
    // Initial load is handled by the debounce effect; on re-focus refresh silently.
    if (hasLoadedRef.current) loadListingsRef.current(true);
  }, []));

  const refresh = () => {
    setRefreshing(true);
    loadListings(true);
  };

  const placeOf = (item: MarketListing) => String(item.location || item.region || '').trim();

  // Расстояния до городов из выдачи: считает сервер (у него справочник
  // координат), клиент только раскладывает по ним объявления.
  const [distances, setDistances] = useState<Record<string, number | null>>({});
  const nearActive = filters.nearLat !== null && filters.nearLng !== null;

  useEffect(() => {
    if (!nearActive) {
      setDistances({});
      return;
    }
    const places = Array.from(new Set(listings.map(placeOf).filter(Boolean))).slice(0, 60);
    if (!places.length) return;
    let alive = true;
    getPlaceDistances(filters.nearLat as number, filters.nearLng as number, places)
      .then((next) => { if (alive) setDistances((prev) => ({ ...prev, ...next })); })
      .catch(() => {});
    return () => { alive = false; };
  }, [listings, nearActive, filters.nearLat, filters.nearLng]);

  const distanceOf = useCallback(
    (item: MarketListing) => {
      const place = placeOf(item).toLowerCase();
      const km = place ? distances[place] : null;
      return typeof km === 'number' ? km : null;
    },
    [distances],
  );

  /**
   * Порядок по расстоянию от пользователя. Место, которого геокодер ещё не
   * знает, уходит в конец, а не притворяется нулём.
   */
  const ordered = useMemo(() => {
    if (!nearActive) return listings;
    return [...listings].sort((a, b) => {
      const da = distanceOf(a);
      const db = distanceOf(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [listings, nearActive, distanceOf]);

  const renderListing = ({ item }: { item: MarketListing }) => {
    const image = getListingImage(item);
    const km = distanceOf(item);
    // Ref на карточку: перед переходом меряем её место на экране, чтобы
    // экран объявления вырос именно отсюда.
    const cellRef = React.createRef<View>();
    // В общей выдаче раздел у каждого объявления свой — берём его из самого
    // объявления, а не из состояния экрана.
    const itemCategoryId = item.listingType
      ? getMarketCategoryFromListingType(item.listingType)
      : (categoryId || 'cars');
    const itemCategory = getMarketCategory(itemCategoryId);
    const compareType = getCompareType(itemCategoryId);
    const compared = isCompared(item.id, compareType);
    return (
      <View ref={cellRef} collapsable={false} style={styles.cell}>
      <PressableScale
        style={styles.cellInner}
        scaleTo={0.98}
        onPress={() => {
          const open = (origin?: { x: number; y: number; width: number; height: number }) =>
            navigation.navigate('MarketListingDetails', { listing: item, categoryId: itemCategoryId, origin });

          const node = cellRef.current;
          if (!node) {
            open();
            return;
          }
          // measureInWindow — единственный способ узнать место карточки уже
          // после прокрутки списка.
          node.measureInWindow((x, y, width, height) => open({ x, y, width, height }));
        }}
      >
        <Card style={styles.card}>
          {image ? (
            <Image source={{ uri: image }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.noImage]}>
              <Ionicons name={itemCategory.icon as any} size={28} color={colors.textFaint} />
            </View>
          )}
          {/* Сравнение прямо из выдачи: раньше пару приходилось собирать,
              заходя в каждое объявление. */}
          {canCompareListing(item) ? (
            <PressableScale
              style={[styles.compareBtn, compared && styles.compareBtnOn]}
              scaleTo={0.9}
              onPress={() => toggleCompare(item.id, compareType)}
            >
              {busyId === item.id ? (
                <ActivityIndicator size="small" color={compared ? colors.onAccent : colors.text} />
              ) : (
                <Ionicons
                  name={compared ? 'git-compare' : 'git-compare-outline'}
                  size={17}
                  color={compared ? colors.onAccent : colors.text}
                />
              )}
            </PressableScale>
          ) : null}
          {item.sellerBadge ? <Text style={styles.badge}>{item.sellerBadge}</Text> : null}
          <View style={styles.cardBody}>
            <Text style={styles.price}>{getListingPrice(item, itemCategoryId)}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>{getListingTitle(item)}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={colors.textFaint} />
              <Text style={styles.metaText} numberOfLines={1}>{item.location || item.region || 'Не указано'}</Text>
            </View>
            {km !== null ? (
              <Text style={styles.distanceText}>{km === 0 ? 'Рядом с вами' : `${km} км от вас`}</Text>
            ) : null}
          </View>
        </Card>
      </PressableScale>
      </View>
    );
  };

  const Header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Маркет</Text>
        <View style={styles.headerActions}>
          <PressableScale style={styles.iconBtn} onPress={() => navigation.navigate('MarketServices')}>
            <Ionicons name="apps-outline" size={21} color={colors.text} />
          </PressableScale>
          <PressableScale style={styles.addBtn} onPress={() => navigation.navigate('CreateMarketListing')}>
            <Ionicons name="add" size={24} color={colors.onAccent} />
          </PressableScale>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeCategory ? `Поиск: ${activeCategory.label.toLowerCase()}` : 'Поиск по маркету'}
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => setFiltersOpen(true)} hitSlop={8}>
          <Ionicons name="options-outline" size={18} color={filtered ? colors.accent : colors.text} />
          {filtered ? (
            <View style={styles.filterDot}>
              <Text style={styles.filterDotText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Заголовок появляется, только когда выбран раздел: «Все разделы» над
          всеми объявлениями ничего не сообщали. */}
      {activeCategory || filtered ? (
        <View style={styles.scopeRow}>
          <Text style={styles.scopeText}>{activeCategory ? activeCategory.label : ''}</Text>
          {filtered ? (
            <PressableScale style={styles.scopeReset} onPress={() => setFilters(emptyMarketFilters)}>
              <Ionicons name="close" size={13} color={colors.textMuted} />
              <Text style={styles.scopeResetText}>Сбросить</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const filtersSheet = (
    <MarketFiltersSheet
      visible={filtersOpen}
      value={filters}
      onApply={(next) => { setFilters(next); setFiltersOpen(false); }}
      onClose={() => setFiltersOpen(false)}
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.cell}>
              <Skeleton style={styles.skeletonCard} />
            </View>
          ))}
        </View>
        {filtersSheet}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.container}
        data={ordered}
        numColumns={2}
        keyExtractor={(item, index) => `${item.listingType || categoryId || 'all'}-${item._id || item.id || index}`}
        renderItem={renderListing}
        ListHeaderComponent={Header}
        columnWrapperStyle={styles.grid}
        contentContainerStyle={ordered.length ? styles.listContent : styles.emptyContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={colors.text} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <EmptyState
            icon={error ? 'alert-circle-outline' : ((activeCategory?.icon || 'storefront-outline') as any)}
            title={error || (filtered ? 'Ничего не найдено' : 'Объявлений пока нет')}
            subtitle={
              error ? 'Потяните вниз, чтобы повторить.'
                : filtered ? 'Смягчите фильтры или сбросьте их.'
                  : 'Здесь появятся предложения маркета.'
            }
            actionLabel={error ? undefined : filtered ? 'Сбросить фильтры' : 'Разместить объявление'}
            onAction={
              error ? undefined
                : filtered ? () => setFilters(emptyMarketFilters)
                  : () => navigation.navigate('CreateMarketListing')
            }
          />
        }
      />
      {filtersSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  footerSpinner: { paddingVertical: 16 },
  header: { paddingHorizontal: space.md, paddingTop: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: font.display, fontWeight: '900', color: colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.card },

  searchBox: {
    height: 46, marginTop: space.md, borderRadius: radius.md, backgroundColor: colors.surface,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, ...shadow.card,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: font.body },
  filterDot: {
    position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  filterDotText: { color: colors.onAccent, fontSize: 10, fontWeight: '900' },

  compareBtn: {
    position: 'absolute', top: space.sm, right: space.sm, zIndex: 2,
    width: 34, height: 34, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,11,14,0.55)',
  },
  compareBtnOn: { backgroundColor: colors.accent },
  scopeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md, marginBottom: 2 },
  scopeText: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  scopeReset: {
    flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: space.md,
    borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
  },
  scopeResetText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '900' },

  grid: { paddingHorizontal: space.md - 3, justifyContent: 'space-between' },
  listContent: { paddingBottom: space.lg },
  emptyContent: { flexGrow: 1 },
  cell: { width: '50%', paddingHorizontal: 3, marginBottom: space.md },
  cellInner: { flex: 1 },
  card: { padding: 0, overflow: 'hidden' },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.ink, color: colors.white, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', overflow: 'hidden' },
  cardBody: { padding: space.md },
  price: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  cardTitle: { marginTop: 4, color: colors.textMuted, fontSize: font.small, fontWeight: '600', lineHeight: 18, minHeight: 36 },
  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { flex: 1, color: colors.textFaint, fontSize: font.tiny, fontWeight: '600' },
  distanceText: { marginTop: 3, color: colors.accent, fontSize: font.tiny, fontWeight: '900' },

  skeletonCard: { width: '100%', height: 240, borderRadius: radius.lg },
});
