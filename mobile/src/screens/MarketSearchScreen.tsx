import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  filterMarketListings,
  getDistinctBrands,
  getDistinctModels,
  getListingImage,
  getListingPrice,
  getListingTitle,
  getMarketCategory,
  getMarketCategoryFromListingType,
  MARKET_CATEGORIES,
  MarketCategoryId,
  MarketListing,
  MarketSort,
  searchMarketListings,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'MarketSearch'> };

const SORTS: Array<{ value: MarketSort; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'newest', label: 'Новые', icon: 'time-outline' },
  { value: 'price_asc', label: 'Дешевле', icon: 'arrow-down-outline' },
  { value: 'price_desc', label: 'Дороже', icon: 'arrow-up-outline' },
  { value: 'oldest', label: 'Старые', icon: 'calendar-outline' },
];

const typeOptions: Array<{ id: 'all' | MarketCategoryId; label: string; icon: string }> = [
  { id: 'all', label: 'Все', icon: 'apps-outline' },
  ...MARKET_CATEGORIES.map((item) => ({ id: item.id, label: item.shortLabel, icon: item.icon })),
];

const getResultCategoryId = (listing: MarketListing): MarketCategoryId =>
  getMarketCategoryFromListingType(listing.listingType);

const onlyDigits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 9);

