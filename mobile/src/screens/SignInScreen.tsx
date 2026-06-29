import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signIn } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { AuthStackParamList } from '../navigation/AuthNavigator';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'SignIn'> };

export default function SignInScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  const handleSignIn = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    setLoading(true);
    try {
      const user = await signIn(identifier.trim(), password);
      setUser(user);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Вход</Text>

        <TextInput
          style={styles.input}
          placeholder="Имя пользователя или email"
          placeholderTextColor="#999"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.forgotBtn}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgotText}>Забыли пароль?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Войти</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.link}>
            Нет аккаунта? <Text style={styles.linkBold}>Зарегистрироваться</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 32, color: '#111' },
  input: {
    width: '100%', height: 52, borderWidth: 2, borderColor: '#111',
    borderRadius: 16, paddingHorizontal: 18, fontSize: 15,
    marginBottom: 14, color: '#111', backgroundColor: '#fff',
  },
  forgotBtn: { alignSelf: 'center', marginBottom: 20 },
  forgotText: { color: '#555', fontSize: 14 },
  btn: {
    width: '100%', height: 52, backgroundColor: '#111',
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: '#555', fontSize: 14 },
  linkBold: { color: '#111', fontWeight: '700', textDecorationLine: 'underline' },
});
