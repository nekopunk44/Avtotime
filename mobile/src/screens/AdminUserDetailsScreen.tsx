import React, { useCallback, useState } from 'react';
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
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminUserDetails, getAdminUserDetails } from '../api/admin';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'AdminUserDetails'>;
  route: RouteProp<AppStackParamList, 'AdminUserDetails'>;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'нет данных';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'нет данных';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
};

const Stat = ({ value, label, icon }: { value: number; label: string; icon: keyof typeof Ionicons.glyphMap }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={20} color={colors.text} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function AdminUserDetailsScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getAdminUserDetails(userId);
      setDetails(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить пользователя');
      setDetails(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

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
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const user = details?.user;
  const stats = details?.stats ?? { posts: 0, loops: 0, listings: 0, followers: 0, following: 0 };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {user ? (
        <>
          <View style={styles.profileCard}>
            {user.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{(user.name || user.userName || 'A').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.name || 'Пользователь'}</Text>
              <Text style={styles.username}>@{user.userName || 'user'}</Text>
              <Text style={styles.email}>{user.email || 'email не указан'}</Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            <Text style={styles.planBadge}>{user.plan || 'free'}</Text>
            {user.isAdmin ? <Text style={styles.adminBadge}>Admin</Text> : null}
            {user.isBanned ? <Text style={styles.bannedBadge}>Banned</Text> : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Статистика</Text>
            <View style={styles.statsGrid}>
              <Stat value={stats.posts} label="посты" icon="images-outline" />
              <Stat value={stats.loops} label="loops" icon="play-circle-outline" />
              <Stat value={stats.listings} label="объявления" icon="car-sport-outline" />
              <Stat value={stats.followers} label="подписчики" icon="people-outline" />
              <Stat value={stats.following} label="подписки" icon="person-add-outline" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Профиль</Text>
            <Text style={styles.infoLine}>Создан: {formatDate(user.createdAt)}</Text>
            <Text style={styles.infoLine}>Последняя активность: {formatDate(user.lastSeenAt)}</Text>
            {user.location ? <Text style={styles.infoLine}>Локация: {user.location}</Text> : null}
            {user.profession ? <Text style={styles.infoLine}>Профессия: {user.profession}</Text> : null}
            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          </View>

          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('UserProfile', { userId: user._id })}
            activeOpacity={0.86}
          >
            <Ionicons name="person-outline" size={18} color={colors.onAccent} />
            <Text style={styles.profileBtnText}>Открыть публичный профиль</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="person-circle-outline" size={42} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Пользователь не найден</Text>
          <Text style={styles.emptyText}>Обновите экран или вернитесь к списку пользователей.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 12, paddingBottom: 30, gap: 10 },
  errorBox: { borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,90,95,0.25)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  profileCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 74, height: 74, borderRadius: 24, backgroundColor: colors.surfaceAlt },
  avatarFallback: { backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: '900' },
  profileInfo: { flex: 1 },
  name: { color: colors.text, fontSize: 22, fontWeight: '900' },
  username: { marginTop: 2, color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  email: { marginTop: 5, color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  planBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceHi, color: colors.white, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  adminBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(61,214,140,0.14)', color: colors.success, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  bannedBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255,90,95,0.12)', color: colors.danger, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  section: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14, gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48.6%', borderRadius: 8, backgroundColor: colors.bg, padding: 12 },
  statValue: { marginTop: 8, color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  infoLine: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  bio: { color: colors.textMuted, fontSize: 14, lineHeight: 21, backgroundColor: colors.bg, borderRadius: 8, padding: 10 },
  profileBtn: { height: 48, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  profileBtnText: { color: colors.onAccent, fontSize: 15, fontWeight: '900' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 42, paddingHorizontal: 20 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