export default function MarketSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | MarketCategoryId>('all');
  const [location, setLocation] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<MarketSort>('newest');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [results, setResults] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [error, setError] = useState('');

  const effectiveQuery = useMemo(() => {
    if (query.trim()) return query.trim();
    return model.trim() || brand.trim();
  }, [brand, model, query]);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const [brandData, modelData] = await Promise.all([
        getDistinctBrands(type),
        getDistinctModels(brand, type),
      ]);
      setBrands(brandData.slice(0, 40));
      setModels(modelData.slice(0, 40));
    } catch {
      setBrands([]);
      setModels([]);
    } finally {
      setMetaLoading(false);
    }
  }, [brand, type]);

  const loadResults = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const options = {
        q: effectiveQuery,
        type,
        minPrice,
        maxPrice,
        location,
        category: brand || model,
        sortBy,
      };
      const data = effectiveQuery
        ? await searchMarketListings(options)
        : await filterMarketListings(options);
      setResults(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось выполнить поиск');
      setResults([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [brand, effectiveQuery, location, maxPrice, minPrice, model, sortBy, type]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const id = setTimeout(() => loadResults(), 350);
    return () => clearTimeout(id);
  }, [loadResults]);

  const refresh = () => {
    setRefreshing(true);
    loadResults(true);
    loadMeta();
  };

  const clearFilters = () => {
    setQuery('');
    setType('all');
    setLocation('');
    setMinPrice('');
    setMaxPrice('');
    setBrand('');
    setModel('');
    setSortBy('newest');
  };

  const openListing = (listing: MarketListing) => {
    const categoryId = getResultCategoryId(listing);
    navigation.navigate('MarketListingDetails', { listing, categoryId });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="options-outline" size={27} color="#111" />
        </View>
        <Text style={styles.title}>Поиск маркета</Text>
        <Text style={styles.subtitle}>Все объявления, фильтры, бренды и сортировка</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#777" />
        <TextInput
          style={styles.searchInput}
          placeholder="Марка, модель, услуга или запчасть"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {typeOptions.map((item) => {
          const active = type === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.typeChip, active && styles.typeChipActive]}
              onPress={() => {
                setType(item.id);
                setBrand('');
                setModel('');
              }}
              activeOpacity={0.86}
            >
              <Ionicons name={item.icon as any} size={16} color={active ? '#fff' : '#555'} />
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.filterGrid}>
        <View style={styles.filterInputWrap}>
          <Text style={styles.inputLabel}>Локация</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Город"
            placeholderTextColor="#999"
            value={location}
            onChangeText={setLocation}
          />
        </View>
        <View style={styles.filterInputWrap}>
          <Text style={styles.inputLabel}>Цена от</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="0"
            placeholderTextColor="#999"
            value={minPrice}
            onChangeText={(value) => setMinPrice(onlyDigits(value))}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.filterInputWrap}>
          <Text style={styles.inputLabel}>Цена до</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Любая"
            placeholderTextColor="#999"
            value={maxPrice}
            onChangeText={(value) => setMaxPrice(onlyDigits(value))}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {SORTS.map((item) => {
          const active = sortBy === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[styles.sortChip, active && styles.sortChipActive]}
              onPress={() => setSortBy(item.value)}
              activeOpacity={0.86}
            >
              <Ionicons name={item.icon} size={15} color={active ? '#fff' : '#555'} />
              <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.metaBlock}>
        <View style={styles.metaTitleRow}>
          <Text style={styles.metaTitle}>Бренды и модели</Text>
          {metaLoading ? <ActivityIndicator color="#111" /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {brands.length ? brands.slice(0, 18).map((item) => {
            const active = brand === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.metaChip, active && styles.metaChipActive]}
                onPress={() => {
                  setBrand(active ? '' : item);
                  setModel('');
                  if (!query.trim()) setQuery(active ? '' : item);
                }}
              >
                <Text style={[styles.metaChipText, active && styles.metaChipTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }) : <Text style={styles.emptyMetaText}>Брендов пока нет</Text>}
        </ScrollView>
        {brand ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {models.length ? models.slice(0, 18).map((item) => {
              const active = model === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.metaChip, active && styles.metaChipActive]}
                  onPress={() => {
                    setModel(active ? '' : item);
                    if (!query.trim()) setQuery(active ? brand : item);
                  }}
                >
                  <Text style={[styles.metaChipText, active && styles.metaChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            }) : <Text style={styles.emptyMetaText}>Моделей для бренда пока нет</Text>}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.resultCount}>{results.length} результатов</Text>
        <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
          <Ionicons name="refresh-outline" size={15} color="#111" />
          <Text style={styles.clearText}>Сбросить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderResult = ({ item }: { item: MarketListing }) => {
    const categoryId = getResultCategoryId(item);
    const category = getMarketCategory(categoryId);
    const image = getListingImage(item);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openListing(item)} activeOpacity={0.9}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.noImage]}>
            <Ionicons name={category.icon as any} size={28} color="#aaa" />
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.categoryPill}>{category.shortLabel}</Text>
            {item.year ? <Text style={styles.yearText}>{item.year}</Text> : null}
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{getListingTitle(item)}</Text>
          <Text style={styles.price}>{getListingPrice(item, categoryId)}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color="#777" />
            <Text style={styles.metaText} numberOfLines={1}>{item.location || item.region || item.registrationPlace || 'Локация не указана'}</Text>
          </View>
          <View style={styles.specRow}>
            {item.brand ? <Text style={styles.spec}>{item.brand}</Text> : null}
            {item.model ? <Text style={styles.spec}>{item.model}</Text> : null}
            {item.category ? <Text style={styles.spec}>{item.category}</Text> : null}
            {item.partCategory ? <Text style={styles.spec}>{item.partCategory}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      style={styles.container}
      data={results}
      keyExtractor={(item, index) => `${item.listingType || 'market'}-${item._id || item.id || index}`}
      renderItem={renderResult}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={results.length ? styles.list : styles.emptyList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={
        loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#111" />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name={error ? 'alert-circle-outline' : 'search-outline'} size={38} color="#bbb" />
            <Text style={styles.emptyTitle}>{error || 'Ничего не найдено'}</Text>
            <Text style={styles.emptyText}>
              {error ? 'Потяните экран вниз, чтобы повторить запрос.' : 'Измените запрос, категорию или ценовой диапазон.'}
            </Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  list: { padding: 12, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 10, marginBottom: 2 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: '#111', fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#666', fontSize: 14, textAlign: 'center' },
  searchBox: { height: 46, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: '#111', fontSize: 15 },
  chipRow: { gap: 8, paddingVertical: 2 },
  typeChip: { height: 38, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5', flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChipActive: { backgroundColor: '#111', borderColor: '#111' },
  typeChipText: { color: '#555', fontSize: 13, fontWeight: '900' },
  typeChipTextActive: { color: '#fff' },
  filterGrid: { flexDirection: 'row', gap: 8 },
  filterInputWrap: { flex: 1 },
  inputLabel: { color: '#666', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  filterInput: { height: 42, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', paddingHorizontal: 10, color: '#111', fontSize: 14 },
  sortChip: { height: 36, borderRadius: 10, paddingHorizontal: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5', flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortChipActive: { backgroundColor: '#d92323', borderColor: '#d92323' },
  sortChipText: { color: '#555', fontSize: 12, fontWeight: '900' },
  sortChipTextActive: { color: '#fff' },
  metaBlock: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ececec', padding: 12, gap: 8 },
  metaTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaTitle: { color: '#111', fontSize: 15, fontWeight: '900' },
  metaChip: { height: 34, borderRadius: 10, paddingHorizontal: 11, backgroundColor: '#f7f7f7', borderWidth: 1, borderColor: '#e5e5e5', justifyContent: 'center' },
  metaChipActive: { backgroundColor: '#111', borderColor: '#111' },
  metaChipText: { color: '#555', fontSize: 12, fontWeight: '900' },
  metaChipTextActive: { color: '#fff' },
  emptyMetaText: { color: '#999', fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: '#111', fontSize: 15, fontWeight: '900' },
  clearBtn: { height: 34, borderRadius: 10, paddingHorizontal: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5', flexDirection: 'row', alignItems: 'center', gap: 5 },
  clearText: { color: '#111', fontSize: 12, fontWeight: '900' },
  card: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ececec' },
  cardImage: { width: '100%', height: 170, backgroundColor: '#eee' },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#f2f2f2', color: '#111', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  yearText: { color: '#777', fontSize: 12, fontWeight: '900' },
  cardTitle: { marginTop: 11, color: '#111', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  price: { marginTop: 7, color: '#111', fontSize: 17, fontWeight: '900' },
  metaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { flex: 1, color: '#777', fontSize: 13 },
  specRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spec: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#f3f3f3', color: '#555', fontSize: 12, fontWeight: '700' },
  loadingBox: { paddingVertical: 34 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: '#111', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: '#777', fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
