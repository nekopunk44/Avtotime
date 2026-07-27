import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
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
import { colors, font, radius, shadow, space } from '../theme';
import { Card, EmptyState, PressableScale, Skeleton } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

export default function MarketScreen({ navigation }: Props) {
  const [categoryId, setCategoryId] = useState<MarketCategoryId>('cars');
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
      const data = await loadMarketListings(categoryId, { q: query, limit: 40 });
      setListings(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить объявления');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId, query]);

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

  const renderCategory = ({ item }: { item: MarketCategory }) => {
    const active = item.id === categoryId;
    return (
      <PressableScale
        style={[styles.catChip, active && styles.catChipActive]}
        onPress={() => setCategoryId(item.id)}
      >
        <Ionicons name={item.icon as any} size={16} color={active ? colors.white : colors.text} />
        <Text style={[styles.catText, active && styles.catTextActive]}>{item.shortLabel}</Text>
      </PressableScale>
    );
  };

  const renderListing = ({ item }: { item: MarketListing }) => {
    const image = getListingImage(item);
    return (
      <PressableScale
        style={styles.cell}
        scaleTo={0.98}
        onPress={() => navigation.navigate('MarketListingDetails', { listing: item, categoryId })}
      >
        <Card style={styles.card}>
          {image ? (
            <Image source={{ uri: image }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.noImage]}>
              <Ionicons name={activeCategory.icon as any} size={28} color={colors.textFaint} />
            </View>
          )}
          {item.sellerBadge ? <Text style={styles.badge}>{item.sellerBadge}</Text> : null}
          <View style={styles.cardBody}>
            <Text style={styles.price}>{getListingPrice(item, categoryId)}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>{getListingTitle(item)}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={colors.textFaint} />
              <Text style={styles.metaText} numberOfLines={1}>{item.location || item.region || 'Не указано'}</Text>
            </View>
          </View>
        </Card>
      </PressableScale>
    );
  };

  const Header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Маркет</Text>
        <View style={styles.headerActions}>
          <PressableScale style={styles.iconBtn} onPress={() => navigation.navigate('MarketServices')}>
            <Ionicons name="apps-outline" size={21} color={colors.text} />
          </PressableScale>
          <PressableScale style={styles.addBtn} onPress={() => navigation.navigate('CreateMarketListing')}>
            <Ionicons name="add" size={24} color={colors.onAccent} />
          </PressableScale>
        </View>
      </View>

      <PressableScale style={styles.searchBox} scaleTo={1} onPress={() => navigation.navigate('MarketSearch')}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Поиск: ${activeCategory.label.toLowerCase()}`}
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <Ionicons name="options-outline" size={18} color={colors.text} />
      </PressableScale>

      <FlatList
        data={MARKET_CATEGORIES}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={renderCategory}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catList}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.cell}>
              <Skeleton style={styles.skeletonCard} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={listings}
      numColumns={2}
      keyExtractor={(item, index) => `${categoryId}-${item._id || item.id || index}`}
      renderItem={renderListing}
      ListHeaderComponent={Header}
      columnWrapperStyle={styles.grid}
      contentContainerStyle={listings.length ? styles.listContent : styles.emptyContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        <EmptyState
          icon={error ? 'alert-circle-outline' : (activeCategory.icon as any)}
          title={error || 'Объявлений пока нет'}
          subtitle={error ? 'Потяните вниз, чтобы повторить.' : 'Здесь появятся предложения этого раздела.'}
          actionLabel={error ? undefined : 'Разместить объявление'}
          onAction={error ? undefined : () => navigation.navigate('CreateMarketListing')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.md, paddingTop: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: font.display, fontWeight: '900', color: colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.card },

  searchBox: {
    height: 46, marginTop: space.md, borderRadius: radius.md, backgroundColor: colors.surface,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, ...shadow.card,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: font.body },

  catList: { gap: 8, paddingVertical: space.md },
  catChip: {
    height: 40, borderRadius: radius.pill, paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', gap: 6, backgroundColor: colors.surface, ...shadow.card,
  },
  catChipActive: { backgroundColor: colors.ink },
  catText: { fontSize: font.small, fontWeight: '800', color: colors.text },
  catTextActive: { color: colors.white },

  grid: { paddingHorizontal: space.md - 3, justifyContent: 'space-between' },
  listContent: { paddingBottom: space.lg },
  emptyContent: { flexGrow: 1 },
  cell: { width: '50%', paddingHorizontal: 3, marginBottom: space.md },
  card: { padding: 0, overflow: 'hidden' },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.ink, color: colors.white, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', overflow: 'hidden' },
  cardBody: { padding: space.md },
  price: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  cardTitle: { marginTop: 4, color: colors.textMuted, fontSize: font.small, fontWeight: '600', lineHeight: 18, minHeight: 36 },
  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { flex: 1, color: colors.textFaint, fontSize: font.tiny, fontWeight: '600' },

  skeletonCard: { width: '100%', height: 240, borderRadius: radius.lg },
});
