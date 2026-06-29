import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import client from '../api/client';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) { Alert.alert('Ошибка', 'Введите email'); return; }
    setLoading(true);
    try {
      await client.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отправить письмо');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Письмо отправлено</Text>
        <Text style={styles.sub}>Проверьте {email} и следуйте инструкциям</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.title}>Забыли пароль?</Text>
        <Text style={styles.sub}>Введите email и мы отправим инструкции</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSend} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Отправить</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, color: '#111' },
  sub: { fontSize: 14, color: '#666', marginBottom: 28, textAlign: 'center' },
  input: {
    width: '100%', height: 52, borderWidth: 2, borderColor: '#111',
    borderRadius: 16, paddingHorizontal: 18, fontSize: 15, marginBottom: 14, color: '#111',
  },
  btn: {
    width: '100%', height: 52, backgroundColor: '#111',
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
