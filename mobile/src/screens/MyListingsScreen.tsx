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

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'MyListings'> };

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected' | 'unknown';

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Все',
  approved: 'Одобрено',
  pending: 'Проверка',
  rejected: 'Отклонено',
  unknown: 'Без статуса',
};

const STATUS_STYLE: Record<Exclude<StatusFilter, 'all'>, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  approved: { color: '#14843b', bg: '#eaf8ef', icon: 'checkmark-circle-outline' },
  pending: { color: '#9a5a00', bg: '#fff6df', icon: 'time-outline' },
  rejected: { color: '#d92323', bg: '#fff0f0', icon: 'alert-circle-outline' },
  unknown: { color: '#555', bg: '#f0f0f0', icon: 'help-circle-outline' },
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
        <View style={styles.heroIcon}>
          <Ionicons name="albums-outline" size={27} color="#111" />
        </View>
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
        <Ionicons name="search-outline" size={18} color="#777" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по объявлениям"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#999" />
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
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {statusFilters.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.statusFilterBtn, status === item && styles.statusFilterBtnActive]}
            onPress={() => setStatus(item)}
          >
            <Text style={[styles.statusFilterText, status === item && styles.statusFilterTextActive]}>
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
            <Ionicons name={item.category.icon as any} size={30} color="#aaa" />
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
              <Ionicons name="create-outline" size={18} color="#111" />
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
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={styles.appealBtnText}>Апел.</Text>
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.deleteBtn} onPress={() => removeListing(item)} activeOpacity={0.85} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color="#d92323" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#d92323" />
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
        <ActivityIndicator size="large" color="#111" />
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
            <Ionicons name={error ? 'alert-circle-outline' : 'albums-outline'} size={38} color="#bbb" />
            <Text style={styles.emptyTitle}>{error || 'Объявлений пока нет'}</Text>
            <Text style={styles.emptyText}>
              {error ? 'Потяните экран вниз, чтобы повторить загрузку.' : 'Создайте первое объявление в маркете, и оно появится здесь.'}
            </Text>
            {!error ? (
              <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateMarketListing')}>
                <Ionicons name="add" size={18} color="#fff" />
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
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.counterText}>{appealMessage.length}/500</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeAppeal} disabled={!!appealingKey}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitAppealBtn} onPress={submitAppeal} disabled={!!appealingKey}>
                {appealingKey ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitAppealText}>Отправить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f5f7' },
  list: { padding: 12, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1, padding: 12, paddingBottom: 28 },
  header: { gap: 10, marginBottom: 2 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: '#111', fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#666', fontSize: 14, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', padding: 12 },
  statValue: { color: '#111', fontSize: 23, fontWeight: '900' },
  greenText: { color: '#14843b' },
  amberText: { color: '#9a5a00' },
  statLabel: { marginTop: 2, color: '#666', fontSize: 12, fontWeight: '800' },
  searchBox: { height: 44, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: '#111', fontSize: 15 },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterBtn: { height: 36, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  filterText: { color: '#555', fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: '#fff' },
  statusFilterBtn: { height: 34, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5', justifyContent: 'center' },
  statusFilterBtnActive: { backgroundColor: '#d92323', borderColor: '#d92323' },
  statusFilterText: { color: '#555', fontSize: 12, fontWeight: '900' },
  statusFilterTextActive: { color: '#fff' },
  card: { borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', overflow: 'hidden' },
  cardImage: { width: '100%', height: 170, backgroundColor: '#eee' },
  cardImageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#f2f2f2', color: '#111', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  cardTitle: { marginTop: 11, color: '#111', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  cardPrice: { marginTop: 7, color: '#111', fontSize: 17, fontWeight: '900' },
  cardMeta: { marginTop: 6, color: '#666', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  cardDate: { marginTop: 6, color: '#999', fontSize: 12, fontWeight: '700' },
  rejectText: { marginTop: 8, color: '#d92323', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  openBtn: { flex: 1, height: 42, borderRadius: 8, backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  openBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  editBtn: { width: 62, height: 42, borderRadius: 8, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#e5e5e5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  editBtnText: { color: '#111', fontSize: 12, fontWeight: '900' },
  appealBtn: { width: 62, height: 42, borderRadius: 8, backgroundColor: '#fff6df', borderWidth: 1, borderColor: '#f3d58b', alignItems: 'center', justifyContent: 'center' },
  appealBtnText: { color: '#7c4a00', fontSize: 12, fontWeight: '900' },
  deleteBtn: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, color: '#111', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: '#777', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  createBtn: { marginTop: 16, height: 44, borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 12 },
  sheetTitle: { color: '#111', fontSize: 20, fontWeight: '900' },
  sheetSubtitle: { marginTop: 5, color: '#666', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  appealInput: { minHeight: 122, marginTop: 14, borderRadius: 8, backgroundColor: '#f3f3f3', padding: 12, color: '#111', fontSize: 15, lineHeight: 21 },
  counterText: { marginTop: 6, color: '#999', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#111', fontSize: 15, fontWeight: '900' },
  submitAppealBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  submitAppealText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
