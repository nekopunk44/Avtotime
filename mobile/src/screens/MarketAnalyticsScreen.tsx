import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getMarketAnalyticsSummary,
  MarketAnalyticsListing,
  MarketAnalyticsPoint,
  MarketAnalyticsSummary,
} from '../api/marketAnalytics';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'MarketAnalytics'> };

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro Seller',
  business: 'Business',
};

const KIND_LABEL: Record<MarketAnalyticsListing['kind'], string> = {
  cars: 'Авто',
  parts: 'Запчасти',
};

const shortDay = (raw: string) => {
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

function MetricTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'red' | 'green' | 'black';
}) {
  const color = tone === 'red' ? '#d92323' : tone === 'green' ? '#14843b' : '#111';

  return (
    <View style={styles.metricTile}>
      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Bars({ data }: { data: MarketAnalyticsPoint[] }) {
  const max = Math.max(1, ...data.map((point) => Math.max(point.views, point.leads)));

  return (
    <View style={styles.barsWrap}>
      {data.map((point) => (
        <View key={point.day} style={styles.barColumn}>
          <View style={styles.barTrack}>
            <View style={styles.barPair}>
              <View style={[styles.bar, styles.viewsBar, { height: `${Math.max(2, (point.views / max) * 100)}%` }]} />
              <View style={[styles.bar, styles.leadsBar, { height: `${Math.max(2, (point.leads / max) * 100)}%` }]} />
            </View>
          </View>
          <Text style={styles.barLabel}>{shortDay(point.day)}</Text>
        </View>
      ))}
    </View>
  );
}

function ListingRow({ item }: { item: MarketAnalyticsListing }) {
  return (
    <View style={styles.listingRow}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.listingImage} />
      ) : (
        <View style={[styles.listingImage, styles.listingImageFallback]}>
          <Ionicons name={item.kind === 'cars' ? 'car-sport-outline' : 'construct-outline'} size={22} color="#888" />
        </View>
      )}
      <View style={styles.listingBody}>
        <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.listingKind}>{KIND_LABEL[item.kind]}</Text>
      </View>
      <View style={styles.listingStats}>
        <Text style={styles.listingStatRed}>{item.viewsTotal} просмотров</Text>
        <Text style={styles.listingStatGreen}>{item.leadsTotal} контактов</Text>
      </View>
    </View>
  );
}

