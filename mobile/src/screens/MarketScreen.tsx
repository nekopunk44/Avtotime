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
import { useFocusEffect } from '@react-navigation/native';
import {
  getListingImage,
  getListingPrice,
  getListingTitle,
  loadMarketListings,
  MARKET_CATEGORIES,
  MarketCategory,
  MarketCategoryId,
  MarketListing,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

export default function MarketScreen({ navigation }: Props) {
  const [categoryId, setCategoryId] = useState<MarketCategoryId>('cars');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const activeCategory = useMemo(
    () => MARKET_CATEGORIES.find((item) => item.id === categoryId) ?? MARKET_CATEGORIES[0],
    [categoryId],
  );

  const loadListings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await loadMarketListings(categoryId, {
        mine: scope === 'mine',
        q: query,
        limit: scope === 'mine' ? 120 : 40,
      });
      setListings(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить объявления');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId, query, scope]);

  useEffect(() => {
    const id = setTimeout(() => loadListings(), query.trim() ? 350 : 0);
    return () => clearTimeout(id);
  }, [loadListings, query]);

  useFocusEffect(useCallback(() => {
    loadListings(true);
  }, [loadListings]));

  const refresh = () => {
    setRefreshing(true);
    loadListings(true);
  };

  const openListing = (listing: MarketListing) => {
    navigation.navigate('MarketListingDetails', { listing, categoryId });
  };

  const renderCategory = ({ item }: { item: MarketCategory }) => {
    const active = item.id === categoryId;
    return (
      <TouchableOpacity
        style={[styles.categoryBtn, active && styles.categoryBtnActive]}
        onPress={() => setCategoryId(item.id)}
        activeOpacity={0.85}
      >
        <Ionicons
          name={item.icon as any}
          size={18}
          color={active ? '#fff' : '#111'}
        />
        <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.shortLabel}</Text>
      </TouchableOpacity>
    );
  };

  const renderListing = ({ item }: { item: MarketListing }) => (
    <TouchableOpacity style={styles.card} onPress={() => openListing(item)} activeOpacity={0.9}>
      {getListingImage(item) ? (
        <Image source={{ uri: getListingImage(item) }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.noImage]}>
          <Ionicons name={activeCategory.icon as any} size={28} color="#aaa" />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>{getListingTitle(item)}</Text>
          {item.sellerBadge ? (
            <Text style={styles.badge}>{item.sellerBadge}</Text>
          ) : null}
        </View>
        <Text style={styles.price}>{getListingPrice(item, categoryId)}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color="#777" />
          <Text style={styles.metaText} numberOfLines={1}>{item.location || item.region || 'Локация не указана'}</Text>
        </View>
        <View style={styles.specRow}>
          {item.year ? <Text style={styles.spec}>{item.year}</Text> : null}
          {item.mileage ? <Text style={styles.spec}>{item.mileage}</Text> : null}
          {item.category ? <Text style={styles.spec}>{item.category}</Text> : null}
          {item.rating ? <Text style={styles.spec}>★ {item.rating}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Маркет</Text>
            <Text style={styles.subtitle}>Авто, услуги, эксперты и объявления Avtotime</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('CreateMarketListing')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.myListingsBtn}
            onPress={() => navigation.navigate('MarketTabs', { screen: 'MyListings' })}
            activeOpacity={0.85}
          >
            <Ionicons name="albums-outline" size={22} color="#111" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActions}
        >
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('MarketSearch')}
            activeOpacity={0.85}
          >
            <Ionicons name="options-outline" size={18} color="#111" />
            <Text style={styles.quickActionText}>Поиск</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('MarketTabs', { screen: 'Favorites' })}
            activeOpacity={0.85}
          >
            <Ionicons name="bookmark-outline" size={18} color="#111" />
            <Text style={styles.quickActionText}>Избранное</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Compare')}
            activeOpacity={0.85}
          >
            <Ionicons name="git-compare-outline" size={18} color="#111" />
            <Text style={styles.quickActionText}>Сравнение</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('MarketAnalytics')}
            activeOpacity={0.85}
          >
            <Ionicons name="bar-chart-outline" size={18} color="#111" />
            <Text style={styles.quickActionText}>Аналитика</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionCar]}
            onPress={() => navigation.navigate('CarRequest')}
            activeOpacity={0.85}
          >
            <Ionicons name="car-sport-outline" size={18} color="#fff" />
            <Text style={[styles.quickActionText, styles.quickActionTextLight]}>Подбор</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionHelp]}
            onPress={() => navigation.navigate('HelpRequests')}
            activeOpacity={0.85}
          >
            <Ionicons name="heart-outline" size={18} color="#fff" />
            <Text style={[styles.quickActionText, styles.quickActionTextLight]}>Помощь</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionEco]}
            onPress={() => navigation.navigate('EcoTips')}
            activeOpacity={0.85}
          >
            <Ionicons name="leaf-outline" size={18} color="#fff" />
            <Text style={[styles.quickActionText, styles.quickActionTextLight]}>Эко</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionKids]}
            onPress={() => navigation.navigate('KidsGames')}
            activeOpacity={0.85}
          >
            <Ionicons name="game-controller-outline" size={18} color="#fff" />
            <Text style={[styles.quickActionText, styles.quickActionTextLight]}>Детям</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionBilling]}
            onPress={() => navigation.navigate('Billing')}
            activeOpacity={0.85}
          >
            <Ionicons name="card-outline" size={18} color="#111" />
            <Text style={styles.quickActionText}>Тарифы</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#777" />
          <TextInput
            style={styles.searchInput}
            placeholder={`Поиск: ${activeCategory.label.toLowerCase()}`}
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

        <FlatList
          data={MARKET_CATEGORIES}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={renderCategory}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        />

        <View style={styles.scopeRow}>
          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'all' && styles.scopeBtnActive]}
            onPress={() => setScope('all')}
          >
            <Text style={[styles.scopeText, scope === 'all' && styles.scopeTextActive]}>Все</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'mine' && styles.scopeBtnActive]}
            onPress={() => setScope('mine')}
          >
            <Text style={[styles.scopeText, scope === 'mine' && styles.scopeTextActive]}>Мои</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111" />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item, index) => `${categoryId}-${item._id || item.id || index}`}
          renderItem={renderListing}
          contentContainerStyle={listings.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={error ? 'alert-circle-outline' : activeCategory.icon as any} size={34} color="#bbb" />
              <Text style={styles.emptyTitle}>{error || 'Объявлений пока нет'}</Text>
              <Text style={styles.emptyText}>
                {error ? 'Потяните экран вниз, чтобы повторить загрузку.' : 'Здесь появятся актуальные предложения этого раздела.'}
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
  top: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#111' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#666' },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  myListingsBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#e2e2e2', alignItems: 'center', justifyContent: 'center' },
  quickActions: { gap: 8, marginTop: 14, paddingRight: 2 },
  quickAction: { width: 116, height: 38, borderRadius: 10, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#e3e3e3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  quickActionCar: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  quickActionHelp: { backgroundColor: '#d92323', borderColor: '#d92323' },
  quickActionEco: { backgroundColor: '#14843b', borderColor: '#14843b' },
  quickActionKids: { backgroundColor: '#111', borderColor: '#111' },
  quickActionBilling: { backgroundColor: '#fff', borderColor: '#dedede' },
  quickActionText: { color: '#111', fontSize: 11, fontWeight: '900' },
  quickActionTextLight: { color: '#fff' },
  searchBox: {
    height: 44, marginTop: 14, borderRadius: 12, backgroundColor: '#f2f2f2',
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: '#111', fontSize: 15 },
  categoryList: { gap: 8, paddingTop: 12, paddingBottom: 10 },
  categoryBtn: {
    height: 38, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row',
    alignItems: 'center', gap: 6, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#e5e5e5',
  },
  categoryBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  categoryText: { fontSize: 13, fontWeight: '700', color: '#111' },
  categoryTextActive: { color: '#fff' },
  scopeRow: { flexDirection: 'row', backgroundColor: '#f3f3f3', borderRadius: 12, padding: 3 },
  scopeBtn: { flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scopeBtnActive: { backgroundColor: '#111' },
  scopeText: { color: '#777', fontWeight: '700', fontSize: 13 },
  scopeTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: '#ececec',
  },
  cardImage: { width: '100%', height: 190, backgroundColor: '#eee' },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 12 },
  cardTitleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  cardTitle: { flex: 1, color: '#111', fontSize: 16, fontWeight: '800', lineHeight: 21 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: '#111', color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  price: { marginTop: 8, color: '#111', fontSize: 18, fontWeight: '800' },
  metaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { flex: 1, color: '#777', fontSize: 13 },
  specRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spec: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#f3f3f3', color: '#555', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: '#111', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: 6, color: '#777', fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
