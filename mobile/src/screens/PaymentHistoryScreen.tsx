import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getBillingStatus, PaymentRow } from '../api/billing';
import { colors } from '../theme';

const PLAN_LABEL: Record<string, string> = {
  free: 'Базовый',
  pro: 'Pro Seller',
  business: 'Business',
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  succeeded: { label: 'Оплачен', color: colors.success, bg: 'rgba(61,214,140,0.15)' },
  pending: { label: 'В обработке', color: colors.warning, bg: 'rgba(246,178,61,0.15)' },
  failed: { label: 'Ошибка', color: colors.danger, bg: 'rgba(255,90,95,0.14)' },
  refunded: { label: 'Возврат', color: colors.textMuted, bg: colors.surfaceAlt },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Нет даты';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Нет даты';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatAmount = (amount: number, currency?: string) => {
  const code = (currency || 'eur').toUpperCase();
  const value = (Number(amount || 0) / 100).toFixed(2);
  if (code === 'EUR') return `${value} €`;
  if (code === 'USD') return `$${value}`;
  return `${value} ${code}`;
};

export default function PaymentHistoryScreen() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const status = await getBillingStatus();
      setPayments(status.payments || []);
    } catch {
      // Keep the current list; pull-to-refresh retries.
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
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>;
  }

  if (!payments.length) {
    return (
      <View style={styles.emptyCenter}>
        <Ionicons name="receipt-outline" size={42} color={colors.textFaint} />
        <Text style={styles.emptyTitle}>Платежей пока нет</Text>
        <Text style={styles.emptyText}>После оплаты Pro или Business операции появятся здесь.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {payments.map((payment, index) => {
        const statusInfo = STATUS_LABEL[payment.status] || { label: payment.status, color: colors.textMuted, bg: colors.surfaceAlt };
        const planLabel = PLAN_LABEL[payment.plan] || payment.plan;
        return (
          <View key={payment._id || `${payment.createdAt}-${index}`} style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name={payment.plan === 'business' ? 'business-outline' : 'sparkles-outline'} size={20} color={colors.text} />
            </View>
            <View style={styles.info}>
              <Text style={styles.rowTitle}>{planLabel}</Text>
              <Text style={styles.date}>{formatDateTime(payment.createdAt)}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>{formatAmount(payment.amount, payment.currency)}</Text>
              <Text style={[styles.statusPill, { color: statusInfo.color, backgroundColor: statusInfo.bg }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12, paddingBottom: 28, gap: 9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, paddingHorizontal: 32 },
  emptyTitle: { marginTop: 12, color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  row: { minHeight: 70, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  date: { marginTop: 3, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { color: colors.text, fontSize: 14, fontWeight: '900' },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
});
