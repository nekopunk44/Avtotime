import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  BillingStatus,
  getBillingStatus,
  getPaymentGeo,
  PaymentRow,
  PlanKey,
  setFreePlan,
  WEB_TARIFFS_URL,
} from '../api/billing';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'Billing'> };

type PlanCard = {
  key: PlanKey;
  name: string;
  price: string;
  eyebrow: string;
  summary: string;
  icon: string;
  dark?: boolean;
  features: string[];
};

const PLAN_LABEL: Record<string, string> = {
  free: 'Базовый',
  pro: 'Pro Seller',
  business: 'Business',
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  succeeded: { label: 'Оплачен', color: '#14843b', bg: '#eaf8ef' },
  pending: { label: 'В обработке', color: '#9a5a00', bg: '#fff6df' },
  failed: { label: 'Ошибка', color: colors.danger, bg: '#fff0f0' },
  refunded: { label: 'Возврат', color: colors.textMuted, bg: '#f0f0f0' },
};

const PLANS: PlanCard[] = [
  {
    key: 'free',
    name: 'Базовый',
    price: 'Бесплатно',
    eyebrow: 'Для частных продаж',
    summary: 'Стартовый формат для личных объявлений.',
    icon: 'shield-checkmark-outline',
    features: [
      'До 3 активных объявлений',
      'До 5 фото в объявлении',
      'Описание до 500 символов',
      'Срок объявления 30 дней',
      'Телефон скрыт до запроса',
    ],
  },
  {
    key: 'pro',
    name: 'Pro Seller',
    price: '29 EUR / мес',
    eyebrow: 'Для активных продавцов',
    summary: 'Больше объявлений, статистика и повышенный приоритет.',
    icon: 'sparkles-outline',
    features: [
      'До 20 активных объявлений',
      'До 20 фото в объявлении',
      'Описание до 2000 символов',
      'Срок объявления 90 дней',
      'Аналитика, видео и бейдж Pro',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    price: '79 EUR / мес',
    eyebrow: 'Для автосалонов',
    summary: 'Максимальный лимит, топ-приоритет и расширенные карточки.',
    icon: 'business-outline',
    dark: true,
    features: [
      'Безлимитные объявления',
      'До 40 фото в объявлении',
      'Описание без ограничений',
      'Объявления не истекают',
      'Бейдж Business и приоритет',
    ],
  },
];

const emptyStatus: BillingStatus = {
  plan: 'free',
  effectivePlan: 'free',
  planActivatedAt: null,
  planExpiresAt: null,
  payments: [],
};

const normalizePlan = (plan?: string): PlanKey => {
  if (plan === 'pro' || plan === 'business' || plan === 'free') return plan;
  return 'free';
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Нет активного срока';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Нет активного срока';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Нет даты';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Нет даты';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatAmount = (amount: number, currency?: string) => {
  const code = (currency || 'eur').toUpperCase();
  const value = (Number(amount || 0) / 100).toFixed(2);
  if (code === 'EUR') return `${value} €`;
  if (code === 'USD') return `$${value}`;
  return `${value} ${code}`;
};

export default function BillingScreen({ navigation }: Props) {
  const [status, setStatus] = useState<BillingStatus>(emptyStatus);
  const [geo, setGeo] = useState<{ country: string | null; isCis: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activePlan = normalizePlan(status.effectivePlan || status.plan);
  const currentPlanLabel = PLAN_LABEL[activePlan] || 'Базовый';
  const successfulPayments = useMemo(
    () => status.payments.filter((payment) => payment.status === 'succeeded'),
    [status.payments],
  );
  const totalPaid = successfulPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [nextStatus, nextGeo] = await Promise.all([
        getBillingStatus(),
        getPaymentGeo().catch(() => null),
      ]);
      setStatus(nextStatus);
      setGeo(nextGeo);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить тарифы');
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

  const openWebCheckout = async () => {
    const canOpen = await Linking.canOpenURL(WEB_TARIFFS_URL);
    if (!canOpen) {
      Alert.alert('Тарифы', 'Не удалось открыть страницу оплаты на этом устройстве.');
      return;
    }
    await Linking.openURL(WEB_TARIFFS_URL);
  };

  const selectFreePlan = () => {
    if (activePlan === 'free') return;

    Alert.alert(
      'Перейти на базовый тариф?',
      'Платные возможности и приоритет объявлений будут отключены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Перейти',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const result = await setFreePlan();
              setStatus((prev) => ({
                ...prev,
                plan: result.plan,
                effectivePlan: result.effectivePlan,
                planActivatedAt: result.planActivatedAt,
                planExpiresAt: result.planExpiresAt,
              }));
              Alert.alert('Готово', 'Базовый тариф активирован.');
            } catch (e: any) {
              Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось сменить тариф');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const renderPlan = (plan: PlanCard) => {
    const isCurrent = activePlan === plan.key;
    const isFree = plan.key === 'free';
    const bg = plan.dark ? '#111' : '#fff';
    const text = plan.dark ? '#fff' : '#111';
    const muted = plan.dark ? 'rgba(255,255,255,0.68)' : '#666';

    return (
      <View key={plan.key} style={[styles.planCard, { backgroundColor: bg, borderColor: isCurrent ? '#d92323' : '#ececec' }]}>
        <View style={styles.planHeader}>
          <View style={[styles.planIcon, { backgroundColor: plan.dark ? 'rgba(255,255,255,0.1)' : '#fff0f0' }]}>
            <Ionicons name={plan.icon as any} size={23} color={plan.dark ? '#fff' : '#d92323'} />
          </View>
          {isCurrent ? <Text style={styles.activePill}>Активен</Text> : null}
        </View>

        <Text style={[styles.planEyebrow, { color: plan.dark ? 'rgba(255,255,255,0.52)' : '#d92323' }]}>{plan.eyebrow}</Text>
        <Text style={[styles.planName, { color: text }]}>{plan.name}</Text>
        <Text style={[styles.planPrice, { color: text }]}>{plan.price}</Text>
        <Text style={[styles.planSummary, { color: muted }]}>{plan.summary}</Text>

        <View style={styles.featureList}>
          {plan.features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={17} color={plan.dark ? '#fff' : '#d92323'} />
              <Text style={[styles.featureText, { color: muted }]}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.planBtn,
            isCurrent ? styles.planBtnDisabled : plan.dark ? styles.planBtnLight : styles.planBtnDark,
          ]}
          onPress={isFree ? selectFreePlan : openWebCheckout}
          disabled={isCurrent || saving}
          activeOpacity={0.85}
        >
          {saving && isFree ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[
              styles.planBtnText,
              isCurrent ? styles.planBtnTextDisabled : plan.dark ? styles.planBtnTextDark : styles.planBtnTextLight,
            ]}>
              {isCurrent ? 'Текущий тариф' : isFree ? 'Выбрать базовый' : 'Открыть оплату'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderPayment = (payment: PaymentRow, index: number) => {
    const statusInfo = STATUS_LABEL[payment.status] || { label: payment.status, color: colors.textMuted, bg: '#f0f0f0' };
    const planLabel = PLAN_LABEL[payment.plan] || payment.plan;

    return (
      <View key={payment._id || `${payment.createdAt}-${index}`} style={styles.paymentRow}>
        <View style={styles.paymentIcon}>
          <Ionicons name={payment.plan === 'business' ? 'business-outline' : 'sparkles-outline'} size={20} color={colors.danger} />
        </View>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentTitle}>{planLabel}</Text>
          <Text style={styles.paymentDate}>{formatDateTime(payment.createdAt)}</Text>
        </View>
        <View style={styles.paymentRight}>
          <Text style={styles.paymentAmount}>{formatAmount(payment.amount, payment.currency)}</Text>
          <Text style={[styles.statusPill, { color: statusInfo.color, backgroundColor: statusInfo.bg }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Тарифы</Text>
            <Text style={styles.subtitle}>План, лимиты и история платежей AVTOTIME Market</Text>
          </View>
          <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('MarketAnalytics')} activeOpacity={0.85}>
            <Ionicons name="bar-chart-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.statusCard}>
            <View>
              <Text style={styles.statusLabel}>Текущий план</Text>
              <Text style={styles.statusPlan}>{currentPlanLabel}</Text>
              <Text style={styles.statusDate}>Действует до: {formatDate(status.planExpiresAt)}</Text>
            </View>
            <View style={styles.statusStats}>
              <Text style={styles.statusStatValue}>{successfulPayments.length}</Text>
              <Text style={styles.statusStatLabel}>оплат</Text>
              <Text style={styles.statusStatTotal}>{formatAmount(totalPaid, successfulPayments[0]?.currency || 'eur')}</Text>
            </View>
          </View>

          <View style={styles.geoBox}>
            <View style={styles.geoIcon}>
              <Ionicons name="earth-outline" size={20} color={geo?.isCis ? '#b45309' : '#14843b'} />
            </View>
            <View style={styles.geoTextWrap}>
              <Text style={styles.geoTitle}>
                {geo?.country ? `Регион оплаты: ${geo.country}` : 'Регион оплаты не определен'}
              </Text>
              <Text style={styles.geoText}>
                {geo?.isCis
                  ? 'Backend определил CIS-регион. Для оплаты может быть удобнее web checkout.'
                  : 'Backend не видит ограничений CIS для текущего IP.'}
              </Text>
            </View>
          </View>

          <View style={styles.noticeBox}>
            <Ionicons name="card-outline" size={22} color={colors.text} />
            <Text style={styles.noticeText}>
              В Expo Go платная карта открывается через web checkout. Native Stripe форму можно добавить позже для dev build.
            </Text>
          </View>

          <View style={styles.planList}>
            {PLANS.map(renderPlan)}
          </View>

          <View style={styles.historyBlock}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="receipt-outline" size={21} color={colors.text} />
              <Text style={styles.sectionTitle}>История платежей</Text>
            </View>

            {status.payments.length ? (
              <View style={styles.paymentsList}>
                {status.payments.map(renderPayment)}
              </View>
            ) : (
              <View style={styles.emptyHistory}>
                <Ionicons name="receipt-outline" size={34} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>Платежей пока нет</Text>
                <Text style={styles.emptyText}>После оплаты Pro или Business операции появятся здесь.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  top: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 4, color: colors.textMuted, fontSize: 13 },
  historyBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 12, paddingBottom: 28, gap: 10 },
  statusCard: { borderRadius: 8, backgroundColor: colors.surfaceHi, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  statusLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  statusPlan: { marginTop: 5, color: '#fff', fontSize: 27, fontWeight: '900' },
  statusDate: { marginTop: 5, color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '700' },
  statusStats: { minWidth: 92, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', padding: 11, alignItems: 'flex-end' },
  statusStatValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  statusStatLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 12, fontWeight: '800' },
  statusStatTotal: { marginTop: 8, color: '#fff', fontSize: 13, fontWeight: '900' },
  geoBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  geoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  geoTextWrap: { flex: 1 },
  geoTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  geoText: { marginTop: 3, color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  noticeBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noticeText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  planList: { gap: 10 },
  planCard: { borderRadius: 8, borderWidth: 1, padding: 15 },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activePill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.danger, color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  planEyebrow: { marginTop: 15, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  planName: { marginTop: 7, fontSize: 24, fontWeight: '900' },
  planPrice: { marginTop: 5, fontSize: 18, fontWeight: '900' },
  planSummary: { marginTop: 7, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  featureList: { gap: 8, marginTop: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  planBtn: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  planBtnDark: { backgroundColor: colors.surfaceHi },
  planBtnLight: { backgroundColor: colors.surface },
  planBtnDisabled: { backgroundColor: colors.surfaceHi },
  planBtnText: { fontSize: 14, fontWeight: '900' },
  planBtnTextLight: { color: '#fff' },
  planBtnTextDark: { color: colors.text },
  planBtnTextDisabled: { color: colors.textMuted },
  historyBlock: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  paymentsList: { gap: 9, marginTop: 12 },
  paymentRow: { minHeight: 70, borderRadius: 8, backgroundColor: colors.bg, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,90,95,0.12)', alignItems: 'center', justifyContent: 'center' },
  paymentInfo: { flex: 1 },
  paymentTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  paymentDate: { marginTop: 3, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  paymentRight: { alignItems: 'flex-end', gap: 6 },
  paymentAmount: { color: colors.text, fontSize: 14, fontWeight: '900' },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  emptyHistory: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { marginTop: 9, color: colors.text, fontSize: 16, fontWeight: '900' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  errorBox: { borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', borderWidth: 1, borderColor: 'rgba(255,90,95,0.25)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '800' },
});
