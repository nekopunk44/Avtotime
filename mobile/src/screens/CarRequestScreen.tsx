import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { sendCarRequest } from '../api/carRequests';
import { getDistinctBrands, getDistinctModels, getViewerGeo } from '../api/market';
import { useAuthStore } from '../store/authStore';
import { colors, font, radius, shadow, space } from '../theme';
import { PressableScale, SuggestField } from '../components/ui';

const currentYear = new Date().getFullYear();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function CarRequestScreen() {
  const headerHeight = useHeaderHeight();
  const user = useAuthStore((state) => state.user);
  const initialEmail = String((user as any)?.email || '');
  const initialRegion = user?.region || user?.location || user?.address || '';

  const [marca, setMarca] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [region, setRegion] = useState(initialRegion);
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);
  const [sentMessage, setSentMessage] = useState('');

  // Марки и модели — из того же справочника, что и фильтры маркета: печатать
  // их вслепую больше не нужно.
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    getDistinctBrands('cars').then((list) => { if (alive) setBrands(list); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    getDistinctModels(marca.trim(), 'cars').then((list) => { if (alive) setModels(list); }).catch(() => {});
    return () => { alive = false; };
  }, [marca]);

  const yearError = useMemo(() => {
    if (!year.trim()) return '';
    const parsed = Number(year);
    if (!Number.isInteger(parsed) || parsed < 1980 || parsed > currentYear + 1) {
      return `Год должен быть от 1980 до ${currentYear + 1}`;
    }
    return '';
  }, [year]);

  const emailError = email.trim() && !isValidEmail(email) ? 'Проверьте адрес почты' : '';

  // Чего не хватает — видно до нажатия, а не после отказа.
  const missing = useMemo(() => {
    const gaps: string[] = [];
    if (!marca.trim()) gaps.push('марку');
    if (!model.trim()) gaps.push('модель');
    if (!year.trim()) gaps.push('год');
    if (!region.trim()) gaps.push('регион');
    if (!email.trim()) gaps.push('email');
    return gaps;
  }, [marca, model, year, region, email]);

  const canSend = !missing.length && !yearError && !emailError && !sending;

  const summary = [marca.trim(), model.trim(), year.trim(), region.trim()].filter(Boolean).join(' · ');

  const detectRegion = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const geo = await getViewerGeo();
      if (geo.city) setRegion(geo.city);
      else Alert.alert('Регион', 'Не удалось определить город по вашему подключению.');
    } catch {
      Alert.alert('Регион', 'Не удалось определить город. Проверьте соединение.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!canSend) return;

    setSending(true);
    setSentMessage('');
    try {
      const response = await sendCarRequest({
        marca: marca.trim(),
        model: model.trim(),
        year: year.trim(),
        region: region.trim(),
        email: email.trim(),
      });
      setSentMessage(response.message || 'Заявка отправлена. Проверьте вашу почту.');
      setMarca('');
      setModel('');
      setYear('');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отправить заявку. Попробуйте позже.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {sentMessage ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.successText}>{sentMessage}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <SuggestField
            label="Марка"
            value={marca}
            onChangeText={setMarca}
            onPick={() => setModel('')}
            options={brands}
            placeholder="Например: BMW"
            emptyNote="Подсказки недоступны"
          />

          <SuggestField
            label="Модель"
            value={model}
            onChangeText={setModel}
            options={models}
            placeholder="Например: X5"
            emptyNote={marca.trim() ? `Для «${marca.trim()}» моделей пока нет` : 'Моделей пока нет'}
          />

          <View style={styles.field}>
            <Text style={styles.label}>Год</Text>
            <TextInput
              style={[styles.input, yearError ? styles.inputError : null]}
              placeholder={`${currentYear}`}
              placeholderTextColor={colors.textFaint}
              value={year}
              onChangeText={(value) => setYear(value.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
            />
            {yearError ? <Text style={styles.errorHint}>{yearError}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Регион</Text>
            <View style={[styles.input, styles.inputWithAction]}>
              <TextInput
                style={styles.inputInner}
                placeholder="Город или регион поиска"
                placeholderTextColor={colors.textFaint}
                value={region}
                onChangeText={setRegion}
              />
              <Pressable onPress={detectRegion} hitSlop={10} style={styles.inputAction}>
                {locating
                  ? <ActivityIndicator size="small" color={colors.text} />
                  : <Ionicons name="locate" size={18} color={colors.textMuted} />}
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email для ответа</Text>
            <TextInput
              style={[styles.input, emailError ? styles.inputError : null]}
              placeholder="name@example.com"
              placeholderTextColor={colors.textFaint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {emailError ? <Text style={styles.errorHint}>{emailError}</Text> : null}
          </View>
        </View>

        {summary ? (
          <View style={styles.summaryBox}>
            <Ionicons name="search-outline" size={17} color={colors.textMuted} />
            <Text style={styles.summaryText} numberOfLines={2}>{summary}</Text>
          </View>
        ) : null}

        <PressableScale
          style={[styles.submitBtn, !canSend && styles.submitBtnDisabled]}
          onPress={submit}
          scaleTo={0.98}
        >
          {sending ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.submitText}>Отправить заявку</Text>
          )}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xxxl },

  successBox: {
    marginBottom: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(61,214,140,0.14)',
    padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm,
  },
  successText: { flex: 1, color: colors.success, fontSize: font.small, lineHeight: 19, fontWeight: '800' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg,
    gap: space.lg, ...shadow.card,
  },
  field: { gap: space.sm },
  label: {
    color: colors.textMuted, fontSize: font.tiny, fontWeight: '900',
    marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body,
  },
  inputWithAction: { flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
  inputInner: { flex: 1, height: '100%', color: colors.text, fontSize: font.body, padding: 0 },
  inputAction: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  inputError: { borderColor: colors.danger, backgroundColor: 'rgba(255,90,95,0.12)' },
  errorHint: { color: colors.danger, fontSize: font.tiny, fontWeight: '800', marginLeft: 2 },

  summaryBox: {
    marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, paddingHorizontal: space.md, paddingVertical: space.md,
  },
  summaryText: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '800' },

  submitBtn: {
    marginTop: space.md, height: 52, borderRadius: radius.pill, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
});
