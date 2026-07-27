import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, Animated, Easing, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signUp } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import SpeedLines from '../components/SpeedLines';
import LottieLogo, { lottieAvailable } from '../components/LottieLogo';
import { colors, font, radius, shadow, space } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'> };

export default function SignUpScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  const sheetY = useRef(new Animated.Value(48)).current;
  const carScale = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(carScale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
    ]).start();
  }, [sheetY, carScale]);

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

  const fields = [
    { placeholder: 'Имя', value: name, onChange: setName },
    { placeholder: 'Имя пользователя', value: username, onChange: setUsername, lower: true },
    { placeholder: 'Email', value: email, onChange: setEmail, lower: true },
    { placeholder: 'Пароль', value: password, onChange: setPassword, secure: true },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        {!lottieAvailable ? <SpeedLines /> : null}
        <LottieLogo style={styles.heroCar} />
      </View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Создать аккаунт</Text>
            <Text style={styles.subtitle}>Присоединяйтесь к сообществу Avtotime</Text>

            {fields.map((field) => (
              field.secure ? (
                <View key={field.placeholder} style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textFaint}
                    value={field.value}
                    onChangeText={field.onChange}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    selectionColor={colors.accent}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TextInput
                  key={field.placeholder}
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textFaint}
                  value={field.value}
                  onChangeText={field.onChange}
                  autoCapitalize={field.lower ? 'none' : 'words'}
                  autoCorrect={false}
                  selectionColor={colors.accent}
                />
              )
            ))}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.btnText}>Создать аккаунт</Text>}
            </TouchableOpacity>

            <Text style={styles.privacyText}>
              Создавая аккаунт, вы соглашаетесь с{' '}
              <Text style={styles.privacyLink} onPress={() => navigation.navigate('PrivacyPolicy')}>
                политикой конфиденциальности
              </Text>
              .
            </Text>

            <TouchableOpacity style={styles.signinLink} onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.link}>
                Уже есть аккаунт? <Text style={styles.linkBold}>Войти</Text>
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
  hero: { height: 240, alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
  heroCar: { width: 250, height: 190 },
  brand: { color: colors.white, fontSize: font.h2, fontWeight: '900', letterSpacing: 4, marginTop: space.sm },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  flex: { flex: 1 },
  form: { padding: space.xl, paddingTop: space.xxl, paddingBottom: space.xl },
  title: { fontSize: font.h1, fontWeight: '900', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: font.small, color: colors.textMuted, marginTop: 4, marginBottom: space.xl, fontWeight: '600', textAlign: 'center' },
  input: {
    width: '100%', height: 54, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: 16, fontSize: font.body, marginBottom: space.md, color: colors.text,
  },
  passwordWrap: {
    width: '100%', height: 54, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: 16, marginBottom: space.md, flexDirection: 'row', alignItems: 'center',
  },
  passwordInput: { flex: 1, height: '100%', fontSize: font.body, color: colors.text },
  eyeBtn: { paddingLeft: 12, paddingVertical: 6 },
  btn: { width: '100%', height: 54, backgroundColor: colors.accent, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginTop: space.xs, ...shadow.card },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.onAccent, fontWeight: '900', fontSize: font.body },
  privacyText: { width: '100%', color: colors.textMuted, fontSize: font.tiny, lineHeight: 17, textAlign: 'center', marginTop: space.lg, marginBottom: space.md },
  privacyLink: { color: colors.accent, fontWeight: '800' },
  signinLink: { alignSelf: 'center', marginTop: space.sm },
  link: { color: colors.textMuted, fontSize: font.small },
  linkBold: { color: colors.accent, fontWeight: '900' },
});
