import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAdminStatus } from '../api/admin';
import { getMe } from '../api/auth';
import { BillingStatus, getBillingStatus } from '../api/billing';
import { changePassword, deleteProfile, logoutAllSessions } from '../api/users';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { useLockStore } from '../store/lockStore';
import { authenticateBiometric, getBiometricLabel, isBiometricAvailable } from '../utils/biometric';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'Settings'> };

const PLAN_LABEL: Record<string, string> = {
  free: 'Базовый',
  pro: 'Pro Seller',
  business: 'Business',
};

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

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
    getBiometricLabel().then(setBioLabel);
  }, []);

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      if (!bioAvailable) {
        Alert.alert('Биометрия недоступна', 'На устройстве не настроены отпечаток пальца или Face ID. Добавьте их в настройках телефона.');
        return;
      }
      const ok = await authenticateBiometric('Подтвердите включение блокировки');
      if (!ok) return;
      await setBioEnabled(true);
    } else {
      await setBioEnabled(false);
    }
  };
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const closePassword = () => {
    if (savingPassword) return;
    setPasswordOpen(false);
    resetPasswordForm();
  };

  const submitPassword = async () => {
    const current = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (!current || !next || !confirm) {
      Alert.alert('Пароль', 'Заполните все поля.');
      return;
    }
    if (next.length < 8) {
      Alert.alert('Пароль', 'Новый пароль должен быть не короче 8 символов.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Пароль', 'Новые пароли не совпадают.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(current, next);
      closePassword();
      Alert.alert('Готово', 'Пароль изменён.');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось изменить пароль');
    } finally {
      setSavingPassword(false);
    }
  };

  const confirmLogoutAll = () => {
    Alert.alert(
      'Завершить другие сессии?',
      'Все входы на других устройствах будут сброшены. Текущая сессия останется активной.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          style: 'destructive',
          onPress: async () => {
            setLogoutAllLoading(true);
            try {
              await logoutAllSessions();
              Alert.alert('Готово', 'Остальные сессии завершены.');
            } catch (e: any) {
              Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось завершить сессии');
            } finally {
              setLogoutAllLoading(false);
            }
          },
        },
      ],
    );
  };

  const confirmLogout = () => {
    Alert.alert('Выйти?', 'Вы выйдете из мобильного приложения.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
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
      Alert.alert('Удаление аккаунта', 'Введите пароль от аккаунта.');
      return;
    }
    if (confirmation !== 'УДАЛИТЬ') {
      Alert.alert('Удаление аккаунта', 'Введите слово УДАЛИТЬ для подтверждения.');
      return;
    }

    Alert.alert(
      'Удалить аккаунт навсегда?',
      'Профиль, публикации, объявления, сообщения и сохраненные данные будут удалены. Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteProfile(password);
              setDeleteOpen(false);
              setDeletePassword('');
              setDeleteConfirm('');
              await logout();
            } catch (e: any) {
              Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить профиль');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const renderAction = ({
    icon,
    title,
    description,
    onPress,
    danger,
    loading: itemLoading,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    onPress: () => void;
    danger?: boolean;
    loading?: boolean;
  }) => (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.85} disabled={itemLoading}>
      <View style={[styles.actionIcon, danger && styles.actionIconDanger]}>
        {itemLoading ? (
          <ActivityIndicator color={danger ? '#d92323' : '#111'} />
        ) : (
          <Ionicons name={icon} size={21} color={danger ? '#d92323' : '#111'} />
        )}
      </View>
      <View style={styles.actionBody}>
        <Text style={[styles.actionTitle, danger && styles.actionTitleDanger]}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#aaa" />
    </TouchableOpacity>
  );

  const renderToggle = ({
    icon,
    title,
    description,
    value,
    onValueChange,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
  }) => (
    <View style={styles.actionRow}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={21} color="#111" />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#ddd', true: '#111' }}
        thumbColor="#fff"
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="settings-outline" size={27} color="#111" />
          </View>
          <Text style={styles.title}>Настройки</Text>
          <Text style={styles.subtitle}>Профиль, безопасность и управление аккаунтом</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={22} color="#d92323" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || user?.userName || 'A').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Пользователь'}</Text>
            <Text style={styles.profileUserName}>@{user?.userName || 'avtotime'}</Text>
            <Text style={styles.profileMeta}>{user?.location || 'Локация не указана'}</Text>
          </View>
        </View>

        <View style={styles.planCard}>
          <View>
            <Text style={styles.planLabel}>Текущий тариф</Text>
            <Text style={styles.planName}>{planLabel}</Text>
            <Text style={styles.planDate}>Действует до: {formatDate(billing.planExpiresAt)}</Text>
          </View>
          <TouchableOpacity style={styles.planBtn} onPress={() => navigation.navigate('Billing')} activeOpacity={0.85}>
            <Ionicons name="card-outline" size={17} color="#fff" />
            <Text style={styles.planBtnText}>Тарифы</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Аккаунт</Text>
          {renderAction({
            icon: 'create-outline',
            title: 'Редактировать профиль',
            description: 'Имя, никнейм, аватар, описание и ссылки',
            onPress: () => navigation.navigate('EditProfile'),
          })}
          {renderAction({
            icon: user?.isEmailVerified ? 'checkmark-circle-outline' : 'mail-unread-outline',
            title: user?.isEmailVerified ? 'Email подтверждён' : 'Подтвердить email',
            description: user?.isEmailVerified
              ? 'Аккаунт может публиковать посты, loops и объявления'
              : 'Нужно для публикаций, loops, объявлений и заявок',
            onPress: () => navigation.navigate('EmailVerification'),
          })}
          {renderAction({
            icon: 'albums-outline',
            title: 'Мои объявления',
            description: 'Открыть маркет с фильтром ваших объявлений',
            onPress: () => navigation.navigate('MarketTabs', { screen: 'MyListings' }),
          })}
          {renderAction({
            icon: 'bar-chart-outline',
            title: 'Аналитика',
            description: 'Просмотры и контакты по объявлениям',
            onPress: () => navigation.navigate('MarketAnalytics'),
          })}
          {renderAction({
            icon: 'star-outline',
            title: 'Отзывы обо мне',
            description: 'Оценки покупателей и клиентов по вашим объявлениям',
            onPress: () => navigation.navigate('MyReviews'),
          })}
          {renderAction({
            icon: 'notifications-outline',
            title: 'Уведомления',
            description: 'Типы событий, email и частота дайджеста',
            onPress: () => navigation.navigate('NotificationSettings'),
          })}
          {isAdmin ? renderAction({
            icon: 'shield-checkmark-outline',
            title: 'Админ-панель',
            description: 'Статистика, модерация маркета и управление пользователями',
            onPress: () => navigation.navigate('Admin'),
          }) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Безопасность</Text>
          {renderToggle({
            icon: 'finger-print-outline',
            title: 'Вход по биометрии',
            description: bioAvailable
              ? `Блокировать приложение и открывать через ${bioLabel}`
              : 'Настройте отпечаток или Face ID в настройках телефона',
            value: bioEnabled,
            onValueChange: toggleBiometric,
          })}
          {renderAction({
            icon: 'key-outline',
            title: 'Изменить пароль',
            description: 'Обновить пароль для входа',
            onPress: () => setPasswordOpen(true),
          })}
          {renderAction({
            icon: 'phone-portrait-outline',
            title: 'Завершить другие сессии',
            description: 'Сбросить входы на других устройствах',
            onPress: confirmLogoutAll,
            loading: logoutAllLoading,
          })}
          {renderAction({
            icon: 'trash-outline',
            title: 'Удалить аккаунт',
            description: 'Навсегда удалить профиль и связанные данные',
            onPress: () => setDeleteOpen(true),
            danger: true,
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Навигация</Text>
          {renderAction({
            icon: 'receipt-outline',
            title: 'История платежей',
            description: 'Оплаты и текущий статус тарифа',
            onPress: () => navigation.navigate('Billing'),
          })}
          {renderAction({
            icon: 'heart-outline',
            title: 'Запросы помощи',
            description: 'Ваши заявки и помощь другим водителям',
            onPress: () => navigation.navigate('HelpRequests'),
          })}
          {renderAction({
            icon: 'shield-checkmark-outline',
            title: 'Политика конфиденциальности',
            description: 'Как Avtotime хранит и обрабатывает персональные данные',
            onPress: () => navigation.navigate('PrivacyPolicy'),
          })}
          {renderAction({
            icon: 'log-out-outline',
            title: 'Выйти',
            description: 'Завершить текущую сессию приложения',
            onPress: confirmLogout,
            danger: true,
          })}
        </View>
      </ScrollView>

      <Modal visible={passwordOpen} transparent animationType="slide" onRequestClose={closePassword}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closePassword} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Изменить пароль</Text>

            <Text style={styles.inputLabel}>Текущий пароль</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="Введите текущий пароль"
              placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>Новый пароль</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Минимум 8 символов"
              placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>Повторите пароль</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Повторите новый пароль"
              placeholderTextColor="#999"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closePassword} disabled={savingPassword}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submitPassword} disabled={savingPassword}>
                {savingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={closeDelete}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeDelete} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.dangerHeader}>
              <View style={styles.dangerIcon}>
                <Ionicons name="warning-outline" size={23} color="#d92323" />
              </View>
              <View style={styles.dangerTextWrap}>
                <Text style={styles.sheetTitle}>Удалить аккаунт</Text>
                <Text style={styles.dangerDescription}>
                  Будут удалены профиль, публикации, объявления, сообщения, избранное и результаты тестов.
                </Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Пароль</Text>
            <TextInput
              style={styles.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              placeholder="Введите пароль"
              placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>Подтверждение</Text>
            <TextInput
              style={styles.input}
              value={deleteConfirm}
              onChangeText={(value) => setDeleteConfirm(value.toUpperCase())}
              placeholder="Введите УДАЛИТЬ"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeDelete} disabled={deleting}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={submitDeleteProfile} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Удалить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f5f7' },
  content: { padding: 16, paddingBottom: 30 },
  hero: { alignItems: 'center', paddingVertical: 16 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: '#111', fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#666', fontSize: 14, textAlign: 'center' },
  errorBox: { marginBottom: 10, borderRadius: 8, backgroundColor: '#fff0f0', borderWidth: 1, borderColor: '#ffd3d3', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: '#a51010', fontSize: 13, fontWeight: '800' },
  profileCard: { borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  profileInfo: { flex: 1 },
  profileName: { color: '#111', fontSize: 18, fontWeight: '900' },
  profileUserName: { marginTop: 2, color: '#777', fontSize: 13, fontWeight: '800' },
  profileMeta: { marginTop: 5, color: '#777', fontSize: 12, fontWeight: '700' },
  planCard: { marginTop: 10, borderRadius: 8, backgroundColor: '#111', padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  planLabel: { color: 'rgba(255,255,255,0.52)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  planName: { marginTop: 5, color: '#fff', fontSize: 23, fontWeight: '900' },
  planDate: { marginTop: 5, color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '700' },
  planBtn: { height: 40, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#d92323', flexDirection: 'row', alignItems: 'center', gap: 5 },
  planBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  section: { marginTop: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4 },
  sectionTitle: { color: '#111', fontSize: 17, fontWeight: '900', marginBottom: 6 },
  actionRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingVertical: 12 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  actionIconDanger: { backgroundColor: '#fff0f0' },
  actionBody: { flex: 1 },
  actionTitle: { color: '#111', fontSize: 15, fontWeight: '900' },
  actionTitleDanger: { color: '#d92323' },
  actionDescription: { marginTop: 3, color: '#777', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 12 },
  sheetTitle: { color: '#111', fontSize: 20, fontWeight: '900', marginBottom: 14 },
  dangerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  dangerIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  dangerTextWrap: { flex: 1 },
  dangerDescription: { marginTop: -8, color: '#777', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  inputLabel: { color: '#555', fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { height: 46, borderRadius: 8, backgroundColor: '#f3f3f3', paddingHorizontal: 12, color: '#111', fontSize: 15, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#111', fontSize: 15, fontWeight: '900' },
  saveBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: '#d92323', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
