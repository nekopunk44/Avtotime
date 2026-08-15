import React, { useCallback, useEffect, useState } from 'react';
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
  getListingImage,
  getListingPrice,
  getListingTitle,
  getMarketCategory,
  getMarketCategoryFromListingType,
  MARKET_CATEGORIES,
  MarketCategoryId,
  MarketListing,
  MarketSearchOptions,
  MarketSort,
  searchMarketListings,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'MarketSearch'> };

type CategoryKey = 'all' | MarketCategoryId;
type FieldKey = 'brand' | 'model' | 'partGroup' | 'year' | 'price' | 'mileage' | 'fuel' | 'gearbox' | 'bodyType' | 'driveType' | 'region';

// Filter fields shown per category (mirrors the backend filter clauses).
const FIELDS: Record<CategoryKey, FieldKey[]> = {
  all: ['price', 'region'],
  cars: ['brand', 'model', 'year', 'price', 'mileage', 'fuel', 'gearbox', 'bodyType', 'driveType', 'region'],
  parts: ['brand', 'model', 'partGroup', 'year', 'price', 'region'],
  'car-services': ['price', 'region'],
  'auto-tuning': ['brand', 'model', 'price', 'region'],
  consultations: ['price', 'region'],
  'dry-cleaning': ['price', 'region'],
};

const FUEL = ['Бензин', 'Дизель', 'Газ', 'Гибрид', 'Электро'];
const GEARBOX = ['Механика', 'Автомат', 'Робот', 'Вариатор'];
const BODY = ['Седан', 'Хэтчбек', 'Универсал', 'Кроссовер', 'Внедорожник', 'Купе', 'Минивэн', 'Пикап', 'Кабриолет'];
const DRIVE = ['Передний', 'Задний', 'Полный'];

const SORTS: Array<{ value: MarketSort; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'newest', label: 'Новые', icon: 'time-outline' },
  { value: 'price_asc', label: 'Дешевле', icon: 'arrow-down-outline' },
  { value: 'price_desc', label: 'Дороже', icon: 'arrow-up-outline' },
  { value: 'oldest', label: 'Старые', icon: 'calendar-outline' },
];

const TYPES: Array<{ id: CategoryKey; label: string; icon: string }> = [
  { id: 'all', label: 'Все', icon: 'apps-outline' },
  ...MARKET_CATEGORIES.map((item) => ({ id: item.id, label: item.shortLabel, icon: item.icon })),
];

const emptyForm = {
  brand: '', model: '', partGroup: '', region: '',
  priceMin: '', priceMax: '', yearFrom: '', yearTo: '', mileageMin: '', mileageMax: '',
  fuel: '', gearbox: '', bodyType: '', driveType: '',
};
type Form = typeof emptyForm;

const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 9);
const getResultCategoryId = (listing: MarketListing): MarketCategoryId =>
  getMarketCategoryFromListingType(listing.listingType);

const pluralResults = (n: number) => {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return 'результатов';
  if (d > 1 && d < 5) return 'результата';
  if (d === 1) return 'результат';
  return 'результатов';
};

