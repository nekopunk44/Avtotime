import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'Favorites'> };

const FILTERS: Array<{ label: string; type?: FavoriteListingType }> = [
  { label: 'Все' },
  { label: 'Авто', type: 'car' },
  { label: 'Запчасти', type: 'part' },
  { label: 'Сервисы', type: 'car-service' },
  { label: 'Тюнинг', type: 'auto-tuning' },
  { label: 'Эксперты', type: 'consultation' },
  { label: 'Чистка', type: 'dry-cleaning' },
];

export default function FavoritesScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<FavoriteListingType | undefined>();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [error, setError] = useState('');

  const activeCategory = useMemo(
    () => filter ? getMarketCategory(getCategoryIdFromFavoriteType(filter)) : null,
    [filter],
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getFavorites(filter);
      setItems(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить избранное');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    load();
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

  const deleteItem = async (item: FavoriteItem) => {
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

  const renderItem = ({ item }: { item: FavoriteItem }) => {
    const category = getMarketCategory(getCategoryIdFromFavoriteType(item.listingType));
    const removing = removingId === item._id;

    return (
      <TouchableOpacity style={styles.card} onPress={() => openItem(item)} activeOpacity={0.9}>
        {item.listingImage ? (
          <Image source={{ uri: item.listingImage }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.noImage]}>
            <Ionicons name={category.icon as any} size={24} color="#999" />
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.categoryRow}>
            <Ionicons name={category.icon as any} size={14} color="#666" />
            <Text style={styles.categoryText}>{category.shortLabel}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{item.listingTitle || 'Объявление'}</Text>
          <Text style={styles.price} numberOfLines={1}>{item.listingPrice || 'Цена по запросу'}</Text>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => deleteItem(item)}
          disabled={removing}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          {removing ? (
            <ActivityIndicator size="small" color="#111" />
          ) : (
            <Ionicons name="bookmark" size={22} color="#111" />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Избранное</Text>
        <Text style={styles.subtitle}>Сохранённые объявления маркета</Text>
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={items.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={36} color="#bbb" />
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
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  heading: { color: '#111', fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#666', fontSize: 13 },
  filters: { gap: 8, paddingTop: 14, paddingBottom: 2 },
  filterBtn: { height: 36, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#e6e6e6' },
  filterBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  filterText: { color: '#555', fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ececec' },
  image: { width: 84, height: 84, borderRadius: 8, backgroundColor: '#eee' },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  categoryText: { color: '#666', fontSize: 12, fontWeight: '800' },
  title: { color: '#111', fontSize: 15, fontWeight: '900', lineHeight: 20 },
  price: { marginTop: 6, color: '#111', fontSize: 15, fontWeight: '900' },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: '#111', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: '#777', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
