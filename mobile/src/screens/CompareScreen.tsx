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
import { Skeleton } from '../components/ui';
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
  getMarketListingById,
  MarketCategoryId,
} from '../api/market';

const plural = (n: number, forms: [string, string, string]) => {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (d > 1 && d < 5) return forms[1];
  if (d === 1) return forms[0];
  return forms[2];
};

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
  { label: 'Опыт', getValue: (item) => {
    const years = Number(item.listing?.experience);
    return Number.isFinite(years) && years > 0 ? `${years} ${plural(years, ['год', 'года', 'лет'])}` : '';
  } },
];

// Resolve one compare item by id against the categories its type maps to —
// a couple of by-id requests instead of downloading whole category lists.
const resolveItem = async (item: CompareItem): Promise<ResolvedCompareItem> => {
  for (const categoryId of categoriesByType[item.type] || []) {
    try {
      const listing = await getMarketListingById(categoryId, item.id);
      if (listing) return { ...item, listing, categoryId };
    } catch {
      // 404 in this category — try the next one.
    }
  }
  return { ...item };
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

      setResolvedItems(await Promise.all(nextItems.map(resolveItem)));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить сравнение');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const hasDataRef = React.useRef(false);
  hasDataRef.current = resolvedItems.length > 0 || items.length > 0;

  useFocusEffect(useCallback(() => {
    load(hasDataRef.current);
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
      <View style={[styles.container, styles.content]}>
        <View style={styles.cardsRow}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton style={styles.skeletonImage} />
              <Skeleton style={styles.skeletonLine} />
              <Skeleton style={styles.skeletonLineShort} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      {error ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={styles.emptyTitle}>{error}</Text>
          <Text style={styles.emptyText}>Потяните экран вниз, чтобы попробовать снова.</Text>
        </View>
      ) : !items.length ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="albums-outline" size={42} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Список сравнения пуст</Text>
          <Text style={styles.emptyText}>Откройте объявление в маркете и нажмите “Сравнить”.</Text>
        </View>
      ) : (
        <>
          <View style={styles.topRow}>
            <Text style={styles.countText}>
              {comparisonType ? `${typeLabel[comparisonType]} · ` : ''}{items.length}/2
            </Text>
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
  content: { flexGrow: 1, padding: 16, paddingBottom: 28 },
  skeletonCard: { flex: 1, borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden', paddingBottom: 14 },
  skeletonImage: { width: '100%', height: 112, borderRadius: 0 },
  skeletonLine: { marginTop: 10, marginHorizontal: 10, height: 14, width: '80%' },
  skeletonLineShort: { marginTop: 8, marginHorizontal: 10, height: 12, width: '55%' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 },
  countText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  clearBtn: { minWidth: 88, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  clearText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
  cardsRow: { flexDirection: 'row', gap: 10 },
  itemCard: { flex: 1, borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  itemImage: { width: '100%', height: 112, backgroundColor: colors.surfaceAlt },
  itemImageFallback: { alignItems: 'center', justifyContent: 'center' },
  itemTitle: { marginTop: 10, paddingHorizontal: 10, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '900', minHeight: 38 },
  itemPrice: { paddingHorizontal: 10, marginTop: 5, color: colors.text, fontSize: 14, fontWeight: '900' },
  removeBtn: { margin: 10, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  table: { marginTop: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  tableRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, padding: 12 },
  rowLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  rowValues: { flexDirection: 'row', gap: 10 },
  rowValue: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  emptyBox: { padding: 18, alignItems: 'center' },
});
