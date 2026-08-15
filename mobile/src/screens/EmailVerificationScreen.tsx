import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getMe, resendVerificationEmail, verifyEmailToken } from '../api/auth';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'EmailVerification'> };

const extractToken = (value: string) => {
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  const match = trimmed.match(/[?&]token=([^&#]+)/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return trimmed;
};

export default function EmailVerificationScreen({ navigation }: Props) {
  const { user, setUser } = useAuthStore();
  const [tokenValue, setTokenValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastMessage, setLastMessage] = useState('');

  const refreshUser = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const freshUser = await getMe();
      setUser(freshUser);
      return freshUser;
    } catch (e: any) {
      Alert.alert('Email', e.response?.data?.message || 'Не удалось обновить статус email');
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [setUser]);

  const handleResend = async () => {
    setSending(true);
    setLastMessage('');
    try {
      const response = await resendVerificationEmail();
      setLastMessage(response.message || 'Письмо отправлено');
      Alert.alert('Email', response.message || 'Письмо отправлено');
    } catch (e: any) {
      const message = e.response?.data?.message || 'Не удалось отправить письмо';
      setLastMessage(message);
      Alert.alert('Email', message);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    const token = extractToken(tokenValue);
    if (!token) {
      Alert.alert('Email', 'Вставьте token или ссылку подтверждения из письма.');
      return;
    }

    setLoading(true);
    setLastMessage('');
    try {
      const response = await verifyEmailToken(token);
      setLastMessage(response.message || 'Email подтверждён');
      const freshUser = await refreshUser(true);
      Alert.alert('Email', response.message || 'Email подтверждён', [
        {
          text: 'OK',
          onPress: () => {
            if (freshUser?.isEmailVerified) navigation.goBack();
          },
        },
      ]);
    } catch (e: any) {
      const message = e.response?.data?.message || 'Ссылка недействительна или истекла';
      setLastMessage(message);
      Alert.alert('Email', message);
    } finally {
      setLoading(false);
    }
  };

  const verified = !!user?.isEmailVerified;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => refreshUser()} tintColor={colors.accent} />
        }
      >
        <Text style={styles.intro}>
          {verified
            ? 'Email подтверждён. Можно публиковать посты, loops и объявления.'
            : 'Подтвердите email, чтобы создавать посты, loops, объявления и заявки.'}
        </Text>

        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View>
              <Text style={styles.statusLabel}>Текущий email</Text>
              <Text style={styles.emailText}>{user?.email || 'Email не указан'}</Text>
            </View>
            <View style={[styles.statusPill, verified ? styles.statusPillOk : styles.statusPillWarn]}>
              <Text style={[styles.statusPillText, verified ? styles.statusPillTextOk : styles.statusPillTextWarn]}>
                {verified ? 'Подтверждён' : 'Не подтверждён'}
              </Text>
            </View>
          </View>

          {lastMessage ? (
            <View style={styles.messageBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.text} />
              <Text style={styles.messageText}>{lastMessage}</Text>
            </View>
          ) : null}
        </View>

        {!verified ? (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, sending && styles.disabled]}
              onPress={handleResend}
              disabled={sending}
              activeOpacity={0.86}
            >
              {sending ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color={colors.onAccent} />
                  <Text style={styles.primaryText}>Отправить письмо ещё раз</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Подтвердить вручную</Text>
              <Text style={styles.formHint}>
                Если письмо открылось на сайте или в браузере, вставьте сюда ссылку целиком либо значение после token=.
              </Text>
              <TextInput
                style={styles.input}
                value={tokenValue}
                onChangeText={setTokenValue}
                placeholder="https://avtotime.org/verify-email?token=..."
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <TouchableOpacity
                style={[styles.verifyBtn, loading && styles.disabled]}
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.86}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <>
                    <Ionicons name="checkmark-outline" size={18} color={colors.onAccent} />
                    <Text style={styles.verifyText}>Проверить token</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.86}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={styles.doneText}>Вернуться назад</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 14 },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statusLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  emailText: { marginTop: 4, color: colors.text, fontSize: 16, fontWeight: '900' },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusPillOk: { backgroundColor: 'rgba(61,214,140,0.14)' },
  statusPillWarn: { backgroundColor: 'rgba(246,178,61,0.14)' },
  statusPillText: { fontSize: 11, fontWeight: '900' },
  statusPillTextOk: { color: colors.success },
  statusPillTextWarn: { color: colors.warning },
  messageBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  messageText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 10,
  },
  primaryText: { color: colors.onAccent, fontSize: 15, fontWeight: '900' },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
  },
  formTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  formHint: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  input: {
    minHeight: 86,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  verifyBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
  },
  verifyText: { color: colors.onAccent, fontSize: 15, fontWeight: '900' },
  doneBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  doneText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
