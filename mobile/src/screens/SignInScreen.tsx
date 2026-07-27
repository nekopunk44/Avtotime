import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, Animated, Easing, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import Constants from 'expo-constants';
import SpeedLines from '../components/SpeedLines';
import { colors, font, radius, shadow, space } from '../theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signIn, signInWithGoogleCredential } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { AuthStackParamList } from '../navigation/AuthNavigator';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'SignIn'> };

const googleWebClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;
const isExpoGo = Constants.appOwnership === 'expo';

// Google Sign-In pulls in a native TurboModule (RNGoogleSignin) the moment it
// is imported, and that module doesn't exist in Expo Go. Lazily require it only
// outside Expo Go so the app boots there; Google login needs a dev/prod build.
const GoogleSignInModule: typeof import('@react-native-google-signin/google-signin') | null =
  isExpoGo ? null : require('@react-native-google-signin/google-signin');

// Native Google Sign-In: the id_token audience is the web client, while the
// Android OAuth client is matched automatically by package name + signing SHA-1.
if (GoogleSignInModule && googleWebClientId) {
  GoogleSignInModule.GoogleSignin.configure({ webClientId: googleWebClientId });
}

export default function SignInScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  // Entrance: the form sheet slides up while the car settles — a smooth
  // hand-off from the dark splash (same black background + car).
  const sheetY = useRef(new Animated.Value(48)).current;
  const carScale = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(carScale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
    ]).start();
  }, [sheetY, carScale]);

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
    if (!GoogleSignInModule) return;
    const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = GoogleSignInModule;

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
    <View style={styles.container}>
      <View style={styles.hero}>
        <SpeedLines style={styles.heroSpeed} />
        <Animated.Image
          source={require('../../assets/splash-icon.png')}
          style={[styles.heroCar, { transform: [{ scale: carScale }] }]}
          resizeMode="contain"
        />
        <Text style={styles.brand}>AVTOTIME</Text>
      </View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>С возвращением</Text>
            <Text style={styles.subtitle}>Войдите в аккаунт Avtotime</Text>

            <TextInput
              style={styles.input}
              placeholder="Имя пользователя или email"
              placeholderTextColor={colors.textFaint}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              selectionColor={colors.accent}
            />
            <TextInput
              style={styles.input}
              placeholder="Пароль"
              placeholderTextColor={colors.textFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              selectionColor={colors.accent}
            />

            <TouchableOpacity style={styles.forgotBtn} onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotText}>Забыли пароль?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.btnText}>Войти</Text>}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>или</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, (googleLoading || isExpoGo) && styles.btnDisabled]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              activeOpacity={0.9}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Text style={styles.googleMark}>G</Text>
                  <Text style={styles.googleText}>Войти через Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.signupLink} onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.link}>
                Нет аккаунта? <Text style={styles.linkBold}>Зарегистрироваться</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  hero: { height: 300, alignItems: 'center', justifyContent: 'center', paddingTop: 24 },
  heroSpeed: {},
  heroCar: { width: 240, height: 150 },
  brand: { color: colors.white, fontSize: font.h2, fontWeight: '900', letterSpacing: 4, marginTop: space.sm },
  sheet: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, overflow: 'hidden' },
  flex: { flex: 1 },
  form: { padding: space.xl, paddingTop: space.xxl, paddingBottom: space.xl },
  title: { fontSize: font.h1, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: font.small, color: colors.textMuted, marginTop: 4, marginBottom: space.xl, fontWeight: '600' },
  input: {
    width: '100%', height: 54, backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: 16, fontSize: font.body, marginBottom: space.md, color: colors.text, ...shadow.card,
  },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: space.lg, paddingVertical: 4 },
  forgotText: { color: colors.accent, fontSize: font.small, fontWeight: '800' },
  btn: { width: '100%', height: 54, backgroundColor: colors.accent, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', ...shadow.card },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.onAccent, fontWeight: '900', fontSize: font.body },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: space.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, fontSize: font.small, fontWeight: '700' },
  googleBtn: { width: '100%', height: 54, backgroundColor: colors.surface, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10, ...shadow.card },
  googleMark: { color: '#4285f4', fontWeight: '900', fontSize: 18 },
  googleText: { color: colors.text, fontWeight: '800', fontSize: font.body },
  signupLink: { alignSelf: 'center', marginTop: space.xl },
  link: { color: colors.textMuted, fontSize: font.small },
  linkBold: { color: colors.accent, fontWeight: '900' },
});
