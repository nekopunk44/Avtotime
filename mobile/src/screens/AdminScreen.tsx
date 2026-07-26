import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  AdminRange,
  AdminStats,
  AdminUser,
  approveMarketListing,
  banUser,
  getAdminStats,
  getAdminStatus,
  getAdminUsers,
  getAppealedMarketListings,
  getPendingMarketListings,
  grantAdmin,
  rejectMarketListing,
  revokeAdmin,
  unbanUser,
} from '../api/admin';
import {
  getListingPrice,
  getListingTitle,
  MARKET_CATEGORIES,
  MarketCategoryId,
  MarketListing,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type TabId = 'overview' | 'moderation' | 'users';
type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'Admin'> };

const TABS: Array<{ id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'overview', label: 'Обзор', icon: 'analytics-outline' },
  { id: 'moderation', label: 'Модерация', icon: 'shield-checkmark-outline' },
  { id: 'users', label: 'Люди', icon: 'people-outline' },
];

const RANGES: Array<{ id: AdminRange; label: string }> = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'half-year', label: 'Полгода' },
  { id: 'year', label: 'Год' },
];

const formatDate = (value?: string | null) => {
  if (!value) return 'нет даты';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'нет даты';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getListingId = (item: MarketListing) => item._id || (item.id != null ? String(item.id) : '');

export default function AdminScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [statsRange, setStatsRange] = useState<AdminRange>('week');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MarketCategoryId>('cars');
  const [showAppeals, setShowAppeals] = useState(false);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');

  const activeCategory = useMemo(
    () => MARKET_CATEGORIES.find((item) => item.id === selectedCategory) ?? MARKET_CATEGORIES[0],
    [selectedCategory],
  );

  const loadModeration = useCallback(async () => {
    setModerationLoading(true);
    try {
      const data = showAppeals
        ? await getAppealedMarketListings(selectedCategory)
        : await getPendingMarketListings(selectedCategory);
      setListings(data);
    } catch (e: any) {
      Alert.alert('Модерация', e.response?.data?.message || 'Не удалось загрузить объявления');
      setListings([]);
    } finally {
      setModerationLoading(false);
    }
  }, [selectedCategory, showAppeals]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const page = await getAdminUsers(userSearch, 1, 30);
      setUsers(page.users);
      setUsersTotal(page.total);
    } catch (e: any) {
      Alert.alert('Пользователи', e.response?.data?.message || 'Не удалось загрузить пользователей');
      setUsers([]);
      setUsersTotal(0);
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const status = await getAdminStatus();
      setIsAdmin(status.isAdmin);
      if (!status.isAdmin) {
        setStats(null);
        setListings([]);
        setUsers([]);
        return;
      }

      const [nextStats, nextListings, nextUsers] = await Promise.all([
        getAdminStats(statsRange),
        showAppeals ? getAppealedMarketListings(selectedCategory) : getPendingMarketListings(selectedCategory),
        getAdminUsers(userSearch, 1, 30),
      ]);
      setStats(nextStats);
      setListings(nextListings);
      setUsers(nextUsers.users);
      setUsersTotal(nextUsers.total);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить админ-раздел');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, showAppeals, statsRange, userSearch]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useEffect(() => {
    if (isAdmin && activeTab === 'moderation') {
      loadModeration();
    }
  }, [activeTab, isAdmin, loadModeration]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'users') return undefined;
    const id = setTimeout(() => {
      loadUsers();
    }, userSearch.trim() ? 350 : 0);
    return () => clearTimeout(id);
  }, [activeTab, isAdmin, loadUsers, userSearch]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const removeListingFromQueue = (id: string) => {
    setListings((prev) => prev.filter((item) => getListingId(item) !== id));
    setStats((prev) => prev
      ? { ...prev, listings: { ...prev.listings, pending: Math.max(0, prev.listings.pending - 1) } }
      : prev);
  };

  const approveListing = async (item: MarketListing) => {
    const id = getListingId(item);
    if (!id) return;
    setActingId(`approve-${id}`);
    try {
      await approveMarketListing(selectedCategory, id);
      removeListingFromQueue(id);
    } catch (e: any) {
      Alert.alert('Модерация', e.response?.data?.message || 'Не удалось одобрить объявление');
    } finally {
      setActingId('');
    }
  };

  const rejectListing = (item: MarketListing) => {
    const id = getListingId(item);
    if (!id) return;

    Alert.alert(
      'Отклонить объявление?',
      'Автор получит уведомление с причиной отклонения.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отклонить',
          style: 'destructive',
          onPress: async () => {
            setActingId(`reject-${id}`);
            try {
              await rejectMarketListing(selectedCategory, id, 'Нарушение правил публикации');
              removeListingFromQueue(id);
            } catch (e: any) {
              Alert.alert('Модерация', e.response?.data?.message || 'Не удалось отклонить объявление');
            } finally {
              setActingId('');
            }
          },
        },
      ],
    );
  };

  const replaceUser = (next: AdminUser) => {
    setUsers((prev) => prev.map((item) => (item._id === next._id ? { ...item, ...next } : item)));
  };

  const toggleBan = (item: AdminUser) => {
    if (!item._id) return;
    const banned = !!item.isBanned;

    Alert.alert(
      banned ? 'Разблокировать пользователя?' : 'Заблокировать пользователя?',
      banned ? 'Пользователь снова сможет пользоваться аккаунтом.' : 'Активные сессии пользователя будут сброшены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: banned ? 'Разблокировать' : 'Заблокировать',
          style: banned ? 'default' : 'destructive',
          onPress: async () => {
            setActingId(`ban-${item._id}`);
            try {
              replaceUser(banned ? await unbanUser(item._id!) : await banUser(item._id!));
            } catch (e: any) {
              Alert.alert('Пользователи', e.response?.data?.message || 'Не удалось изменить блокировку');
            } finally {
              setActingId('');
            }
          },
        },
      ],
    );
  };

  const toggleAdmin = (item: AdminUser) => {
    if (!item._id) return;
    const admin = !!item.isAdmin;
    Alert.alert(
      admin ? 'Снять права администратора?' : 'Выдать права администратора?',
      'Изменение прав вступит в силу сразу.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: admin ? 'Снять' : 'Выдать',
          style: admin ? 'destructive' : 'default',
          onPress: async () => {
            setActingId(`admin-${item._id}`);
            try {
              replaceUser(admin ? await revokeAdmin(item._id!) : await grantAdmin(item._id!));
            } catch (e: any) {
              Alert.alert('Пользователи', e.response?.data?.message || 'Не удалось изменить права');
            } finally {
              setActingId('');
            }
          },
        },
      ],
    );
  };

  const renderTabs = () => (
    <View style={styles.tabs}>
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, active && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.86}
          >
            <Ionicons name={tab.icon} size={17} color={active ? '#fff' : '#777'} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderOverview = () => (
    <View style={styles.section}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeList}>
        {RANGES.map((range) => {
          const active = statsRange === range.id;
          return (
            <TouchableOpacity
              key={range.id}
              style={[styles.rangeBtn, active && styles.rangeBtnActive]}
              onPress={() => setStatsRange(range.id)}
              activeOpacity={0.86}
            >
              <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{range.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.users.total ?? 0}</Text>
          <Text style={styles.statLabel}>пользователей</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.users.newToday ?? 0}</Text>
          <Text style={styles.statLabel}>новых сегодня</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.users.active24h ?? 0}</Text>
          <Text style={styles.statLabel}>активны 24ч</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.listings.pending ?? 0}</Text>
          <Text style={styles.statLabel}>на модерации</Text>
        </View>
      </View>

      <View style={styles.overviewCard}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="bar-chart-outline" size={20} color={colors.text} />
          <Text style={styles.sectionTitle}>Маркет</Text>
        </View>
        <Text style={styles.overviewText}>Всего объявлений: {stats?.listings.total ?? 0}</Text>
        <Text style={styles.overviewText}>Новых сегодня: {stats?.listings.newToday ?? 0}</Text>
        <Text style={styles.overviewText}>Диапазон: {stats?.rangeLabel || 'Неделя'}</Text>
      </View>

      <View style={styles.overviewCard}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="pulse-outline" size={20} color={colors.text} />
          <Text style={styles.sectionTitle}>Динамика</Text>
        </View>
        {stats?.daily?.slice(-7).map((item) => (
          <View key={item.date} style={styles.dailyRow}>
            <Text style={styles.dailyDate}>{item.date}</Text>
            <Text style={styles.dailyValue}>+{item.newUsers} users</Text>
            <Text style={styles.dailyValue}>+{item.newListings} listings</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderModeration = () => (
    <View style={styles.section}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
        {MARKET_CATEGORIES.map((category) => {
          const active = selectedCategory === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryBtn, active && styles.categoryBtnActive]}
              onPress={() => setSelectedCategory(category.id)}
              activeOpacity={0.86}
            >
              <Ionicons name={category.icon as any} size={17} color={active ? '#fff' : '#555'} />
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.shortLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.switchRow}>
        <TouchableOpacity style={[styles.switchBtn, !showAppeals && styles.switchBtnActive]} onPress={() => setShowAppeals(false)}>
          <Text style={[styles.switchText, !showAppeals && styles.switchTextActive]}>Ожидают</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.switchBtn, showAppeals && styles.switchBtnActive]} onPress={() => setShowAppeals(true)}>
          <Text style={[styles.switchText, showAppeals && styles.switchTextActive]}>Апелляции</Text>
        </TouchableOpacity>
      </View>

      {moderationLoading ? (
        <View style={styles.inlineLoader}><ActivityIndicator color={colors.text} /></View>
      ) : listings.length ? listings.map((item) => {
        const id = getListingId(item);
        const approving = actingId === `approve-${id}`;
        const rejecting = actingId === `reject-${id}`;
        const author = typeof item.author === 'object' ? item.author : null;
        return (
          <View key={id || getListingTitle(item)} style={styles.listingCard}>
            <View style={styles.listingTop}>
              <View style={styles.listingIcon}>
                <Ionicons name={activeCategory.icon as any} size={22} color={colors.text} />
              </View>
              <View style={styles.listingInfo}>
                <Text style={styles.cardTitle}>{getListingTitle(item)}</Text>
                <Text style={styles.cardMeta}>{getListingPrice(item, selectedCategory)} · {item.location || item.region || 'локация не указана'}</Text>
                <Text style={styles.cardMeta}>Автор: {author?.name || author?.userName || 'пользователь'}</Text>
              </View>
            </View>
            {item.description ? <Text style={styles.description} numberOfLines={3}>{item.description}</Text> : null}
            {item.moderationReasons?.length ? (
              <Text style={styles.reasonText}>Причины: {item.moderationReasons.join(', ')}</Text>
            ) : null}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => approveListing(item)} disabled={!!actingId}>
                {approving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionTextLight}>Одобрить</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectListing(item)} disabled={!!actingId}>
                {rejecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionTextLight}>Отклонить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );
      }) : (
        <View style={styles.emptyBox}>
          <Ionicons name="shield-checkmark-outline" size={38} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Очередь пуста</Text>
          <Text style={styles.emptyText}>{activeCategory.label}: нет объявлений в выбранном режиме.</Text>
        </View>
      )}
    </View>
  );

  const renderUsers = () => (
    <View style={styles.section}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по имени, нику или email"
          placeholderTextColor={colors.textFaint}
          value={userSearch}
          onChangeText={setUserSearch}
          autoCapitalize="none"
        />
        {userSearch ? (
          <TouchableOpacity onPress={() => setUserSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.usersTotal}>Всего: {usersTotal}</Text>

      {usersLoading ? (
        <View style={styles.inlineLoader}><ActivityIndicator color={colors.text} /></View>
      ) : users.length ? users.map((item) => {
        const banned = !!item.isBanned;
        const admin = !!item.isAdmin;
        const banLoading = actingId === `ban-${item._id}`;
        const adminLoading = actingId === `admin-${item._id}`;
        return (
          <View key={item._id} style={styles.userCard}>
            <TouchableOpacity
              style={styles.userTop}
              onPress={() => navigation.navigate('AdminUserDetails', { userId: item._id })}
              activeOpacity={0.86}
            >
              <View style={[styles.avatar, banned && styles.avatarDanger]}>
                <Text style={styles.avatarText}>{(item.name || item.userName || 'A').slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.cardTitle}>{item.name || 'Пользователь'}</Text>
                <Text style={styles.cardMeta}>@{item.userName || 'user'} · {item.email || 'email не указан'}</Text>
                <Text style={styles.cardMeta}>План: {item.plan || 'free'} · создан: {formatDate(item.createdAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </TouchableOpacity>

            <View style={styles.badgeRow}>
              {admin ? <Text style={styles.adminBadge}>Admin</Text> : null}
              {banned ? <Text style={styles.bannedBadge}>Banned</Text> : null}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => toggleAdmin(item)} disabled={!!actingId}>
                {adminLoading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.actionTextDark}>{admin ? 'Снять admin' : 'Выдать admin'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={banned ? styles.approveBtn : styles.rejectBtn} onPress={() => toggleBan(item)} disabled={!!actingId}>
                {banLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionTextLight}>{banned ? 'Разбанить' : 'Бан'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );
      }) : (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={38} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Пользователи не найдены</Text>
          <Text style={styles.emptyText}>Измените поиск или обновите список.</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>;
  }

  if (!isAdmin) {
    return (
      <View style={styles.centerContent}>
        <Ionicons name="lock-closed-outline" size={44} color={colors.textFaint} />
        <Text style={styles.emptyTitle}>Нет доступа</Text>
        <Text style={styles.emptyText}>{error || 'Этот раздел доступен только администраторам Avtotime.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <Ionicons name="shield-checkmark-outline" size={27} color={colors.text} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Админ</Text>
            <Text style={styles.subtitle}>Статистика, модерация маркета и пользователи</Text>
          </View>
        </View>
        {renderTabs()}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={22} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {activeTab === 'overview' ? renderOverview() : null}
        {activeTab === 'moderation' ? renderModeration() : null}
        {activeTab === 'users' ? renderUsers() : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.surface },
  top: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 3, color: colors.textMuted, fontSize: 13 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 3, marginTop: 14 },
  tabBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  tabBtnActive: { backgroundColor: colors.surfaceHi },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: '#fff' },
  content: { padding: 12, paddingBottom: 28 },
  section: { gap: 10 },
  rangeList: { gap: 8, paddingBottom: 2 },
  rangeBtn: { height: 36, borderRadius: 10, paddingHorizontal: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rangeBtnActive: { backgroundColor: colors.surfaceHi, borderColor: '#111' },
  rangeText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  rangeTextActive: { color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48.7%', backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 14 },
  statValue: { color: colors.text, fontSize: 25, fontWeight: '900' },
  statLabel: { marginTop: 3, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  overviewCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  overviewText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  dailyRow: { minHeight: 34, borderRadius: 8, backgroundColor: colors.bg, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dailyDate: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '900' },
  dailyValue: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  categoryList: { gap: 8, paddingBottom: 2 },
  categoryBtn: { height: 38, borderRadius: 10, paddingHorizontal: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryBtnActive: { backgroundColor: colors.surfaceHi, borderColor: '#111' },
  categoryText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  categoryTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', backgroundColor: '#ececec', borderRadius: 12, padding: 3 },
  switchBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  switchBtnActive: { backgroundColor: colors.surfaceHi },
  switchText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  switchTextActive: { color: '#fff' },
  inlineLoader: { minHeight: 90, alignItems: 'center', justifyContent: 'center' },
  listingCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 13 },
  listingTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listingIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  listingInfo: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  cardMeta: { marginTop: 3, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  description: { marginTop: 10, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  reasonText: { marginTop: 8, color: '#b45309', fontSize: 12, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: '#15803d', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  secondaryActionBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: '#e2e2e2', alignItems: 'center', justifyContent: 'center' },
  actionTextLight: { color: '#fff', fontSize: 13, fontWeight: '900' },
  actionTextDark: { color: colors.text, fontSize: 13, fontWeight: '900' },
  searchBox: { height: 44, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  usersTotal: { color: colors.textMuted, fontSize: 12, fontWeight: '800', paddingHorizontal: 2 },
  userCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 13 },
  userTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  avatarDanger: { backgroundColor: colors.danger },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  userInfo: { flex: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  adminBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceHi, color: '#fff', paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  bannedBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255,90,95,0.12)', color: colors.danger, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  emptyBox: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorBox: { borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', borderWidth: 1, borderColor: 'rgba(255,90,95,0.25)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '800' },
});
