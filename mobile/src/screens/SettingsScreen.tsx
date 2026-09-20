import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAdminStatus } from '../api/admin';
import { getMe } from '../api/auth';
import { BillingStatus, getBillingStatus } from '../api/billing';
import { changePassword, deleteProfile, logoutAllSessions } from '../api/users';
import { AppStackParamList } from '../navigation/AppNavigator';
import { Avatar, FormSheet, PressableScale } from '../components/ui';
import { askConfirm } from '../store/confirmStore';
import { showToast } from '../store/toastStore';
import { colors, font, radius, shadow, space } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useLockStore } from '../store/lockStore';
import { authenticateBiometric, getBiometricLabel, isBiometricAvailable } from '../utils/biometric';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'Settings'> };

const PLAN_LABEL: Record<string, string> = {
  free: 'Базовый',
  pro: 'Pro Seller',
  business: 'Business',
};

// Аналитика открыта платным тарифам. Право проверяет сервер, но знать об
// этом заранее полезно: незачем открывать экран, который сразу откажет.
const PAID_PLANS = new Set(['pro', 'business']);

const SUPPORT_EMAIL = 'avtotimereal@gmail.com';

const emptyBilling: BillingStatus = {
  plan: 'free',
  effectivePlan: 'free',
  planActivatedAt: null,
  planExpiresAt: null,
  payments: [],
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Без срока';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Без срока';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
};

const appVersion = () => {
  const version = Constants.expoConfig?.version || '—';
  const build = Constants.expoConfig?.android?.versionCode;
  return build ? `${version} (${build})` : String(version);
};

