import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useHeaderHeight } from '@react-navigation/elements';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  createServiceListing,
  createVehicleListing,
  getMarketCategory,
  MARKET_CATEGORIES,
  MarketCategoryId,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'CreateMarketListing'> };

interface FormState {
  title: string;
  price: string;
  category: string;
  location: string;
  brand: string;
  model: string;
  year: string;
  mileage: string;
  fuel: string;
  gearbox: string;
  body: string;
  drive: string;
  description: string;
  partGroup: string;
  partCategory: string;
  unit: string;
  specialties: string;
  tags: string;
  experience: string;
  consultations: string;
}

const initialForm: FormState = {
  title: '',
  price: '',
  category: '',
  location: '',
  brand: '',
  model: '',
  year: '',
  mileage: '',
  fuel: '',
  gearbox: '',
  body: '',
  drive: '',
  description: '',
  partGroup: '',
  partCategory: '',
  unit: '',
  specialties: '',
  tags: '',
  experience: '',
  consultations: '',
};

const DEFAULT_CATEGORY_BY_MODE: Record<MarketCategoryId, string> = {
  cars: '',
  parts: '',
  'car-services': 'Ремонт и обслуживание',
  'auto-tuning': 'Тюнинг',
  consultations: 'Консультация',
  'dry-cleaning': 'Химчистка салона',
};

const isVehicleMode = (mode: MarketCategoryId) => mode === 'cars' || mode === 'parts';

