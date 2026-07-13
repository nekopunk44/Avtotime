import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signUp } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { AuthStackParamList } from '../navigation/AuthNavigator';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'> };

export default function SignUpScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  const handleSignUp = async () => {
    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    setLoading(true);
    try {
      const user = await signUp({ name: name.trim(), userName: username.trim(), email: email.trim(), password });
      setUser(user);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Регистрация</Text>

        {[
          { placeholder: 'Имя', value: name, onChange: setName },
          { placeholder: 'Имя пользователя', value: username, onChange: setUsername, lower: true },
          { placeholder: 'Email', value: email, onChange: setEmail, lower: true },
          { placeholder: 'Пароль', value: password, onChange: setPassword, secure: true },
        ].map((field) => (
          <TextInput
            key={field.placeholder}
            style={styles.input}
            placeholder={field.placeholder}
            placeholderTextColor="#999"
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry={field.secure}
            autoCapitalize={field.lower ? 'none' : 'words'}
            autoCorrect={false}
          />
        ))}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Создать аккаунт</Text>
          }
        </TouchableOpacity>

        <Text style={styles.privacyText}>
          Создавая аккаунт, вы соглашаетесь с{' '}
          <Text style={styles.privacyLink} onPress={() => navigation.navigate('PrivacyPolicy')}>
            политикой конфиденциальности
          </Text>
          .
        </Text>

        <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.link}>
            Уже есть аккаунт? <Text style={styles.linkBold}>Войти</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 32, color: '#111' },
  input: {
    width: '100%', height: 52, borderWidth: 2, borderColor: '#111',
    borderRadius: 16, paddingHorizontal: 18, fontSize: 15,
    marginBottom: 14, color: '#111', backgroundColor: '#fff',
  },
  btn: {
    width: '100%', height: 52, backgroundColor: '#111',
    borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  privacyText: { width: '100%', color: '#777', fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 18 },
  privacyLink: { color: '#111', fontWeight: '800', textDecorationLine: 'underline' },
  link: { color: '#555', fontSize: 14 },
  linkBold: { color: '#111', fontWeight: '700', textDecorationLine: 'underline' },
});
