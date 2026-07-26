import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import {
  CompareItem,
  CompareItemType,
  getCompareItems,
  ResolvedCompareItem,
  saveCompareItems,
} from '../api/compare';
import {
  getListingImage,
  getListingPrice,
  getListingTitle,
  loadMarketListings,
  MarketCategoryId,
  MarketListing,
} from '../api/market';

const categoriesByType: Record<CompareItemType, MarketCategoryId[]> = {
  car: ['cars', 'parts'],
  service: ['car-services', 'auto-tuning', 'dry-cleaning'],
  consultation: ['consultations'],
};

const typeLabel: Record<CompareItemType, string> = {
  car: 'Авто и запчасти',
  service: 'Услуги',
  consultation: 'Консультации',
};

const compareRows: Array<{ label: string; getValue: (item: ResolvedCompareItem) => string }> = [
  { label: 'Цена', getValue: (item) => item.listing ? getListingPrice(item.listing, item.categoryId) : '' },
  { label: 'Локация', getValue: (item) => item.listing?.location || item.listing?.region || '' },
  { label: 'Марка', getValue: (item) => item.listing?.brand || '' },
  { label: 'Модель', getValue: (item) => item.listing?.model || '' },
  { label: 'Год', getValue: (item) => item.listing?.year || '' },
  { label: 'Пробег', getValue: (item) => item.listing?.mileage || '' },
  { label: 'Топливо', getValue: (item) => item.listing?.fuel || '' },
  { label: 'КПП', getValue: (item) => item.listing?.transmission || '' },
  { label: 'Категория', getValue: (item) => item.listing?.category || item.listing?.partCategory || item.listing?.partGroup || '' },
  { label: 'Рейтинг', getValue: (item) => {
    const value = item.listing?.rating ?? item.listing?.serviceQuality;
    return value ? `${value}/5` : '';
  } },
  { label: 'Опыт', getValue: (item) => item.listing?.experience ? `${item.listing.experience} лет` : '' },
];

const findListing = (lists: Array<{ categoryId: MarketCategoryId; listings: MarketListing[] }>, item: CompareItem) => {
  for (const list of lists) {
    const listing = list.listings.find((candidate) => candidate.id === item.id);
    if (listing) return { listing, categoryId: list.categoryId };
  }
  return {};
};

export default function CompareScreen() {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [resolvedItems, setResolvedItems] = useState<ResolvedCompareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const comparisonType = items[0]?.type;
  const visibleRows = useMemo(
    () => compareRows.filter((row) => resolvedItems.some((item) => row.getValue(item))),
    [resolvedItems],
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const nextItems = await getCompareItems();
      setItems(nextItems);

      if (!nextItems.length) {
        setResolvedItems([]);
        return;
      }

      const type = nextItems[0].type;
      const categories = categoriesByType[type] || [];
      const loadedLists = await Promise.all(
        categories.map(async (categoryId) => ({
          categoryId,
          listings: await loadMarketListings(categoryId, { limit: 200 }),
        })),
      );

      setResolvedItems(nextItems.map((item) => {
        const match = findListing(loadedLists, item);
        return { ...item, ...match };
      }));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить сравнение');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const saveNextItems = async (nextItems: CompareItem[]) => {
    setSaving(true);
    try {
      await saveCompareItems(nextItems);
      await load(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить сравнение');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = (item: CompareItem) => {
    const next = items.filter((candidate) => !(candidate.id === item.id && candidate.type === item.type));
    saveNextItems(next);
  };

  const clear = () => saveNextItems([]);

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
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="git-compare-outline" size={27} color={colors.text} />
        </View>
        <Text style={styles.title}>Сравнение</Text>
        <Text style={styles.subtitle}>
          {comparisonType ? typeLabel[comparisonType] : 'Добавьте до двух объявлений одного типа'}
        </Text>
      </View>

      {error ? (
        <View style={styles.emptyCard}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={styles.emptyTitle}>{error}</Text>
          <Text style={styles.emptyText}>Потяните экран вниз, чтобы попробовать снова.</Text>
        </View>
      ) : !items.length ? (
        <View style={styles.emptyCard}>
          <Ionicons name="albums-outline" size={38} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Список сравнения пуст</Text>
          <Text style={styles.emptyText}>Откройте объявление в маркете и нажмите “Сравнить”.</Text>
        </View>
      ) : (
        <>
          <View style={styles.topRow}>
            <Text style={styles.countText}>{items.length}/2 элемента</Text>
            <TouchableOpacity style={styles.clearBtn} onPress={clear} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.danger} /> : <Text style={styles.clearText}>Очистить</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.cardsRow}>
            {resolvedItems.map((item) => (
              <View key={`${item.type}-${item.id}`} style={styles.itemCard}>
                {item.listing && getListingImage(item.listing) ? (
                  <Image source={{ uri: getListingImage(item.listing) }} style={styles.itemImage} />
                ) : (
                  <View style={[styles.itemImage, styles.itemImageFallback]}>
                    <Ionicons name="image-outline" size={25} color={colors.textFaint} />
                  </View>
                )}
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.listing ? getListingTitle(item.listing) : `ID ${item.id}`}
                </Text>
                <Text style={styles.itemPrice} numberOfLines={1}>
                  {item.listing ? getListingPrice(item.listing, item.categoryId) : 'Не найдено'}
                </Text>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item)} disabled={saving}>
                  <Ionicons name="close" size={16} color={colors.danger} />
                  <Text style={styles.removeText}>Убрать</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.table}>
            {visibleRows.length ? visibleRows.map((row) => (
              <View key={row.label} style={styles.tableRow}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <View style={styles.rowValues}>
                  {resolvedItems.map((item) => (
                    <Text key={`${row.label}-${item.type}-${item.id}`} style={styles.rowValue} numberOfLines={2}>
                      {row.getValue(item) || '—'}
                    </Text>
                  ))}
                </View>
              </View>
            )) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Нет общих характеристик для сравнения.</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  hero: { alignItems: 'center', paddingVertical: 18 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 6, color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyCard: { marginTop: 18, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 },
  countText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  clearBtn: { minWidth: 88, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  clearText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
  cardsRow: { flexDirection: 'row', gap: 10 },
  itemCard: { flex: 1, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  itemImage: { width: '100%', height: 112, backgroundColor: colors.surfaceAlt },
  itemImageFallback: { alignItems: 'center', justifyContent: 'center' },
  itemTitle: { marginTop: 10, paddingHorizontal: 10, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '900', minHeight: 38 },
  itemPrice: { paddingHorizontal: 10, marginTop: 5, color: colors.text, fontSize: 14, fontWeight: '900' },
  removeBtn: { margin: 10, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  table: { marginTop: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableRow: { borderBottomWidth: 1, borderBottomColor: colors.border, padding: 12 },
  rowLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  rowValues: { flexDirection: 'row', gap: 10 },
  rowValue: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  emptyBox: { padding: 18, alignItems: 'center' },
});