export default function MarketAnalyticsScreen({ navigation }: Props) {
  const [data, setData] = useState<MarketAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');

  const sortedListings = useMemo(
    () => [...(data?.listings || [])].sort((a, b) => b.viewsTotal - a.viewsTotal),
    [data?.listings],
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    setErrorCode('');
    try {
      const summary = await getMarketAnalyticsSummary();
      setData(summary);
    } catch (e: any) {
      setData(null);
      setError(e.response?.data?.message || 'Не удалось загрузить аналитику');
      setErrorCode(e.response?.data?.code || '');
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
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
          <Ionicons name="bar-chart-outline" size={26} color="#d92323" />
        </View>
        <Text style={styles.title}>Аналитика</Text>
        <Text style={styles.subtitle}>Просмотры и контакты по объявлениям за последние 7 дней</Text>
      </View>

      {error ? (
        <View style={styles.accessCard}>
          <Ionicons name={errorCode === 'ANALYTICS_DISABLED' ? 'sparkles-outline' : 'alert-circle-outline'} size={34} color="#d92323" />
          <Text style={styles.accessTitle}>{error}</Text>
          {errorCode === 'ANALYTICS_DISABLED' ? (
            <>
              <Text style={styles.accessText}>
                Подробная статистика доступна на тарифах Pro Seller и Business.
              </Text>
              <TouchableOpacity
                style={styles.tariffsBtn}
                onPress={() => navigation.navigate('Billing')}
                activeOpacity={0.85}
              >
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={styles.tariffsBtnText}>Открыть тарифы</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.accessText}>Потяните экран вниз, чтобы попробовать снова.</Text>
          )}
        </View>
      ) : data ? (
        <>
          <View style={styles.planCard}>
            <View>
              <Text style={styles.planLabel}>Тариф</Text>
              <Text style={styles.planValue}>{PLAN_LABEL[data.effectivePlan] || data.effectivePlan}</Text>
            </View>
            <Ionicons name={data.effectivePlan === 'business' ? 'diamond-outline' : 'sparkles-outline'} size={28} color="#fff" />
          </View>

          <View style={styles.metricsGrid}>
            <MetricTile label="Все просмотры" value={data.totals.viewsTotal} icon="eye-outline" tone="red" />
            <MetricTile label="Все контакты" value={data.totals.leadsTotal} icon="chatbubble-ellipses-outline" tone="green" />
            <MetricTile label="7 дней просмотры" value={data.totals.last7DaysViews} icon="trending-up-outline" tone="red" />
            <MetricTile label="7 дней контакты" value={data.totals.last7DaysLeads} icon="send-outline" tone="green" />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Активность</Text>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.viewsDot]} />
                  <Text style={styles.legendText}>Просмотры</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.leadsDot]} />
                  <Text style={styles.legendText}>Контакты</Text>
                </View>
              </View>
            </View>
            <Bars data={data.dailyTotals} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ваши объявления</Text>
            {sortedListings.length ? (
              <View style={styles.listings}>
                {sortedListings.map((item) => (
                  <ListingRow key={`${item.kind}-${item._id}`} item={item} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="albums-outline" size={30} color="#bbb" />
                <Text style={styles.emptyTitle}>Пока нет объявлений для аналитики</Text>
                <Text style={styles.emptyText}>Статистика собирается для разделов авто и запчастей.</Text>
              </View>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  content: { padding: 16, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f5f7' },
  hero: { alignItems: 'center', paddingVertical: 20 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: '#111', fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 6, color: '#666', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  accessCard: { marginTop: 18, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', padding: 18, alignItems: 'center' },
  accessTitle: { marginTop: 12, color: '#111', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  accessText: { marginTop: 8, color: '#666', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  tariffsBtn: { marginTop: 14, height: 42, borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tariffsBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  planCard: { marginTop: 8, borderRadius: 8, backgroundColor: '#111', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  planValue: { marginTop: 4, color: '#fff', fontSize: 22, fontWeight: '900' },
  metricsGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricTile: { width: '48%', minHeight: 96, borderRadius: 8, backgroundColor: '#fff', padding: 12, borderWidth: 1, borderColor: '#eee' },
  metricTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  metricLabel: { flex: 1, color: '#666', fontSize: 11, lineHeight: 15, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { marginTop: 12, color: '#111', fontSize: 28, fontWeight: '900' },
  section: { marginTop: 12, borderRadius: 8, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#eee' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#111', fontSize: 18, fontWeight: '900' },
  legend: { gap: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  viewsDot: { backgroundColor: '#d92323' },
  leadsDot: { backgroundColor: '#14843b' },
  legendText: { color: '#666', fontSize: 11, fontWeight: '800' },
  barsWrap: { height: 152, flexDirection: 'row', alignItems: 'flex-end', gap: 7, paddingTop: 8 },
  barColumn: { flex: 1, height: '100%', alignItems: 'center' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barPair: { height: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { flex: 1, minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  viewsBar: { backgroundColor: '#d92323' },
  leadsBar: { backgroundColor: '#14843b' },
  barLabel: { marginTop: 6, color: '#777', fontSize: 10, fontWeight: '800' },
  listings: { marginTop: 8 },
  listingRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  listingImage: { width: 54, height: 54, borderRadius: 8, backgroundColor: '#eee' },
  listingImageFallback: { alignItems: 'center', justifyContent: 'center' },
  listingBody: { flex: 1 },
  listingTitle: { color: '#111', fontSize: 14, fontWeight: '900' },
  listingKind: { marginTop: 4, color: '#777', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  listingStats: { alignItems: 'flex-end' },
  listingStatRed: { color: '#d92323', fontSize: 12, fontWeight: '900' },
  listingStatGreen: { marginTop: 3, color: '#14843b', fontSize: 12, fontWeight: '900' },
  emptyBox: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { marginTop: 8, color: '#111', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: '#777', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
