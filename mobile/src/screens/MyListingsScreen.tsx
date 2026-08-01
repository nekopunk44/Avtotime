import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected' | 'unknown';

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Все',
  approved: 'Одобрено',
  pending: 'Проверка',
  rejected: 'Отклонено',
  unknown: 'Без статуса',
};

const STATUS_STYLE: Record<Exclude<StatusFilter, 'all'>, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  approved: { color: colors.success, bg: 'rgba(61,214,140,0.15)', icon: 'checkmark-circle-outline' },
  pending: { color: colors.warning, bg: 'rgba(246,178,61,0.15)', icon: 'time-outline' },
  rejected: { color: colors.danger, bg: 'rgba(255,90,95,0.14)', icon: 'alert-circle-outline' },
  unknown: { color: colors.textMuted, bg: colors.surfaceAlt, icon: 'help-circle-outline' },
};

const statusFilters: StatusFilter[] = ['all', 'approved', 'pending', 'rejected', 'unknown'];

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

const getMeta = (item: MyMarketListing) => {
  const listing = item.listing;
  const location = listing.location || listing.region || 'Локация не указана';
  const details = [
    listing.year,
    listing.brand,
    listing.model,
    listing.category,
    listing.partCategory,
    listing.experience ? `${listing.experience} лет опыта` : '',
  ].filter(Boolean);
  return details.length ? `${location} · ${details.slice(0, 2).join(' · ')}` : location;
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
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить ваши объявления');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
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

  const removeListing = (item: MyMarketListing) => {
    const title = getListingTitle(item.listing);
    Alert.alert(
      'Удалить объявление?',
      `${title} исчезнет из маркета. Это действие нельзя отменить.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setDeletingKey(item.key);
            try {
              await deleteMarketListing(item.categoryId, item.listing);
              setItems((prev) => prev.filter((listing) => listing.key !== item.key));
            } catch (e: any) {
              Alert.alert('Ошибка', e.response?.data?.message || e.message || 'Не удалось удалить объявление');
            } finally {
              setDeletingKey('');
            }
          },
        },
      ],
    );
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
      Alert.alert('Апелляция', 'Опишите причину апелляции минимум в 10 символов.');
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
      Alert.alert('Апелляция', response.message || 'Апелляция отправлена администратору.');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || e.message || 'Не удалось отправить апелляцию');
    } finally {
      setAppealingKey('');
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.hero}>
        <Text style={styles.title}>Мои объявления</Text>
        <Text style={styles.subtitle}>Все ваши публикации в маркете Avtotime</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>Всего</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.greenText]}>{counts.approved}</Text>
          <Text style={styles.statLabel}>Активные</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.amberText]}>{counts.pending}</Text>
          <Text style={styles.statLabel}>Проверка</Text>
        </View>
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
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, categoryId === 'all' && styles.filterBtnActive]}
          onPress={() => setCategoryId('all')}
        >
          <Text style={[styles.filterText, categoryId === 'all' && styles.filterTextActive]}>Все</Text>
        </TouchableOpacity>
        {MARKET_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.filterBtn, categoryId === category.id && styles.filterBtnActive]}
            onPress={() => setCategoryId(category.id)}
          >
            <Text style={[styles.filterText, categoryId === category.id && styles.filterTextActive]}>{category.shortLabel}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.filterDivider} />

        {statusFilters.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filterBtn, status === item && styles.filterBtnActive]}
            onPress={() => setStatus(item)}
          >
            <Text style={[styles.filterText, status === item && styles.filterTextActive]}>
              {STATUS_LABEL[item]}
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
    const deleting = deletingKey === item.key;

    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetails(item)} activeOpacity={0.9}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Ionicons name={item.category.icon as any} size={30} color={colors.textFaint} />
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.categoryPill}>{item.category.shortLabel}</Text>
            <Text style={[styles.statusPill, { color: statusStyle.color, backgroundColor: statusStyle.bg }]}>
              {STATUS_LABEL[itemStatus]}
            </Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{getListingTitle(item.listing)}</Text>
          <Text style={styles.cardPrice}>{getListingPrice(item.listing, item.categoryId)}</Text>
          <Text style={styles.cardMeta} numberOfLines={2}>{getMeta(item)}</Text>
          {item.listing.createdAt ? <Text style={styles.cardDate}>Создано: {formatDate(item.listing.createdAt)}</Text> : null}
          {itemStatus === 'rejected' && item.listing.moderationLastError ? (
            <Text style={styles.rejectText} numberOfLines={2}>{item.listing.moderationLastError}</Text>
          ) : null}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.openBtn} onPress={() => openDetails(item)} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={17} color="#fff" />
              <Text style={styles.openBtnText}>Открыть</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={() => editListing(item)} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={styles.editBtnText}>Ред.</Text>
            </TouchableOpacity>
            {itemStatus === 'rejected' ? (
              <TouchableOpacity
                style={styles.appealBtn}
                onPress={() => {
                  setAppealItem(item);
                  setAppealMessage(item.listing.appealMessage || '');
                }}
                activeOpacity={0.85}
                disabled={appealingKey === item.key}
              >
                {appealingKey === item.key ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.appealBtnText}>Апел.</Text>
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.deleteBtn} onPress={() => removeListing(item)} activeOpacity={0.85} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.container}
        data={filtered}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={filtered.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name={error ? 'alert-circle-outline' : 'albums-outline'} size={38} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>{error || 'Объявлений пока нет'}</Text>
            <Text style={styles.emptyText}>
              {error ? 'Потяните экран вниз, чтобы повторить загрузку.' : 'Создайте первое объявление в маркете, и оно появится здесь.'}
            </Text>
            {!error ? (
              <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateMarketListing')}>
                <Ionicons name="add" size={18} color={colors.onAccent} />
                <Text style={styles.createBtnText}>Создать объявление</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      <Modal visible={!!appealItem} transparent animationType="slide" onRequestClose={closeAppeal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeAppeal} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Апелляция</Text>
            <Text style={styles.sheetSubtitle}>
              Опишите, почему объявление стоит пересмотреть. Администратор увидит это сообщение.
            </Text>
            <TextInput
              style={styles.appealInput}
              value={appealMessage}
              onChangeText={(value) => setAppealMessage(value.slice(0, 500))}
              placeholder="Например: я исправил описание и фото соответствуют правилам"
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.counterText}>{appealMessage.length}/500</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeAppeal} disabled={!!appealingKey}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitAppealBtn} onPress={submitAppeal} disabled={!!appealingKey}>
                {appealingKey ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.submitAppealText}>Отправить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: 12, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 12, marginBottom: 2 },
  hero: { paddingTop: 6, paddingBottom: 2, alignItems: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 4, color: colors.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 14, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  statValue: { color: colors.text, fontSize: 23, fontWeight: '900' },
  greenText: { color: colors.success },
  amberText: { color: colors.warning },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  searchBox: { height: 44, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  filterRow: { gap: 8, paddingVertical: 2, alignItems: 'center' },
  filterBtn: { height: 36, borderRadius: 999, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, justifyContent: 'center' },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: colors.onAccent },
  filterDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: colors.border, marginHorizontal: 2 },
  card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  cardImage: { width: '100%', height: 170, backgroundColor: colors.surfaceAlt },
  cardImageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  cardTitle: { marginTop: 11, color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  cardPrice: { marginTop: 7, color: colors.text, fontSize: 17, fontWeight: '900' },
  cardMeta: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  cardDate: { marginTop: 6, color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  rejectText: { marginTop: 8, color: colors.danger, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  openBtn: { flex: 1, height: 42, borderRadius: 8, backgroundColor: colors.surfaceHi, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  openBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  editBtn: { width: 62, height: 42, borderRadius: 8, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  editBtnText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  appealBtn: { width: 62, height: 42, borderRadius: 12, backgroundColor: 'rgba(246,178,61,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(246,178,61,0.3)', alignItems: 'center', justifyContent: 'center' },
  appealBtnText: { color: colors.warning, fontSize: 12, fontWeight: '900' },
  deleteBtn: { width: 42, height: 42, borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  createBtn: { marginTop: 16, height: 44, borderRadius: 8, paddingHorizontal: 16, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  createBtnText: { color: colors.onAccent, fontSize: 14, fontWeight: '900' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHi, marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  sheetSubtitle: { marginTop: 5, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  appealInput: { minHeight: 122, marginTop: 14, borderRadius: 8, backgroundColor: colors.surfaceAlt, padding: 12, color: colors.text, fontSize: 15, lineHeight: 21 },
  counterText: { marginTop: 6, color: colors.textFaint, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  submitAppealBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  submitAppealText: { color: colors.onAccent, fontSize: 15, fontWeight: '900' },
});