export default function MarketSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<CategoryKey>('all');
  const [sortBy, setSortBy] = useState<MarketSort>('newest');
  const [form, setForm] = useState<Form>(emptyForm);
  const [results, setResults] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof Form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const fields = FIELDS[type];

  const requestIdRef = React.useRef(0);

  const loadResults = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current;
    if (!silent) setLoading(true);
    setError('');
    try {
      const options: MarketSearchOptions = {
        q: query, type, sortBy,
        brand: form.brand, model: form.model, partGroup: form.partGroup, region: form.region,
        priceMin: form.priceMin, priceMax: form.priceMax,
        yearFrom: form.yearFrom, yearTo: form.yearTo,
        mileageMin: form.mileageMin, mileageMax: form.mileageMax,
        fuel: form.fuel, gearbox: form.gearbox, bodyType: form.bodyType, driveType: form.driveType,
      };
      const data = query.trim() ? await searchMarketListings(options) : await filterMarketListings(options);
      if (requestId !== requestIdRef.current) return;
      setResults(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось выполнить поиск');
      setResults([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query, type, sortBy, form]);

  useEffect(() => {
    const id = setTimeout(() => loadResults(), 350);
    return () => clearTimeout(id);
  }, [loadResults]);

  const refresh = () => {
    setRefreshing(true);
    loadResults(true);
  };

  const reset = () => {
    setQuery('');
    setSortBy('newest');
    setType('cars');
    setForm(emptyForm);
  };

  const openListing = (listing: MarketListing) => {
    navigation.navigate('MarketListingDetails', { listing, categoryId: getResultCategoryId(listing) });
  };

  const renderRange = (label: string, minKey: keyof Form, maxKey: keyof Form) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rangeRow}>
        <TextInput
          style={styles.rangeInput}
          placeholder="от"
          placeholderTextColor={colors.textFaint}
          value={form[minKey]}
          onChangeText={(v) => set(minKey, digits(v))}
          keyboardType="number-pad"
        />
        <TextInput
          style={styles.rangeInput}
          placeholder="до"
          placeholderTextColor={colors.textFaint}
          value={form[maxKey]}
          onChangeText={(v) => set(maxKey, digits(v))}
          keyboardType="number-pad"
        />
      </View>
    </View>
  );

  const renderText = (label: string, key: keyof Form, placeholder: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        autoCapitalize="none"
      />
    </View>
  );

  const renderSelect = (label: string, key: keyof Form, options: string[]) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectRow}>
        {options.map((opt) => {
          const active = form[key] === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.selectChip, active && styles.selectChipActive]}
              onPress={() => set(key, active ? '' : opt)}
              activeOpacity={0.85}
            >
              <Text style={[styles.selectText, active && styles.selectTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderField = (key: FieldKey) => {
    switch (key) {
      case 'brand': return renderText('Марка', 'brand', 'Напр. BMW');
      case 'model': return renderText('Модель', 'model', 'Напр. X5');
      case 'partGroup': return renderText('Группа запчастей', 'partGroup', 'Напр. Тормоза');
      case 'region': return renderText('Регион / город', 'region', 'Город');
      case 'price': return renderRange('Цена, €', 'priceMin', 'priceMax');
      case 'year': return renderRange('Год', 'yearFrom', 'yearTo');
      case 'mileage': return renderRange('Пробег, км', 'mileageMin', 'mileageMax');
      case 'fuel': return renderSelect('Топливо', 'fuel', FUEL);
      case 'gearbox': return renderSelect('Коробка', 'gearbox', GEARBOX);
      case 'bodyType': return renderSelect('Кузов', 'bodyType', BODY);
      case 'driveType': return renderSelect('Привод', 'driveType', DRIVE);
      default: return null;
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Название, марка или услуга"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TYPES.map((item) => {
          const active = type === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.typeChip, active && styles.typeChipActive]}
              onPress={() => { setType(item.id); setForm(emptyForm); }}
              activeOpacity={0.86}
            >
              <Ionicons name={item.icon as any} size={16} color={active ? colors.onAccent : colors.textMuted} />
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {fields.map((key) => <View key={key}>{renderField(key)}</View>)}

      <View style={styles.field}>
        <Text style={styles.label}>Сортировка</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectRow}>
          {SORTS.map((s) => {
            const active = sortBy === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                style={[styles.selectChip, active && styles.selectChipActive]}
                onPress={() => setSortBy(s.value)}
                activeOpacity={0.85}
              >
                <Ionicons name={s.icon} size={14} color={active ? colors.onAccent : colors.textMuted} />
                <Text style={[styles.selectText, active && styles.selectTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.resultCount}>{results.length} {pluralResults(results.length)}</Text>
        <TouchableOpacity onPress={reset} style={styles.clearBtn}>
          <Ionicons name="refresh-outline" size={15} color={colors.text} />
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
            <Ionicons name={category.icon as any} size={28} color={colors.textFaint} />
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
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>{item.location || item.region || item.registrationPlace || 'Локация не указана'}</Text>
          </View>
          <View style={styles.specRow}>
            {item.brand ? <Text style={styles.spec}>{item.brand}</Text> : null}
            {item.model ? <Text style={styles.spec}>{item.model}</Text> : null}
            {item.fuel ? <Text style={styles.spec}>{item.fuel}</Text> : null}
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.text} />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name={error ? 'alert-circle-outline' : 'search-outline'} size={38} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>{error || 'Ничего не найдено'}</Text>
            <Text style={styles.emptyText}>
              {error ? 'Потяните экран вниз, чтобы повторить.' : 'Измените фильтры или категорию.'}
            </Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 12, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 12, marginBottom: 4 },
  searchBox: { height: 48, borderRadius: 14, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginTop: 4 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  chipRow: { gap: 8, paddingVertical: 2 },
  typeChip: { height: 38, borderRadius: 999, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  typeChipTextActive: { color: colors.onAccent },

  field: { gap: 8 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '900', marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { height: 46, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 14, color: colors.text, fontSize: 15 },
  rangeRow: { flexDirection: 'row', gap: 8 },
  rangeInput: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 14, color: colors.text, fontSize: 15 },
  selectRow: { gap: 8, paddingVertical: 1 },
  selectChip: { height: 38, borderRadius: 999, paddingHorizontal: 14, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  selectChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  selectTextActive: { color: colors.onAccent },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  resultCount: { color: colors.text, fontSize: 15, fontWeight: '900' },
  clearBtn: { height: 36, borderRadius: 999, paddingHorizontal: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 5 },
  clearText: { color: colors.text, fontSize: 12, fontWeight: '900' },

  card: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardImage: { width: '100%', height: 170, backgroundColor: colors.surfaceAlt },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  yearText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  cardTitle: { marginTop: 11, color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  price: { marginTop: 7, color: colors.text, fontSize: 17, fontWeight: '900' },
  metaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { flex: 1, color: colors.textMuted, fontSize: 13 },
  specRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spec: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.surfaceAlt, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  loadingBox: { paddingVertical: 34 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
