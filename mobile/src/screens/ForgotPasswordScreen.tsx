import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import client from '../api/client';

type Step = 'email' | 'otp' | 'password' | 'done';

const OTP_LENGTH = 6;

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.otpRow}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <View key={i} style={[styles.otpBox, value.length === i && styles.otpBoxActive]}>
          <Text style={styles.otpDigit}>{value[i] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        style={styles.otpOverlay}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus
        caretHidden
      />
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const showError = (fallback: string, e: any) => {
    Alert.alert('Ошибка', e.response?.data?.message || fallback);
  };

  const handleSendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { Alert.alert('Ошибка', 'Введите email'); return; }

    setLoading(true);
    try {
      await client.post('/auth/sendOtp', { email: normalizedEmail });
      setEmail(normalizedEmail);
      setStep('otp');
    } catch (e: any) {
      showError('Не удалось отправить код', e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) { Alert.alert('Ошибка', 'Введите код из письма'); return; }

    setLoading(true);
    try {
      await client.post('/auth/verifyOtp', { email, otp: otp.trim() });
      setStep('password');
    } catch (e: any) {
      showError('Неверный или просроченный код', e);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) {
      Alert.alert('Ошибка', 'Пароль должен быть не короче 8 символов');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await client.post('/auth/resetPassword', { email, password });
      setStep('done');
    } catch (e: any) {
      showError('Не удалось изменить пароль', e);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Пароль изменен</Text>
          <Text style={styles.sub}>Теперь можно вернуться на экран входа и войти с новым паролем.</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.title}>
          {step === 'email' ? 'Забыли пароль?' : step === 'otp' ? 'Введите код' : 'Новый пароль'}
        </Text>
        <Text style={styles.sub}>
          {step === 'email'
            ? 'Введите email, и мы отправим код подтверждения'
            : step === 'otp'
              ? `Код отправлен на ${email}`
              : 'Придумайте новый пароль для аккаунта'}
        </Text>

        {step === 'email' && (
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        )}

        {step === 'otp' && <OtpBoxes value={otp} onChange={setOtp} />}

        {step === 'password' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Новый пароль"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Повторите пароль"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={step === 'email' ? handleSendOtp : step === 'otp' ? handleVerifyOtp : handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {step === 'email' ? 'Отправить код' : step === 'otp' ? 'Подтвердить код' : 'Сохранить пароль'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, color: '#111', textAlign: 'center' },
  sub: { fontSize: 14, color: '#666', marginBottom: 28, textAlign: 'center', lineHeight: 20 },
  input: {
    width: '100%', height: 52, borderWidth: 2, borderColor: '#111',
    borderRadius: 16, paddingHorizontal: 18, fontSize: 15, marginBottom: 14, color: '#111',
  },
  btn: {
    width: '100%', height: 52, backgroundColor: '#111',
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 18, position: 'relative' },
  otpBox: {
    width: 48, height: 58, borderWidth: 2, borderColor: '#ddd', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa',
  },
  otpBoxActive: { borderColor: '#111', backgroundColor: '#fff' },
  otpDigit: { fontSize: 24, fontWeight: '800', color: '#111' },
  otpOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: 'transparent' },
});
