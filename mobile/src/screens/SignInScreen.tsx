import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signIn, signInWithGoogleCredential } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { AuthStackParamList } from '../navigation/AuthNavigator';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'SignIn'> };

const googleWebClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;
const isExpoGo = Constants.appOwnership === 'expo';

// Native Google Sign-In: the id_token audience is the web client, while the
// Android OAuth client is matched automatically by package name + signing SHA-1.
if (googleWebClientId && !isExpoGo) {
  GoogleSignin.configure({ webClientId: googleWebClientId });
}

export default function SignInScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      const message = e.response?.data?.message || 'Не удалось войти';
      Alert.alert(
        'Ошибка',
        message.includes('Illegal arguments')
          ? 'Для этого аккаунта пароль не задан. Восстановите пароль по email.'
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isExpoGo) {
      Alert.alert(
        'Google вход недоступен в Expo Go',
        'Google блокирует OAuth в Expo Go/WebView из-за политики безопасности. Для Google входа нужен development build или локальная native-сборка.'
      );
      return;
    }

    if (!googleWebClientId) {
      Alert.alert('Ошибка', 'Google Client ID не настроен в app.json');
      return;
    }

    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (!idToken) {
          Alert.alert('Ошибка', 'Google не вернул токен. Попробуйте ещё раз.');
          return;
        }
        const user = await signInWithGoogleCredential(idToken);
        setUser(user);
      }
      // response.type === 'cancelled' — пользователь закрыл окно, ничего не делаем
    } catch (e: any) {
      if (isErrorWithCode(e) && (e.code === statusCodes.IN_PROGRESS || e.code === statusCodes.SIGN_IN_CANCELLED)) return;
      Alert.alert('Ошибка', e?.response?.data?.message || e?.message || 'Google вход не удался');
    } finally {
      setGoogleLoading(false);
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

        <TouchableOpacity
          style={[styles.googleBtn, (googleLoading || isExpoGo) && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading
            ? <ActivityIndicator color="#111" />
            : (
              <>
                <Text style={styles.googleMark}>G</Text>
                <Text style={styles.googleText}>Войти через Google</Text>
              </>
            )
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
  googleBtn: {
    width: '100%', height: 52, backgroundColor: '#fff',
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', flexDirection: 'row', gap: 10,
    marginBottom: 20,
  },
  googleMark: { color: '#4285f4', fontWeight: '800', fontSize: 18 },
  googleText: { color: '#111', fontWeight: '700', fontSize: 15 },
  link: { color: '#555', fontSize: 14 },
  linkBold: { color: '#111', fontWeight: '700', textDecorationLine: 'underline' },
});
