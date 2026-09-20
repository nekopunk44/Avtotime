import React, { useCallback, useMemo, useState } from 'react';
import { askConfirm } from '../store/confirmStore';
import { showToast } from '../store/toastStore';
import {
  ActivityIndicator,
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
  isStoreUnavailable,
  purchasePlan,
  restoreStorePurchases,
} from '../billing/storePurchase';
import { Platform } from 'react-native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors, font, radius, shadow, space } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'Billing'> };

type PlanCard = {
  key: PlanKey;
  name: string;
  price: string;
  /** Период рисуется мельче цены: «29 EUR» и «/ мес» — разного веса. */
  period?: string;
  eyebrow: string;
  summary: string;
  icon: string;
  /** Тариф, который стоит советовать: получает рамку и пометку. */
  highlight?: boolean;
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
    price: '29 €',
    period: 'в месяц',
    highlight: true,
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
    price: '79 €',
    period: 'в месяц',
    eyebrow: 'Для автосалонов',
    summary: 'Максимальный лимит, топ-приоритет и расширенные карточки.',
    icon: 'business-outline',
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

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const [storeConfig, setStoreConfig] = useState<StoreBillingConfig | null>(null);
  const [buyingPlan, setBuyingPlan] = useState<PlanKey | null>(null);
  const [restoring, setRestoring] = useState(false);
  // Сборка без нативного модуля стора выясняется только при попытке покупки:
  // трогать модуль на рендере нельзя — он бросает, если его нет в сборке.
  const [storeMissing, setStoreMissing] = useState(false);

  useFocusEffect(useCallback(() => {
    getStoreBillingConfig().then(setStoreConfig).catch(() => setStoreConfig(null));
  }, []));

  const nativeBillingReady =
    !storeMissing &&
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
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
      showToast(`Тариф «${PLAN_LABEL[String(result.effectivePlan)] || result.effectivePlan}» активирован.`, 'success');
    } catch (e: any) {
      if (isStoreUnavailable(e)) {
        // Не техническое сообщение в лицо: молча переключаемся на веб-оплату.
        setStoreMissing(true);
        askConfirm({
          title: 'Оплата',
          message: 'В этой сборке приложения покупка через стор недоступна. Откроем страницу оплаты.',
          confirmLabel: 'Открыть',
          cancelLabel: 'Отмена',
        }).then((agreed) => { if (agreed) (openWebCheckout)(); });
      } else if (!isCancelled(e)) {
        showToast(e?.response?.data?.message || e?.message || 'Покупка не прошла');
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
        showToast('Подписка восстановлена.', 'success');
      } else {
        showToast('Активных покупок в сторе не найдено.');
      }
    } catch (e: any) {
      if (isStoreUnavailable(e)) {
        setStoreMissing(true);
        showToast('В этой сборке приложения покупки стора недоступны.');
      } else {
        showToast(e?.response?.data?.message || e?.message || 'Не удалось восстановить покупки');
      }
    } finally {
      setRestoring(false);
    }
  };

  const openWebCheckout = async () => {
    const canOpen = await Linking.canOpenURL(WEB_TARIFFS_URL);
    if (!canOpen) {
      showToast('Не удалось открыть страницу оплаты на этом устройстве.', 'error');
      return;
    }
    await Linking.openURL(WEB_TARIFFS_URL);
  };

  const selectFreePlan = () => {
    if (activePlan === 'free') return;

    askConfirm({
      title: 'Перейти на базовый тариф?',
      message: 'Платные возможности и приоритет объявлений будут отключены.',
      confirmLabel: 'Перейти',
      cancelLabel: 'Отмена',
      destructive: true,
    }).then((agreed) => { if (agreed) (async () => {
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
              showToast('Базовый тариф активирован.', 'success');
            } catch (e: any) {
              showToast(e.response?.data?.message || 'Не удалось сменить тариф', 'error');
            } finally {
              setSaving(false);
            }
          })(); });
  };

  const renderPlan = (plan: PlanCard) => {
    const isCurrent = activePlan === plan.key;
    const isFree = plan.key === 'free';
    const suggested = plan.highlight && !isCurrent;

    return (
      <View
        key={plan.key}
        style={[styles.planCard, isCurrent && styles.planCardCurrent, suggested && styles.planCardSuggested]}
      >
        {/* Значок, название и цена — одной строкой: раньше карточка занимала
            экран целиком, и тарифы нельзя было сравнить взглядом. */}
        <View style={styles.planHeader}>
          <View style={[styles.planIcon, suggested && styles.planIconSuggested]}>
            <Ionicons name={plan.icon as any} size={20} color={suggested ? colors.onAccent : colors.text} />
          </View>
          <View style={styles.planTitles}>
            <Text style={styles.planEyebrow}>{plan.eyebrow}</Text>
            <Text style={styles.planName}>{plan.name}</Text>
          </View>
          <View style={styles.planPriceWrap}>
            <Text style={styles.planPrice}>{plan.price}</Text>
            {plan.period ? <Text style={styles.planPeriod}>{plan.period}</Text> : null}
          </View>
        </View>

        {isCurrent || suggested ? (
          <Text style={[styles.pill, suggested && styles.pillSuggested]}>
            {isCurrent ? 'Ваш тариф' : 'Советуем'}
          </Text>
        ) : null}

        <Text style={styles.planSummary}>{plan.summary}</Text>

        <View style={styles.featureList}>
          {plan.features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark" size={14} color={suggested ? colors.text : colors.textFaint} />
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
              {isCurrent ? 'Подключён' : isFree ? 'Перейти на базовый' : nativeBillingReady ? 'Оформить подписку' : 'Открыть оплату'}
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
            <Text style={styles.statusLabel}>Ваш тариф</Text>
            <Text style={styles.statusPlan}>{currentPlanLabel}</Text>
            <Text style={styles.statusDate}>Действует до: {formatDate(status.planExpiresAt)}</Text>

            {/* Счётчики строкой с разделителем: вложенная плашка «0 оплат /
                0.00 €» читалась как поломка вёрстки. */}
            <View style={styles.statusStats}>
              <View style={styles.statusStat}>
                <Text style={styles.statusStatValue}>{successfulPayments.length}</Text>
                <Text style={styles.statusStatLabel}>оплат</Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusStat}>
                <Text style={styles.statusStatValue}>
                  {formatAmount(totalPaid, successfulPayments[0]?.currency || 'eur')}
                </Text>
                <Text style={styles.statusStatLabel}>потрачено</Text>
              </View>
              <View style={styles.statusDivider} />
              <TouchableOpacity
                style={styles.statusStat}
                onPress={() => navigation.navigate('PaymentHistory')}
                activeOpacity={0.8}
              >
                <Ionicons name="receipt-outline" size={19} color={colors.text} />
                <Text style={styles.statusStatLabel}>история</Text>
              </TouchableOpacity>
            </View>
          </View>

          {nativeBillingReady ? (
            <TouchableOpacity style={styles.noticeBox} onPress={restore} disabled={restoring} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
              <Text style={styles.noticeText}>
                {restoring ? 'Проверяем покупки…' : 'Уже оплачивали? Восстановить покупки'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noticeBox}>
              <Ionicons name="card-outline" size={18} color={colors.textMuted} />
              <Text style={styles.noticeText}>Оплата откроется на веб-странице тарифов</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: space.md, paddingBottom: space.xxl, gap: space.sm },

  statusCard: {
    borderRadius: radius.lg, backgroundColor: colors.surface,
    padding: space.lg, ...shadow.card,
  },
  statusLabel: {
    color: colors.textFaint, fontSize: font.tiny, fontWeight: '900',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  statusPlan: { marginTop: 4, color: colors.text, fontSize: font.display, fontWeight: '900' },
  statusDate: { marginTop: 4, color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  statusStats: {
    flexDirection: 'row', alignItems: 'center', marginTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.md,
  },
  statusStat: { flex: 1, alignItems: 'center', gap: 3 },
  statusDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.border },
  statusStatValue: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  statusStatLabel: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '800' },

  noticeBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
  },
  noticeText: { flex: 1, color: colors.textMuted, fontSize: font.tiny, lineHeight: 17, fontWeight: '700' },

  planList: { gap: space.sm },
  planCard: {
    borderRadius: radius.lg, backgroundColor: colors.surface,
    padding: space.md, ...shadow.card,
  },
  planCardCurrent: { borderColor: colors.accent, borderWidth: 1 },
  planCardSuggested: { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceHi, borderWidth: 1 },

  planHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  planIcon: {
    width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  planIconSuggested: { backgroundColor: colors.accent },
  planTitles: { flex: 1 },
  planEyebrow: {
    color: colors.textFaint, fontSize: 10, fontWeight: '900',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  planName: { marginTop: 2, color: colors.text, fontSize: font.h3, fontWeight: '900' },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: { color: colors.text, fontSize: font.h2, fontWeight: '900' },
  planPeriod: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },

  pill: {
    alignSelf: 'flex-start', overflow: 'hidden', marginTop: space.md,
    borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4,
    backgroundColor: colors.surfaceHi, color: colors.text,
    fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4,
  },
  pillSuggested: { backgroundColor: colors.accent, color: colors.onAccent },

  planSummary: {
    marginTop: space.md, color: colors.textMuted,
    fontSize: font.small, lineHeight: 19, fontWeight: '600',
  },
  featureList: { gap: 6, marginTop: space.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  featureText: { flex: 1, color: colors.textMuted, fontSize: font.small, lineHeight: 18, fontWeight: '700' },

  planBtn: {
    height: 48, borderRadius: radius.md, alignItems: 'center',
    justifyContent: 'center', marginTop: space.md,
  },
  planBtnActive: { backgroundColor: colors.accent },
  planBtnDisabled: { backgroundColor: colors.surfaceHi },
  planBtnText: { fontSize: font.small, fontWeight: '900' },
  planBtnTextActive: { color: colors.onAccent },
  planBtnTextDisabled: { color: colors.textMuted },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.lg, backgroundColor: 'rgba(255,90,95,0.12)', padding: space.md,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: font.small, fontWeight: '800' },
});