export default function CreateMarketListingScreen({ navigation }: Props) {
  const headerHeight = useHeaderHeight();
  const [mode, setMode] = useState<MarketCategoryId>('cars');
  const [form, setForm] = useState<FormState>(initialForm);
  const [images, setImages] = useState<string[]>([]);
  const { markSaved, guardSheet } = useUnsavedGuard(navigation, images.length > 0 || Object.values(form).some((value) => String(value).trim() !== ''));
  const [loading, setLoading] = useState(false);

  const activeCategory = useMemo(() => getMarketCategory(mode), [mode]);
  const isVehicle = isVehicleMode(mode);
  const isConsultation = mode === 'consultations';
  const imageLimit = isVehicle ? 6 : 1;

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const switchMode = (nextMode: MarketCategoryId) => {
    setMode(nextMode);
    setImages([]);
    setForm((prev) => ({
      ...prev,
      category: DEFAULT_CATEGORY_BY_MODE[nextMode],
      unit: nextMode === 'car-services' ? '/услуга' : '',
    }));
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к фото, чтобы добавить изображение объявления.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: isVehicle,
      selectionLimit: imageLimit,
      quality: 0.82,
    });

    if (!result.canceled) {
      const selected = result.assets.map((asset) => asset.uri);
      setImages((prev) => (isVehicle ? Array.from(new Set([...prev, ...selected])).slice(0, imageLimit) : selected.slice(0, 1)));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Камера', 'Разрешите доступ к камере, чтобы сделать фото объявления.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: !isVehicle,
      quality: 0.82,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImages((prev) => (isVehicle ? [...prev, uri].slice(0, imageLimit) : [uri]));
    }
  };

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((item) => item !== uri));
  };

  const validate = () => {
    const title = form.title.trim();
    const price = form.price.trim();
    const location = form.location.trim();
    const category = form.category.trim();

    if (!title || !price) {
      return isConsultation ? 'Имя специалиста и ставка обязательны.' : 'Название и цена обязательны.';
    }

    if (!isVehicle && !location) {
      return 'Укажите город или регион.';
    }

    if (!isVehicle && !isConsultation && !category) {
      return 'Укажите тип услуги.';
    }

    if (!images.length) {
      return isVehicle ? 'Добавьте хотя бы одно фото.' : 'Добавьте изображение для карточки.';
    }

    return '';
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Объявление', validationError);
      return;
    }

    setLoading(true);
    try {
      if (isVehicle) {
        const listing = await createVehicleListing({
          categoryId: mode,
          title: form.title,
          price: form.price,
          currency: 'EUR',
          brand: form.brand,
          model: form.model,
          year: form.year,
          mileage: form.mileage,
          fuel: form.fuel,
          gearbox: form.gearbox,
          body: form.body,
          drive: form.drive,
          region: form.location,
          description: form.description,
          partGroup: form.partGroup,
          partCategory: form.partCategory,
          images,
        });

        Alert.alert('Готово', 'Объявление опубликовано');
        markSaved();
        navigation.replace('MarketListingDetails', { listing, categoryId: mode });
        return;
      }

      const listing = await createServiceListing({
        categoryId: mode,
        title: form.title,
        name: form.title,
        price: form.price,
        hourlyRate: form.price,
        category: form.category || DEFAULT_CATEGORY_BY_MODE[mode],
        location: form.location,
        unit: form.unit,
        imageUri: images[0],
        tags: form.tags,
        specialties: form.specialties,
        experience: form.experience,
        consultations: form.consultations,
      });

      Alert.alert('Готово', 'Объявление опубликовано');
      markSaved();
        navigation.replace('MarketListingDetails', { listing, categoryId: mode });
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось создать объявление');
    } finally {
      setLoading(false);
    }
  };

  const input = (
    key: keyof FormState,
    placeholder: string,
    options: { keyboardType?: 'default' | 'numeric'; multiline?: boolean } = {},
  ) => (
    <TextInput
      style={[styles.input, options.multiline && styles.textArea]}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      value={form[key]}
      onChangeText={(value) => update(key, options.keyboardType === 'numeric' ? value.replace(/[^0-9]/g, '') : value)}
      keyboardType={options.keyboardType ?? 'default'}
      multiline={options.multiline}
      textAlignVertical={options.multiline ? 'top' : 'center'}
    />
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>Выберите раздел и заполните карточку — объявление появится в Avtotime Market после проверки.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {MARKET_CATEGORIES.map((category) => {
            const active = mode === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                style={[styles.modeBtn, active && styles.modeBtnActive]}
                onPress={() => switchMode(category.id)}
                activeOpacity={0.85}
              >
                <Ionicons name={category.icon as any} size={18} color={active ? colors.onAccent : colors.text} />
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{category.shortLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>{isConsultation ? 'Профиль специалиста' : 'Основное'}</Text>
        {input('title', isConsultation ? 'Имя специалиста' : mode === 'cars' ? 'Название: BMW X5 2020' : 'Название объявления')}
        {input('price', isConsultation ? 'Ставка в EUR / час' : 'Цена в EUR', { keyboardType: 'numeric' })}
        {input('location', isVehicle ? 'Регион / город' : 'Город / регион')}

        {!isVehicle ? (
          <>
            {!isConsultation ? input('category', mode === 'car-services' ? 'Тип услуги: Диагностика, ремонт' : activeCategory.label) : null}
            {mode === 'car-services' ? input('unit', 'Единица: /услуга, /час, /визит') : null}
            {isConsultation ? (
              <>
                {input('specialties', 'Специализации через запятую')}
                {input('experience', 'Опыт, лет', { keyboardType: 'numeric' })}
                {input('consultations', 'Количество консультаций', { keyboardType: 'numeric' })}
              </>
            ) : (
              input('tags', 'Теги через запятую')
            )}
          </>
        ) : (
          <>
            {input('brand', 'Марка')}
            {input('model', 'Модель')}
            {input('year', 'Год', { keyboardType: 'numeric' })}

            {mode === 'cars' ? (
              <>
                <Text style={styles.sectionTitle}>Характеристики авто</Text>
                {input('mileage', 'Пробег, км', { keyboardType: 'numeric' })}
                {input('fuel', 'Топливо')}
                {input('gearbox', 'Коробка передач')}
                {input('body', 'Кузов')}
                {input('drive', 'Привод')}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Категория запчасти</Text>
                {input('partGroup', 'Группа: Двигатель, Кузов, Салон')}
                {input('partCategory', 'Категория: Фара, Бампер, Диск')}
              </>
            )}
          </>
        )}

        {isVehicle ? (
          <>
            <Text style={styles.sectionTitle}>Описание</Text>
            {input('description', 'Кратко опишите состояние, комплектацию и особенности', { multiline: true })}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{isConsultation ? 'Аватар' : 'Фото'}</Text>
        <View style={styles.imageActionRow}>
          <TouchableOpacity style={[styles.imagePicker, images.length >= imageLimit && styles.imagePickerDisabled]} onPress={takePhoto} activeOpacity={0.85} disabled={images.length >= imageLimit}>
            <Ionicons name="camera-outline" size={22} color={colors.text} />
            <Text style={styles.imagePickerText}>Камера</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.imagePicker, images.length >= imageLimit && styles.imagePickerDisabled]} onPress={pickImages} activeOpacity={0.85} disabled={images.length >= imageLimit}>
            <Ionicons name="images-outline" size={22} color={colors.text} />
            <Text style={styles.imagePickerText}>Галерея</Text>
            <Text style={styles.imagePickerCount}>{images.length}/{imageLimit}</Text>
          </TouchableOpacity>
        </View>

        {images.length ? (
          <View style={styles.previewGrid}>
            {images.map((uri) => (
              <View key={uri} style={styles.previewItem}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(uri)}>
                  <Ionicons name="close" size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.onAccent} />
              <Text style={styles.submitText}>Опубликовать</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      {guardSheet}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  lead: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700', marginBottom: 14 },
  modeRow: { gap: 8, paddingBottom: 12 },
  modeBtn: {
    height: 40, borderRadius: 999, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14,
  },
  modeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeText: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  modeTextActive: { color: colors.onAccent },
  sectionTitle: { marginTop: 18, marginBottom: 10, color: colors.text, fontSize: 15, fontWeight: '900' },
  input: {
    minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, color: colors.text, fontSize: 15, marginBottom: 10,
    backgroundColor: colors.surfaceAlt,
  },
  textArea: { minHeight: 110, paddingTop: 12, lineHeight: 20 },
  imageActionRow: { flexDirection: 'row', gap: 8 },
  imagePicker: {
    flex: 1,
    height: 50, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 8,
  },
  imagePickerDisabled: { opacity: 0.5 },
  imagePickerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  imagePickerCount: { color: colors.textMuted, fontWeight: '800' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  previewItem: { width: '31.8%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  previewImage: { width: '100%', height: '100%' },
  removeImage: {
    position: 'absolute', top: 5, right: 5, width: 24, height: 24,
    borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtn: {
    height: 52, borderRadius: 12, backgroundColor: colors.accent,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, marginTop: 22,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: colors.onAccent, fontSize: 16, fontWeight: '900' },
});
