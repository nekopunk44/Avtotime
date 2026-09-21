import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  deleteMarketListing,
  getListingImage,
  getListingPrice,
  getListingTitle,
  loadMyMarketListings,
  MARKET_CATEGORIES,
  MarketCategoryId,
  MyMarketListing,
  submitMarketAppeal,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';
import { ChoiceSheet, EmptyState, FormSheet, PressableScale } from '../components/ui';
import { askConfirm } from '../store/confirmStore';
import { showToast } from '../store/toastStore';
import { colors, font, radius, shadow, space } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected' | 'unknown';

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Все',
  approved: 'Активные',
  pending: 'Проверка',
  rejected: 'Отклонено',
  unknown: 'Без статуса',
};

const STATUS_STYLE: Record<Exclude<StatusFilter, 'all'>, { color: string; bg: string }> = {
  approved: { color: colors.success, bg: 'rgba(61,214,140,0.15)' },
  pending: { color: colors.warning, bg: 'rgba(246,178,61,0.15)' },
  rejected: { color: colors.danger, bg: 'rgba(255,90,95,0.14)' },
  unknown: { color: colors.textMuted, bg: colors.surfaceAlt },
};

const pluralYears = (n: number) => {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return 'лет';
  if (d > 1 && d < 5) return 'года';
  if (d === 1) return 'год';
  return 'лет';
};

