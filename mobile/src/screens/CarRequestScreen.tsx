import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendCarRequest } from '../api/carRequests';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

const REGION_PRESETS = ['Кишинев', 'Бельцы', 'Кагул', 'Орхей', 'Комрат', 'Любой регион'];

const currentYear = new Date().getFullYear();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function CarRequestScreen() {
  const user = useAuthStore((state) => state.user);
  const initialEmail = String((user as any)?.email || '');
  const initialRegion = user?.region || user?.location || user?.address || '';

  const [marca, setMarca] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [region, setRegion] = useState(initialRegion);
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState('');

  const yearError = useMemo(() => {
    if (!year.trim()) return '';
    const parsed = Number(year);
    if (!Number.isInteger(parsed) || parsed < 1980 || parsed > currentYear + 1) {
      return `Год должен быть от 1980 до ${currentYear + 1}`;
    }
    return '';
  }, [year]);

  const resetVehicleFields = () => {
    setMarca('');
    setModel('');
    setYear('');
  };

  const submit = async () => {
    const next = {
      marca: marca.trim(),
      model: model.trim(),
      year: year.trim(),
      region: region.trim(),
      email: email.trim(),
    };

    if (!next.marca || !next.model || !next.year || !next.region || !next.email) {
      Alert.alert('Заявка на авто', 'Заполните марку, модель, год, регион и email.');
      return;
    }

    if (yearError) {
      Alert.alert('Заявка на авто', yearError);
      return;
    }

    if (!isValidEmail(next.email)) {
      Alert.alert('Заявка на авто', 'Введите корректный email.');
      return;
    }

    setSending(true);
    setSentMessage('');
    try {
      const response = await sendCarRequest(next);
      setSentMessage(response.message || 'Заявка отправлена. Проверьте вашу почту.');
      resetVehicleFields();
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
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="car-sport-outline" size={30} color={colors.text} />
          </View>
          <Text style={styles.title}>Подбор автомобиля</Text>
          <Text style={styles.subtitle}>Оставьте параметры, и команда Avtotime свяжется с вами по email.</Text>
        </View>

        {sentMessage ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#15803d" />
            <Text style={styles.successText}>{sentMessage}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Автомобиль</Text>

          <Text style={styles.inputLabel}>Марка</Text>
          <TextInput
            style={styles.input}
            placeholder="Например: BMW"
            placeholderTextColor={colors.textFaint}
            value={marca}
            onChangeText={setMarca}
            autoCapitalize="words"
          />

          <Text style={styles.inputLabel}>Модель</Text>
          <TextInput
            style={styles.input}
            placeholder="Например: X5"
            placeholderTextColor={colors.textFaint}
            value={model}
            onChangeText={setModel}
            autoCapitalize="words"
          />

          <Text style={styles.inputLabel}>Год</Text>
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

          <Text style={styles.inputLabel}>Регион</Text>
          <TextInput
            style={styles.input}
            placeholder="Город или регион поиска"
            placeholderTextColor={colors.textFaint}
            value={region}
            onChangeText={setRegion}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionChips}>
            {REGION_PRESETS.map((item) => {
              const active = region === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.regionChip, active && styles.regionChipActive]}
                  onPress={() => setRegion(item)}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.regionChipText, active && styles.regionChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Контакт</Text>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor={colors.textFaint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TouchableOpacity
            style={[styles.submitBtn, sending && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={sending}
            activeOpacity={0.9}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={19} color="#fff" />
                <Text style={styles.submitText}>Отправить заявку</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
          <Text style={styles.infoText}>Backend отправит заявку администратору и письмо-подтверждение на указанный email.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 30 },
  header: { alignItems: 'center', paddingTop: 10, paddingBottom: 20 },
  headerIcon: { width: 62, height: 62, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 12, color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 5, color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  successBox: { marginBottom: 12, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  successText: { flex: 1, color: '#166534', fontSize: 13, lineHeight: 19, fontWeight: '800' },
  formCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 },
  inputLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { minHeight: 48, borderRadius: 10, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text, fontSize: 15, marginBottom: 13 },
  inputError: { borderWidth: 1, borderColor: colors.danger, backgroundColor: '#fff7f7' },
  errorHint: { color: '#b91c1c', fontSize: 12, fontWeight: '800', marginTop: -7, marginBottom: 12 },
  regionChips: { gap: 8, paddingBottom: 2 },
  regionChip: { height: 36, borderRadius: 10, paddingHorizontal: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  regionChipActive: { backgroundColor: colors.surfaceHi, borderColor: '#111' },
  regionChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  regionChipTextActive: { color: '#fff' },
  submitBtn: { marginTop: 2, height: 50, borderRadius: 12, backgroundColor: colors.surfaceHi, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  infoBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
});
