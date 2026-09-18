import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, font, radius, shadow, space } from '../theme';
import { EmptyState, PressableScale, Skeleton } from '../components/ui';
import { useCompareStore } from '../store/compareStore';
import {
  CompareItem,
  CompareItemType,
  ResolvedCompareItem,
} from '../api/compare';
import {
  getListingImage,
  getListingPrice,
  getListingTitle,
  getMarketListingById,
  MarketCategoryId,
} from '../api/market';
import { TAB_BAR_SPACE } from '../navigation/FloatingTabBar';

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

/**
 * Куда смотрит «лучше»: у цены и пробега выигрывает меньшее, у года и оценок —
 * большее. Там, где лучшего не бывает (цвет, город), сравнение молчит.
 */
type Better = 'low' | 'high' | undefined;

const compareRows: Array<{
  label: string;
  better?: Better;
  /** Цена сопоставима только внутри одного раздела: «€ 20/ч» и «34 900 €» — разные величины. */
  sameCategoryOnly?: boolean;
  getValue: (item: ResolvedCompareItem) => string;
}> = [
  { label: 'Цена', better: 'low', sameCategoryOnly: true, getValue: (item) => item.listing ? getListingPrice(item.listing, item.categoryId) : '' },
  { label: 'Локация', getValue: (item) => item.listing?.location || item.listing?.region || '' },
  { label: 'Марка', getValue: (item) => item.listing?.brand || '' },
  { label: 'Модель', getValue: (item) => item.listing?.model || '' },
  { label: 'Год', better: 'high', getValue: (item) => item.listing?.year || '' },
  { label: 'Пробег', better: 'low', getValue: (item) => item.listing?.mileage || '' },
  { label: 'Топливо', getValue: (item) => item.listing?.fuel || '' },
  { label: 'КПП', getValue: (item) => item.listing?.transmission || '' },
  { label: 'Категория', getValue: (item) => item.listing?.category || item.listing?.partCategory || item.listing?.partGroup || '' },
  { label: 'Рейтинг', better: 'high', getValue: (item) => {
    const value = item.listing?.rating ?? item.listing?.serviceQuality;
    return value ? `${value}/5` : '';
  } },
  { label: 'Опыт', better: 'high', getValue: (item) => {
    const years = Number(item.listing?.experience);
    return Number.isFinite(years) && years > 0 ? `${years} ${plural(years, ['год', 'года', 'лет'])}` : '';
  } },
];

