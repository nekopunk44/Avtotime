import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
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
  getStoreBillingConfig,
  PlanKey,
  setFreePlan,
  StoreBillingConfig,
  StorePlanResult,
  WEB_TARIFFS_URL,
} from '../api/billing';
import {
  isCancelled,
  isStoreBillingSupported,
  purchasePlan,
  restoreStorePurchases,
} from '../billing/storePurchase';
import { Platform } from 'react-native';
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

const formatAmount = (amount: number, currency?: string) => {
  const code = (currency || 'eur').toUpperCase();
  const value = (Number(amount || 0) / 100).toFixed(2);
  if (code === 'EUR') return `${value} €`;
  if (code === 'USD') return `$${value}`;
  return `${value} ${code}`;
};

export default function BillingScreen({ navigation }: Props) {
  const [status, setStatus] = useState<BillingStatus>(emptyStatus);
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
      setStatus(await getBillingStatus());
    } catch (e: any) {
      // Код ответа в тексте: «просто ошибка» невозможно диагностировать.
      const status = e?.response?.status;
      setError(
        e?.response?.data?.message
          || (status ? `Не удалось загрузить тарифы (ответ ${status})` : 'Не удалось загрузить тарифы'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('PaymentHistory')} hitSlop={8} activeOpacity={0.8}>
          <Ionicons name="receipt-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const [storeConfig, setStoreConfig] = useState<StoreBillingConfig | null>(null);
  const [buyingPlan, setBuyingPlan] = useState<PlanKey | null>(null);
  const [restoring, setRestoring] = useState(false);

  useFocusEffect(useCallback(() => {
    getStoreBillingConfig().then(setStoreConfig).catch(() => setStoreConfig(null));
  }, []));

  // Нативная покупка возможна, когда И сборка несёт модуль стора, И сервер
  // настроен для этой платформы. Иначе честный фолбэк на веб-чекаут.
  const nativeBillingReady =
    isStoreBillingSupported() &&
    Boolean(Platform.OS === 'ios' ? storeConfig?.apple : storeConfig?.google);

  const applyPlanResult = (result: StorePlanResult) => {
    setStatus((prev) => ({
      ...prev,
      plan: result.plan,
      effectivePlan: result.effectivePlan,
      planActivatedAt: result.planActivatedAt,
      planExpiresAt: result.planExpiresAt,
    }));
  };

  const buyPlanNative = async (plan: PlanKey) => {
    if (plan === 'free' || buyingPlan) return;
    setBuyingPlan(plan);
    try {
      const result = await purchasePlan(plan);
      applyPlanResult(result);
      Alert.alert('Готово', `Тариф «${PLAN_LABEL[String(result.effectivePlan)] || result.effectivePlan}» активирован.`);
    } catch (e: any) {
      if (!isCancelled(e)) {
        Alert.alert('Оплата', e?.response?.data?.message || e?.message || 'Покупка не прошла');
      }
    } finally {
      setBuyingPlan(null);
    }
  };

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await restoreStorePurchases();
      if (result) {
        applyPlanResult(result);
        Alert.alert('Готово', 'Подписка восстановлена.');
      } else {
        Alert.alert('Восстановление', 'Активных покупок в сторе не найдено.');
      }
    } catch (e: any) {
      Alert.alert('Восстановление', e?.response?.data?.message || e?.message || 'Не удалось восстановить покупки');
    } finally {
      setRestoring(false);
    }
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

    return (
      <View key={plan.key} style={[styles.planCard, plan.dark && styles.planCardHi, isCurrent && styles.planCardCurrent]}>
        <View style={styles.planHeader}>
          <View style={styles.planIcon}>
            <Ionicons name={plan.icon as any} size={22} color={colors.text} />
          </View>
          {isCurrent ? <Text style={styles.activePill}>Активен</Text> : null}
        </View>

        <Text style={styles.planEyebrow}>{plan.eyebrow}</Text>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planPrice}>{plan.price}</Text>
        <Text style={styles.planSummary}>{plan.summary}</Text>

        <View style={styles.featureList}>
          {plan.features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={17} color={colors.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.planBtn, isCurrent ? styles.planBtnDisabled : styles.planBtnActive]}
          onPress={isFree ? selectFreePlan : nativeBillingReady ? () => buyPlanNative(plan.key) : openWebCheckout}
          disabled={isCurrent || saving || buyingPlan !== null}
          activeOpacity={0.9}
        >
          {(saving && isFree) || buyingPlan === plan.key ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text style={[styles.planBtnText, isCurrent ? styles.planBtnTextDisabled : styles.planBtnTextActive]}>
              {isCurrent ? 'Текущий тариф' : isFree ? 'Выбрать базовый' : nativeBillingReady ? 'Оформить подписку' : 'Открыть оплату'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
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

          {nativeBillingReady ? (
            <TouchableOpacity style={styles.noticeBox} onPress={restore} disabled={restoring} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={22} color={colors.text} />
              <Text style={styles.noticeText}>
                {restoring ? 'Проверяем покупки…' : 'Уже оплачивали? Восстановить покупки'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noticeBox}>
              <Ionicons name="card-outline" size={22} color={colors.text} />
              <Text style={styles.noticeText}>
                Оплата в этой сборке открывается через веб-страницу тарифов.
              </Text>
            </View>
          )}

          <View style={styles.planList}>
            {PLANS.map(renderPlan)}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerBtn: { marginRight: 12, padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 12, paddingTop: 14, paddingBottom: 28, gap: 10 },
  statusCard: { borderRadius: 8, backgroundColor: colors.surfaceHi, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  statusLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  statusPlan: { marginTop: 5, color: colors.text, fontSize: 27, fontWeight: '900' },
  statusDate: { marginTop: 5, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  statusStats: { minWidth: 92, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', padding: 11, alignItems: 'flex-end' },
  statusStatValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statusStatLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  statusStatTotal: { marginTop: 8, color: colors.text, fontSize: 13, fontWeight: '900' },
  noticeBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noticeText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  planList: { gap: 10 },
  planCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 },
  planCardHi: { backgroundColor: colors.surfaceHi },
  planCardCurrent: { borderColor: colors.accent, borderWidth: 1.5 },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  activePill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: colors.accent, color: colors.onAccent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  planEyebrow: { marginTop: 15, color: colors.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  planName: { marginTop: 7, color: colors.text, fontSize: 24, fontWeight: '900' },
  planPrice: { marginTop: 5, color: colors.text, fontSize: 18, fontWeight: '900' },
  planSummary: { marginTop: 7, color: colors.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  featureList: { gap: 8, marginTop: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  planBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  planBtnActive: { backgroundColor: colors.accent },
  planBtnDisabled: { backgroundColor: colors.surfaceHi },
  planBtnText: { fontSize: 14, fontWeight: '900' },
  planBtnTextActive: { color: colors.onAccent },
  planBtnTextDisabled: { color: colors.textMuted },
  errorBox: { borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,90,95,0.25)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '800' },
});