const getStatus = (item: MyMarketListing): Exclude<StatusFilter, 'all'> => {
  const value = String(item.listing.moderationStatus || '').toLowerCase();
  if (value === 'approved' || value === 'pending' || value === 'rejected') return value;
  return 'unknown';
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Подпись читается как обычная фраза: точки между словами превращали её в
// список служебных полей.
const getMeta = (item: MyMarketListing) => {
  const listing = item.listing;
  const location = listing.location || listing.region || 'Локация не указана';
  const details = [
    listing.brand,
    listing.model,
    listing.year,
    listing.category,
    listing.partCategory,
    listing.experience ? `${listing.experience} ${pluralYears(Number(listing.experience))} опыта` : '',
  ].filter(Boolean);
  return details.length ? `${details.slice(0, 2).join(' ')}, ${location}` : location;
};

export default function MyListingsScreen({ navigation }: Props) {
  const [items, setItems] = useState<MyMarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<'all' | MarketCategoryId>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [deletingKey, setDeletingKey] = useState('');
  const [appealItem, setAppealItem] = useState<MyMarketListing | null>(null);
  const [appealMessage, setAppealMessage] = useState('');
  const [appealingKey, setAppealingKey] = useState('');
  // Действия объявления живут в шторке: четыре кнопки в карточке спорили с
  // самим объявлением и не помещались на узком экране.
  const [actionsItem, setActionsItem] = useState<MyMarketListing | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await loadMyMarketListings();
      data.sort((a, b) => {
        const aTime = new Date(a.listing.createdAt || 0).getTime();
        const bTime = new Date(b.listing.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setItems(data);
      hasDataRef.current = true;
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить ваши объявления');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const hasDataRef = React.useRef(false);

  useFocusEffect(useCallback(() => {
    load(hasDataRef.current);
  }, [load]));

  const counts = useMemo(() => {
    const base = { approved: 0, pending: 0, rejected: 0, unknown: 0 };
    items.forEach((item) => {
      base[getStatus(item)] += 1;
    });
    return base;
  }, [items]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryId !== 'all' && item.categoryId !== categoryId) return false;
      const itemStatus = getStatus(item);
      if (status !== 'all' && itemStatus !== status) return false;
      if (!normalized) return true;
      const haystack = [
        getListingTitle(item.listing),
        getListingPrice(item.listing, item.categoryId),
        item.category.label,
        getMeta(item),
      ].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [categoryId, items, query, status]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openDetails = (item: MyMarketListing) => {
    navigation.navigate('MarketListingDetails', {
      listing: item.listing,
      categoryId: item.categoryId,
    });
  };

  const editListing = (item: MyMarketListing) => {
    navigation.navigate('EditMarketListing', {
      listing: item.listing,
      categoryId: item.categoryId,
    });
  };

  const removeListing = async (item: MyMarketListing) => {
    const title = getListingTitle(item.listing);
    const agreed = await askConfirm({
      title: 'Удалить объявление?',
      message: `${title} исчезнет из маркета. Это действие нельзя отменить.`,
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!agreed) return;

    setDeletingKey(item.key);
    try {
      await deleteMarketListing(item.categoryId, item.listing);
      setItems((prev) => prev.filter((listing) => listing.key !== item.key));
      showToast('Объявление удалено');
    } catch (e: any) {
      showToast(e.response?.data?.message || e.message || 'Не удалось удалить объявление', 'error');
    } finally {
      setDeletingKey('');
    }
  };

  const closeAppeal = () => {
    if (appealingKey) return;
    setAppealItem(null);
    setAppealMessage('');
  };

  const submitAppeal = async () => {
    if (!appealItem) return;
    const message = appealMessage.trim();
    if (message.length < 10) {
      showToast('Опишите причину апелляции минимум в 10 символов');
      return;
    }

    setAppealingKey(appealItem.key);
    try {
      const response = await submitMarketAppeal(appealItem.categoryId, appealItem.listing, message);
      setItems((prev) => prev.map((item) => (
        item.key === appealItem.key
          ? {
              ...item,
              listing: {
                ...item.listing,
                moderationStatus: 'pending',
                appealMessage: message,
                appealedAt: new Date().toISOString(),
              },
            }
          : item
      )));
      setAppealItem(null);
      setAppealMessage('');
      showToast(response.message || 'Апелляция отправлена администратору', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || e.message || 'Не удалось отправить апелляцию', 'error');
    } finally {
      setAppealingKey('');
    }
  };

  const runAction = (value: string) => {
    const item = actionsItem;
    if (!item) return;
    if (value === 'open') openDetails(item);
    else if (value === 'edit') editListing(item);
    else if (value === 'appeal') {
      setAppealItem(item);
      setAppealMessage(item.listing.appealMessage || '');
    } else if (value === 'delete') removeListing(item);
  };

  // Счётчики и есть фильтр по статусу: одни и те же числа не должны стоять
  // отдельно от отбора, который они описывают.
  const statusTabs: Array<{ key: StatusFilter; label: string; value: number; color?: string }> = [
    { key: 'all', label: 'Всего', value: items.length },
    { key: 'approved', label: 'Активные', value: counts.approved, color: colors.success },
    { key: 'pending', label: 'Проверка', value: counts.pending, color: colors.warning },
    { key: 'rejected', label: 'Отклонено', value: counts.rejected, color: colors.danger },
  ];

  const header = (
    <View style={styles.header}>
      <View style={styles.statsCard}>
        {statusTabs.map((tab, index) => (
          <React.Fragment key={tab.key}>
            {index ? <View style={styles.statDivider} /> : null}
            <TouchableOpacity
              style={[styles.stat, status === tab.key && styles.statActive]}
              onPress={() => setStatus(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.statValue, tab.color ? { color: tab.color } : null]}>{tab.value}</Text>
              <Text style={styles.statLabel}>{tab.label}</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по объявлениям"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Разделы отдельной лентой: статус и раздел — две разные оси отбора,
          в одной строке они путались. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, categoryId === 'all' && styles.filterBtnActive]}
          onPress={() => setCategoryId('all')}
        >
          <Text style={[styles.filterText, categoryId === 'all' && styles.filterTextActive]}>Все разделы</Text>
        </TouchableOpacity>
        {MARKET_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.filterBtn, categoryId === category.id && styles.filterBtnActive]}
            onPress={() => setCategoryId(category.id)}
          >
            <Text style={[styles.filterText, categoryId === category.id && styles.filterTextActive]}>
              {category.shortLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderItem = ({ item }: { item: MyMarketListing }) => {
    const itemStatus = getStatus(item);
    const statusStyle = STATUS_STYLE[itemStatus];
    const image = getListingImage(item.listing);
    const busy = deletingKey === item.key || appealingKey === item.key;

    return (
      <PressableScale style={styles.card} scaleTo={0.99} onPress={() => openDetails(item)}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Ionicons name={item.category.icon as any} size={26} color={colors.textFaint} />
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.cardPrice} numberOfLines={1}>{getListingPrice(item.listing, item.categoryId)}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>{getListingTitle(item.listing)}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>{getMeta(item)}</Text>

          <View style={styles.cardTags}>
            <Text style={[styles.statusPill, { color: statusStyle.color, backgroundColor: statusStyle.bg }]}>
              {STATUS_LABEL[itemStatus]}
            </Text>
            <Text style={styles.categoryPill}>{item.category.shortLabel}</Text>
            {item.listing.createdAt ? (
              <Text style={styles.cardDate}>{formatDate(item.listing.createdAt)}</Text>
            ) : null}
          </View>

          {itemStatus === 'rejected' && item.listing.moderationLastError ? (
            <Text style={styles.rejectText} numberOfLines={2}>{item.listing.moderationLastError}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setActionsItem(item)}
          hitSlop={8}
          disabled={busy}
        >
          {busy
            ? <ActivityIndicator size="small" color={colors.textMuted} />
            : <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />}
        </TouchableOpacity>
      </PressableScale>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const actionsStatus = actionsItem ? getStatus(actionsItem) : 'unknown';

  return (
    <>
      <FlatList
        style={styles.container}
        data={filtered}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={filtered.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <EmptyState
            icon={error ? 'alert-circle-outline' : 'albums-outline'}
            title={error || (items.length ? 'Ничего не найдено' : 'Объявлений пока нет')}
            subtitle={
              error
                ? 'Потяните экран вниз, чтобы повторить загрузку.'
                : items.length
                  ? 'Смягчите отбор: другой раздел или статус.'
                  : 'Создайте первое объявление в маркете, и оно появится здесь.'
            }
            actionLabel={error ? undefined : items.length ? 'Показать все' : 'Создать объявление'}
            onAction={() => {
              if (items.length) {
                setStatus('all');
                setCategoryId('all');
                setQuery('');
                return;
              }
              navigation.navigate('CreateMarketListing');
            }}
          />
        }
      />

      <ChoiceSheet
        visible={actionsItem !== null}
        title={actionsItem ? getListingTitle(actionsItem.listing) : ''}
        options={[
          { value: 'open', label: 'Открыть объявление', icon: 'open-outline' },
          { value: 'edit', label: 'Редактировать', icon: 'create-outline' },
          ...(actionsStatus === 'rejected'
            ? [{ value: 'appeal', label: 'Подать апелляцию', icon: 'chatbox-ellipses-outline' as const }]
            : []),
          { value: 'delete', label: 'Удалить', icon: 'trash-outline', danger: true },
        ]}
        onSelect={runAction}
        onClose={() => setActionsItem(null)}
      />

      <FormSheet
        visible={appealItem !== null}
        title="Апелляция"
        subtitle={appealItem?.listing.moderationLastError
          ? `Причина отказа: ${appealItem.listing.moderationLastError}`
          : 'Опишите, почему объявление стоит опубликовать'}
        onClose={closeAppeal}
      >
        <TextInput
          style={styles.appealInput}
          value={appealMessage}
          onChangeText={setAppealMessage}
          placeholder="Что именно проверить ещё раз"
          placeholderTextColor={colors.textFaint}
          multiline
          textAlignVertical="top"
        />
        <View style={styles.sheetActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={closeAppeal} disabled={!!appealingKey}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendBtn} onPress={submitAppeal} disabled={!!appealingKey}>
            {appealingKey
              ? <ActivityIndicator color={colors.onAccent} />
              : <Text style={styles.sendText}>Отправить</Text>}
          </TouchableOpacity>
        </View>
      </FormSheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: space.md, paddingBottom: space.xxl, gap: space.sm },
  emptyList: { flexGrow: 1, padding: space.md },

  header: { gap: space.md, marginBottom: space.md },
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.lg },
  statActive: { backgroundColor: colors.surfaceAlt },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: font.h2, fontWeight: '900' },
  statLabel: { marginTop: 3, color: colors.textMuted, fontSize: font.tiny, fontWeight: '800' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    height: 46, paddingHorizontal: space.md,
    borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '600' },

  filterRow: { gap: space.sm, paddingRight: space.md },
  filterBtn: {
    height: 36, paddingHorizontal: space.md, borderRadius: radius.pill,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '900' },
  filterTextActive: { color: colors.onAccent },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    padding: space.sm, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card,
  },
  cardImage: { width: 74, height: 74, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  cardImageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 1 },
  cardPrice: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  cardTitle: { color: colors.textMuted, fontSize: font.small, lineHeight: 17, fontWeight: '700' },
  cardMeta: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700' },
  cardTags: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  statusPill: {
    overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2,
    fontSize: 10, fontWeight: '900',
  },
  categoryPill: {
    overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2,
    backgroundColor: colors.surfaceAlt, color: colors.textMuted, fontSize: 10, fontWeight: '900',
  },
  cardDate: { marginLeft: 'auto', color: colors.textFaint, fontSize: 10, fontWeight: '800' },
  rejectText: { marginTop: 4, color: colors.danger, fontSize: font.tiny, lineHeight: 16, fontWeight: '700' },
  moreBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  appealInput: {
    minHeight: 110, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    padding: space.md, color: colors.text, fontSize: font.small, lineHeight: 20, marginBottom: space.sm,
  },
  sheetActions: { flexDirection: 'row', gap: space.sm },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  sendBtn: {
    flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
});