/** Число из «34 900 €» или «74 000 км»: пробелы внутри цифр разделяют разряды. */
export function numericOf(value: string): number | null {
  const digits = value.replace(/\s| /g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!digits) return null;
  const num = Number(digits[0].replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

/** Индекс выигравшего значения или -1: равные и несравнимые победителя не дают. */
export function betterIndex(values: string[], better: Better, comparable: boolean): number {
  if (!better || !comparable || values.length < 2) return -1;
  if (values.some((value) => !value)) return -1;
  const numbers = values.map(numericOf);
  if (numbers.some((num) => num === null)) return -1;
  const nums = numbers as number[];
  if (nums[0] === nums[1]) return -1;
  const wins0 = better === 'low' ? nums[0] < nums[1] : nums[0] > nums[1];
  return wins0 ? 0 : 1;
}

const enableLayoutAnimation = () => {
  const manager = UIManager as unknown as {
    setLayoutAnimationEnabledExperimental?: (enabled: boolean) => void;
  };
  manager.setLayoutAnimationEnabledExperimental?.(true);
};

const same = (values: string[]) =>
  values.length > 1 && values.every((value) => value.trim().toLowerCase() === values[0].trim().toLowerCase());

// Одну позицию ищем по id в тех разделах, куда ведёт её тип: пара запросов
// вместо выкачивания целых списков.
const resolveItem = async (item: CompareItem): Promise<ResolvedCompareItem> => {
  for (const categoryId of categoriesByType[item.type] || []) {
    try {
      const listing = await getMarketListingById(categoryId, item.id);
      if (listing) return { ...item, listing, categoryId };
    } catch {
      // В этом разделе не нашлось — пробуем следующий.
    }
  }
  return { ...item };
};

export default function CompareScreen() {
  const navigation = useNavigation<any>();
  // Список общий со всем приложением: убрали здесь — отметка на карточке в
  // маркете гаснет сама.
  const items = useCompareStore((s) => s.items);
  const saving = useCompareStore((s) => s.saving);
  const refreshItems = useCompareStore((s) => s.refresh);
  const removeItem = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);
  const [resolvedItems, setResolvedItems] = useState<ResolvedCompareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // Главный вопрос сравнения — чем они отличаются. Одинаковые строки можно
  // убрать с глаз одним нажатием.
  const [diffOnly, setDiffOnly] = useState(false);

  // Карточка улетает в корзину: удаление видно как движение, а не как
  // мгновенное исчезновение, и понятно, куда именно она делась.
  const trashRef = React.useRef<View>(null);
  const cardRefs = React.useRef<Record<string, View | null>>({});
  const fly = React.useRef(new Animated.Value(0)).current;
  const trashPulse = React.useRef(new Animated.Value(0)).current;
  const [flying, setFlying] = useState<{ key: string; dx: number; dy: number } | null>(null);

  useEffect(enableLayoutAnimation, []);

  // Совпавшие строки уходят и возвращаются на месте: таблица перестраивается
  // плавно, иначе список подменяется рывком и теряешь, где читал.
  const toggleDiffOnly = () => {
    LayoutAnimation.configureNext({
      duration: 260,
      update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleXY },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setDiffOnly((prev) => !prev);
  };

  const pair = resolvedItems.length === 2;

  const rows = useMemo(() => {
    const sameCategory = pair && resolvedItems[0]?.categoryId === resolvedItems[1]?.categoryId;
    return compareRows
      .map((row) => {
        const values = resolvedItems.map((item) => row.getValue(item));
        return {
          label: row.label,
          values,
          equal: same(values),
          winner: betterIndex(values, row.better, !row.sameCategoryOnly || sameCategory),
        };
      })
      .filter((row) => row.values.some(Boolean));
  }, [resolvedItems, pair]);

  const diffCount = useMemo(() => rows.filter((row) => !row.equal).length, [rows]);
  const shownRows = diffOnly ? rows.filter((row) => !row.equal) : rows;

  const itemKey = (item: CompareItem) => `${item.type}-${item.id}`;
  // Ключ состава: объявления перечитываются, когда меняется сам список, а не
  // на каждое обновление стора.
  const itemsKey = items.map(itemKey).join(',');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      await refreshItems();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить сравнение');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshItems]);

  const hasDataRef = React.useRef(false);
  hasDataRef.current = resolvedItems.length > 0 || items.length > 0;

  useFocusEffect(useCallback(() => {
    load(hasDataRef.current);
  }, [load]));

  // Сами объявления подтягиваются по id: в списке лежат только ссылки.
  useEffect(() => {
    if (!items.length) {
      setResolvedItems([]);
      return;
    }
    let alive = true;
    Promise.all(items.map(resolveItem))
      .then((next) => { if (alive) setResolvedItems(next); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  /**
   * Карточка летит по дуге в корзину в шапке и только потом удаляется. Место
   * корзины меряем каждый раз: экран прокручивается, и запомненное устареет.
   */
  const flyToTrash = (item: ResolvedCompareItem) => {
    const key = itemKey(item);
    const node = cardRefs.current[key];
    const trash = trashRef.current;
    if (!node || !trash || flying) {
      removeItem(item);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      trash.measureInWindow((tx, ty, tw, th) => {
        setFlying({
          key,
          dx: (tx + tw / 2) - (x + width / 2),
          dy: (ty + th / 2) - (y + height / 2),
        });
        // Кадр на применение стиля: иначе анимация стартует с уже сдвинутой карточки.
        requestAnimationFrame(() => {
          Animated.timing(fly, {
            toValue: 1,
            duration: 460,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            // Корзина отзывается на попадание — иначе полёт кончается в никуда.
            Animated.sequence([
              Animated.spring(trashPulse, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 16 }),
              Animated.spring(trashPulse, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 6 }),
            ]).start();
            removeItem(item).finally(() => {
              fly.setValue(0);
              setFlying(null);
            });
          });
        });
      });
    });
  };

  const openListing = (item: ResolvedCompareItem) => {
    if (!item.listing || !item.categoryId) return;
    navigation.navigate('MarketListingDetails', { listing: item.listing, categoryId: item.categoryId });
  };

  const shortTitle = (item: ResolvedCompareItem) =>
    (item.listing ? getListingTitle(item.listing) : `ID ${item.id}`);

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

  const header = (
    <View key="head" style={styles.head}>
      <Text style={styles.title}>Сравнение</Text>
      {items.length ? (
        <View ref={trashRef} collapsable={false}>
          <Animated.View
            style={{
              transform: [{ scale: trashPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }],
            }}
          >
            <PressableScale style={styles.clearBtn} onPress={clear} disabled={saving} scaleTo={0.94}>
              {saving
                ? <ActivityIndicator size="small" color={colors.textMuted} />
                : <Ionicons name="trash-outline" size={18} color={colors.textMuted} />}
            </PressableScale>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );

  // Дуга, а не прямая: карточка сперва подбрасывается и лишь потом ныряет
  // в корзину — по прямой движение читается как рывок.
  const flyStyle = flying ? {
    zIndex: 5,
    opacity: fly.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
    transform: [
      { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, flying.dx] }) },
      {
        translateY: fly.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [0, flying.dy * 0.25 - 44, flying.dy],
        }),
      },
      { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.16] }) },
      { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '14deg'] }) },
    ],
  } : null;

  const body: React.ReactNode[] = [header];

  if (error) {
    body.push(
      <EmptyState
        key="error"
        icon="alert-circle-outline"
        title={error}
        subtitle="Потяните экран вниз, чтобы попробовать снова."
      />,
    );
  } else if (!items.length) {
    body.push(
      <EmptyState
        key="empty"
        icon="git-compare-outline"
        title="Сравнивать пока нечего"
        subtitle="Нажмите значок сравнения на карточке объявления — здесь появится разбор по характеристикам."
        actionLabel="Перейти в маркет"
        onAction={() => navigation.navigate('Market')}
      />,
    );
  } else {
    body.push(
      <View key="cards" style={styles.cardsRow}>
        {resolvedItems.map((item) => (
          <Animated.View
            key={itemKey(item)}
            ref={(node) => { cardRefs.current[itemKey(item)] = node as unknown as View; }}
            collapsable={false}
            style={[styles.cardSlot, flying?.key === itemKey(item) ? flyStyle : null]}
          >
          <PressableScale
            style={styles.itemCard}
            scaleTo={0.98}
            onPress={() => openListing(item)}
          >
            {item.listing && getListingImage(item.listing) ? (
              <Image source={{ uri: getListingImage(item.listing) }} style={styles.itemImage} />
            ) : (
              <View style={[styles.itemImage, styles.itemImageFallback]}>
                <Ionicons name="image-outline" size={25} color={colors.textFaint} />
              </View>
            )}
            {/* Убрать — маленьким крестиком на фото: удаление здесь не главное
                действие, а красная кнопка во всю ширину кричала о нём. */}
            <PressableScale
              style={styles.removeBtn}
              scaleTo={0.9}
              onPress={() => flyToTrash(item)}
              disabled={saving || !!flying}
            >
              <Ionicons name="close" size={16} color={colors.text} />
            </PressableScale>
            <View style={styles.itemBody}>
              <Text style={styles.itemPrice} numberOfLines={1}>
                {item.listing ? getListingPrice(item.listing, item.categoryId) : 'Не найдено'}
              </Text>
              <Text style={styles.itemTitle} numberOfLines={2}>{shortTitle(item)}</Text>
            </View>
          </PressableScale>
          </Animated.View>
        ))}

        {/* Второе место пустует — предлагаем занять его, а не оставляем дыру. */}
        {resolvedItems.length === 1 ? (
          <PressableScale
            style={[styles.itemCard, styles.addCard]}
            scaleTo={0.98}
            onPress={() => navigation.navigate('Market')}
          >
            <Ionicons name="add" size={26} color={colors.textMuted} />
            <Text style={styles.addText}>Добавить второе объявление</Text>
          </PressableScale>
        ) : null}
      </View>,
    );

    if (pair) {
      body.push(
        <View key="toolbar" style={styles.toolbar}>
          <Text style={styles.diffCount}>
            {diffCount
              ? `${diffCount} ${plural(diffCount, ['отличие', 'отличия', 'отличий'])}`
              : 'Отличий нет'}
          </Text>
          <PressableScale
            style={[styles.diffChip, diffOnly && styles.diffChipOn]}
            scaleTo={0.96}
            onPress={toggleDiffOnly}
          >
            <Ionicons
              name={diffOnly ? 'funnel' : 'funnel-outline'}
              size={14}
              color={diffOnly ? colors.onAccent : colors.textMuted}
            />
            <Text style={[styles.diffChipText, diffOnly && styles.diffChipTextOn]}>Только отличия</Text>
          </PressableScale>
        </View>,
      );
    }

    body.push(
      <View key="table" style={styles.table}>
        {shownRows.length ? shownRows.map((row, rowIndex) => (
          <View key={row.label} style={[styles.tableRow, rowIndex === shownRows.length - 1 && styles.tableRowLast]}>
            {/* Название слева, значения в своих колонках: у строки появляется
                ось, вдоль которой глаз идёт сверху вниз. */}
            <Text style={styles.rowLabel} numberOfLines={2}>{row.label}</Text>
            {row.values.map((value, index) => (
              <View key={`${row.label}-${index}`} style={styles.valueCell}>
                <View style={[styles.valuePill, row.winner === index && styles.valuePillWin]}>
                  <Text
                    style={[
                      styles.rowValue,
                      // Совпало — значит выбор от этой строки не зависит.
                      row.equal && styles.rowValueSame,
                      row.winner === index && styles.rowValueWin,
                    ]}
                    numberOfLines={2}
                  >
                    {value || '—'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {diffOnly ? 'Объявления одинаковы по всем характеристикам.' : 'Нет общих характеристик для сравнения.'}
            </Text>
          </View>
        )}
      </View>,
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      {body}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: space.md, paddingBottom: TAB_BAR_SPACE },

  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: space.md,
  },
  title: { color: colors.text, fontSize: font.display, fontWeight: '900' },
  clearBtn: {
    width: 38, height: 38, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt,
  },

  skeletonCard: {
    flex: 1, borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    overflow: 'hidden', paddingBottom: space.md,
  },
  skeletonImage: { width: '100%', height: 112, borderRadius: 0 },
  skeletonLine: { marginTop: space.sm, marginHorizontal: space.sm, height: 14, width: '80%' },
  skeletonLineShort: { marginTop: 6, marginHorizontal: space.sm, height: 12, width: '55%' },

  cardsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  cardSlot: { flex: 1 },
  itemCard: {
    borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden',
  },
  itemImage: { width: '100%', height: 118, backgroundColor: colors.surfaceAlt },
  itemImageFallback: { alignItems: 'center', justifyContent: 'center' },
  removeBtn: {
    position: 'absolute', top: space.sm, right: space.sm,
    width: 30, height: 30, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,11,14,0.6)',
  },
  itemBody: { padding: space.sm, gap: 3 },
  itemPrice: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  itemTitle: { color: colors.textMuted, fontSize: font.small, lineHeight: 18, fontWeight: '700', minHeight: 36 },
  addCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.md,
    minHeight: 190, backgroundColor: colors.bg, borderStyle: 'dashed', borderColor: colors.surfaceHi,
  },
  addText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '800', textAlign: 'center' },

  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  diffCount: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  diffChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 32, paddingHorizontal: space.md, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  diffChipOn: { backgroundColor: colors.accent },
  diffChipText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '900' },
  diffChipTextOn: { color: colors.onAccent },

  table: {
    borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden',
    ...shadow.card,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  tableRowLast: { borderBottomWidth: 0 },
  rowLabel: { width: 92, color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  valueCell: { flex: 1, alignItems: 'center' },
  // Выгодное значение подсвечено фоном, а не значком: значок сдвигал текст
  // вбок, и колонки переставали стоять друг под другом.
  valuePill: { maxWidth: '100%', paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  valuePillWin: { backgroundColor: 'rgba(61,214,140,0.14)' },
  rowValue: { color: colors.text, fontSize: font.small, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  rowValueSame: { color: colors.textMuted, fontWeight: '700' },
  rowValueWin: { color: colors.success },
  emptyBox: { padding: space.lg, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: font.small, lineHeight: 19, textAlign: 'center' },
});