export default function SettingsScreen({ navigation }: Props) {
  const { user, setUser, logout } = useAuthStore();
  const [billing, setBilling] = useState<BillingStatus>(emptyBilling);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const bioEnabled = useLockStore((s) => s.enabled);
  const setBioEnabled = useLockStore((s) => s.setEnabled);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('биометрию');
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
    getBiometricLabel().then(setBioLabel);
  }, []);

  const activePlan = billing.effectivePlan || billing.plan || user?.effectivePlan || user?.plan || 'free';
  const planLabel = PLAN_LABEL[activePlan] || 'Базовый';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [freshUser, billingStatus] = await Promise.all([
        getMe(),
        getBillingStatus().catch(() => emptyBilling),
      ]);
      const adminStatus = await getAdminStatus().catch(() => ({ isAdmin: false }));
      setUser(freshUser);
      setBilling(billingStatus);
      setIsAdmin(!!adminStatus.isAdmin);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      if (!bioAvailable) {
        showToast('На устройстве не настроены отпечаток пальца или Face ID');
        return;
      }
      const ok = await authenticateBiometric('Подтвердите включение блокировки');
      if (!ok) return;
      await setBioEnabled(true);
      return;
    }
    await setBioEnabled(false);
  };

  const closePassword = () => {
    if (savingPassword) return;
    setPasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const submitPassword = async () => {
    const current = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (!current || !next || !confirm) {
      showToast('Заполните все поля');
      return;
    }
    if (next.length < 8) {
      showToast('Новый пароль должен быть не короче 8 символов');
      return;
    }
    if (next !== confirm) {
      showToast('Новые пароли не совпадают');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(current, next);
      closePassword();
      showToast('Пароль изменён', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось изменить пароль', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeletePassword('');
    setDeleteConfirm('');
  };

  const submitDeleteProfile = async () => {
    const password = deletePassword.trim();
    const confirmation = deleteConfirm.trim().toUpperCase();

    if (!password) {
      showToast('Введите пароль от аккаунта');
      return;
    }
    if (confirmation !== 'УДАЛИТЬ') {
      showToast('Введите слово УДАЛИТЬ для подтверждения');
      return;
    }

    const agreed = await askConfirm({
      title: 'Удалить аккаунт навсегда?',
      message: 'Профиль, публикации, объявления, сообщения и сохранённые данные будут удалены. Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!agreed) return;

    setDeleting(true);
    try {
      await deleteProfile(password);
      closeDelete();
      await logout();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось удалить профиль', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const confirmLogoutAll = async () => {
    const agreed = await askConfirm({
      title: 'Завершить другие сессии?',
      message: 'Все входы на других устройствах будут сброшены. Текущая сессия останется активной.',
      confirmLabel: 'Завершить',
      destructive: true,
    });
    if (!agreed) return;

    setLogoutAllLoading(true);
    try {
      await logoutAllSessions();
      showToast('Остальные сессии завершены', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось завершить сессии', 'error');
    } finally {
      setLogoutAllLoading(false);
    }
  };

  const confirmLogout = async () => {
    const agreed = await askConfirm({
      title: 'Выйти?',
      message: 'Вы выйдете из мобильного приложения.',
      confirmLabel: 'Выйти',
      destructive: true,
    });
    if (agreed) void logout();
  };

  // Аналитика без платного тарифа сразу упирается в отказ — предупреждаем
  // здесь так же, как в маркете.
  const openAnalytics = async () => {
    if (PAID_PLANS.has(String(activePlan))) {
      navigation.navigate('MarketAnalytics');
      return;
    }
    const agreed = await askConfirm({
      title: 'Аналитика в тарифах Pro и Business',
      message: 'На текущем тарифе подробная статистика по объявлениям недоступна.',
      confirmLabel: 'Открыть тарифы',
      cancelLabel: 'Позже',
    });
    if (agreed) navigation.navigate('Billing');
  };

  const openSupport = () => {
    const subject = encodeURIComponent('Avtotime: вопрос из приложения');
    const body = encodeURIComponent(`\n\n—\nВерсия приложения: ${appVersion()}\nАккаунт: @${user?.userName || ''}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`)
      .catch(() => showToast('Почтовое приложение не найдено. Напишите на ' + SUPPORT_EMAIL));
  };

  const row = ({
    icon, title, description, onPress, danger, loading: itemLoading, last,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description?: string;
    onPress: () => void;
    danger?: boolean;
    loading?: boolean;
    last?: boolean;
  }) => (
    <TouchableOpacity
      key={title}
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={itemLoading}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        {itemLoading
          ? <ActivityIndicator color={danger ? colors.danger : colors.text} />
          : <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.text} />}
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Аккаунт</Text>
        <View style={styles.section}>
          {/* Личность и переход к правке — одной строкой: карточка сверху
              повторяла экран профиля и вдобавок не показывала фото. */}
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Avatar uri={user?.profileImage} userName={user?.userName} name={user?.name} size={46} />
            <View style={styles.rowBody}>
              <Text style={styles.identityName} numberOfLines={1}>{user?.name || 'Пользователь'}</Text>
              <Text style={styles.rowDescription} numberOfLines={1}>@{user?.userName || 'avtotime'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>

          {row({
            icon: user?.isEmailVerified ? 'checkmark-circle-outline' : 'mail-unread-outline',
            title: user?.isEmailVerified ? 'Email подтверждён' : 'Подтвердить email',
            description: user?.isEmailVerified
              ? 'Публикации, loops и объявления доступны'
              : 'Нужно для публикаций, объявлений и заявок',
            onPress: () => navigation.navigate('EmailVerification'),
          })}
          {row({
            icon: 'notifications-outline',
            title: 'Уведомления',
            description: 'Типы событий, email и частота дайджеста',
            onPress: () => navigation.navigate('NotificationSettings'),
          })}
          {row({
            icon: 'star-outline',
            title: 'Отзывы обо мне',
            description: 'Оценки покупателей и клиентов',
            onPress: () => navigation.navigate('MyReviews'),
            last: !isAdmin,
          })}
          {isAdmin ? row({
            icon: 'shield-checkmark-outline',
            title: 'Админ-панель',
            description: 'Модерация маркета и управление пользователями',
            onPress: () => navigation.navigate('Admin'),
            last: true,
          }) : null}
        </View>

        <Text style={styles.sectionTitle}>Продажи</Text>
        <View style={styles.section}>
          <PressableScale
            style={styles.planCard}
            scaleTo={0.99}
            onPress={() => navigation.navigate('Billing')}
          >
            <View style={styles.planBody}>
              <Text style={styles.planLabel}>Тариф</Text>
              <Text style={styles.planName}>{planLabel}</Text>
              <Text style={styles.planDate}>Действует до: {formatDate(billing.planExpiresAt)}</Text>
            </View>
            <View style={styles.planAction}>
              <Ionicons name="card-outline" size={18} color={colors.onAccent} />
            </View>
          </PressableScale>

          {row({
            icon: 'albums-outline',
            title: 'Мои объявления',
            description: 'Статусы проверки, правка и снятие с публикации',
            onPress: () => navigation.navigate('MyListings'),
          })}
          {row({
            icon: 'bar-chart-outline',
            title: 'Аналитика',
            description: 'Просмотры и контакты по объявлениям',
            onPress: openAnalytics,
            last: true,
          })}
        </View>

        <Text style={styles.sectionTitle}>Безопасность</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="finger-print-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Вход по биометрии</Text>
              <Text style={styles.rowDescription}>
                {bioAvailable
                  ? `Блокировать приложение и открывать через ${bioLabel}`
                  : 'Настройте отпечаток или Face ID в настройках телефона'}
              </Text>
            </View>
            <Switch
              value={bioEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: colors.surfaceHi, true: colors.success }}
              thumbColor={colors.white}
            />
          </View>

          {row({
            icon: 'key-outline',
            title: 'Изменить пароль',
            description: 'Обновить пароль для входа',
            onPress: () => setPasswordOpen(true),
          })}
          {row({
            icon: 'phone-portrait-outline',
            title: 'Завершить другие сессии',
            description: 'Сбросить входы на других устройствах',
            onPress: confirmLogoutAll,
            loading: logoutAllLoading,
          })}
          {row({
            icon: 'trash-outline',
            title: 'Удалить аккаунт',
            description: 'Навсегда удалить профиль и связанные данные',
            onPress: () => setDeleteOpen(true),
            danger: true,
            last: true,
          })}
        </View>

        <Text style={styles.sectionTitle}>О приложении</Text>
        <View style={styles.section}>
          {row({
            icon: 'shield-checkmark-outline',
            title: 'Политика конфиденциальности',
            description: 'Какие данные хранит Avtotime и зачем',
            onPress: () => navigation.navigate('PrivacyPolicy'),
          })}
          {row({
            icon: 'document-text-outline',
            title: 'Условия использования',
            description: 'Правила площадки и публикации объявлений',
            onPress: () => navigation.navigate('Terms'),
          })}
          {row({
            icon: 'chatbubble-ellipses-outline',
            title: 'Написать в поддержку',
            description: SUPPORT_EMAIL,
            onPress: openSupport,
          })}
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowIcon}>
              <Ionicons name="information-circle-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Версия приложения</Text>
              <Text style={styles.rowDescription}>Пригодится при обращении в поддержку</Text>
            </View>
            <Text style={styles.versionValue}>{appVersion()}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={19} color={colors.danger} />
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>

      <FormSheet
        visible={passwordOpen}
        title="Изменить пароль"
        subtitle="Новый пароль должен быть не короче восьми символов"
        onClose={closePassword}
      >
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="Текущий пароль"
          placeholderTextColor={colors.textFaint}
        />
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Новый пароль"
          placeholderTextColor={colors.textFaint}
        />
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Повторите новый пароль"
          placeholderTextColor={colors.textFaint}
        />

        <View style={styles.sheetActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={closePassword} disabled={savingPassword}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={submitPassword} disabled={savingPassword}>
            {savingPassword
              ? <ActivityIndicator color={colors.onAccent} />
              : <Text style={styles.saveText}>Сохранить</Text>}
          </TouchableOpacity>
        </View>
      </FormSheet>

      <FormSheet
        visible={deleteOpen}
        title="Удалить аккаунт"
        subtitle="Будут удалены профиль, публикации, объявления, сообщения и результаты тестов"
        onClose={closeDelete}
      >
        <TextInput
          style={styles.input}
          value={deletePassword}
          onChangeText={setDeletePassword}
          secureTextEntry
          placeholder="Пароль от аккаунта"
          placeholderTextColor={colors.textFaint}
        />
        <TextInput
          style={styles.input}
          value={deleteConfirm}
          onChangeText={(value) => setDeleteConfirm(value.toUpperCase())}
          placeholder="Введите УДАЛИТЬ"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
        />

        <View style={styles.sheetActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={closeDelete} disabled={deleting}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={submitDeleteProfile} disabled={deleting}>
            {deleting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.deleteText}>Удалить</Text>}
          </TouchableOpacity>
        </View>
      </FormSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xxl },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginBottom: space.md, padding: space.md, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,90,95,0.12)',
  },
  errorText: { flex: 1, color: colors.danger, fontSize: font.small, fontWeight: '800' },

  sectionTitle: {
    marginTop: space.lg, marginBottom: space.sm, marginLeft: space.xs,
    color: colors.textFaint, fontSize: font.tiny, fontWeight: '900',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  section: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...shadow.card },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    minHeight: 62, paddingHorizontal: space.md, paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: 'rgba(255,90,95,0.12)' },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: font.small, fontWeight: '900' },
  rowTitleDanger: { color: colors.danger },
  rowDescription: { marginTop: 3, color: colors.textMuted, fontSize: font.tiny, lineHeight: 16, fontWeight: '700' },
  identityName: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  versionValue: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '900' },

  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  planBody: { flex: 1 },
  planLabel: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  planName: { marginTop: 3, color: colors.text, fontSize: font.h2, fontWeight: '900' },
  planDate: { marginTop: 3, color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },
  planAction: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    marginTop: space.lg, height: 52, borderRadius: radius.lg, backgroundColor: colors.surface,
    ...shadow.card,
  },
  logoutText: { color: colors.danger, fontSize: font.body, fontWeight: '900' },

  input: {
    height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body, marginBottom: space.sm,
  },
  sheetActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  saveBtn: {
    flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
  deleteBtn: {
    flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteText: { color: colors.white, fontSize: font.body, fontWeight: '900' },
});
