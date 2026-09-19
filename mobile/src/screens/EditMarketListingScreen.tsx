import React, { useMemo, useState } from 'react';
import { showToast } from '../store/toastStore';
import {
  ActivityIndicator,
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
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import {
  getListingImage,
  getListingTitle,
  getMarketCategory,
  MarketCategoryId,
  MarketListing,
  updateMarketListing,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'EditMarketListing'>;
  route: RouteProp<AppStackParamList, 'EditMarketListing'>;
};

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
  engineVolume: string;
  seats: string;
  registration: string;
  description: string;
  partGroup: string;
  partCategory: string;
  unit: string;
  tags: string;
  specialties: string;
  badge: string;
}

const isVehicleMode = (categoryId: MarketCategoryId) => categoryId === 'cars' || categoryId === 'parts';

const numberText = (value?: string | number) => {
  if (value == null) return '';
  return String(value).replace(/[^\d.,]/g, '').replace(',', '.');
};

const joinTags = (value?: string[]) => value?.filter(Boolean).join(', ') ?? '';

const getInitialForm = (listing: MarketListing, categoryId: MarketCategoryId): FormState => ({
  title: getListingTitle(listing),
  price: categoryId === 'consultations' ? numberText(listing.hourlyRate ?? listing.price) : numberText(listing.price),
  category: listing.category || '',
  location: listing.location || listing.region || '',
  brand: listing.brand || '',
  model: listing.model || '',
  year: String(listing.year || ''),
  mileage: numberText(listing.mileage),
  fuel: listing.fuel || '',
  gearbox: listing.transmission || '',
  body: listing.bodyType || '',
  drive: listing.driveType || '',
  engineVolume: listing.engineVolume || '',
  seats: String(listing.seats || ''),
  registration: listing.registrationPlace || '',
  description: listing.description || '',
  partGroup: listing.partGroup || '',
  partCategory: listing.partCategory || '',
  unit: listing.unit || '',
  tags: joinTags(listing.tags),
  specialties: joinTags(listing.specialties),
  badge: listing.badge || '',
});

export default function EditMarketListingScreen({ navigation, route }: Props) {
  const headerHeight = useHeaderHeight();
  const { listing, categoryId } = route.params;
  const category = useMemo(() => getMarketCategory(categoryId), [categoryId]);
  const [form, setForm] = useState<FormState>(() => getInitialForm(listing, categoryId));
  const [images, setImages] = useState<string[]>([]);
  const initialFormRef = React.useRef(form);
  const { markSaved, guardSheet } = useUnsavedGuard(navigation, images.length > 0 || JSON.stringify(form) !== JSON.stringify(initialFormRef.current));
  const [loading, setLoading] = useState(false);

  const isVehicle = isVehicleMode(categoryId);
  const isConsultation = categoryId === 'consultations';
  const imageLimit = isVehicle ? 6 : 1;
  const previewImage = images[0] || getListingImage(listing);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Разрешите доступ к фото, чтобы заменить изображение объявления.');
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
      setImages(isVehicle ? selected.slice(0, imageLimit) : selected.slice(0, 1));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Разрешите доступ к камере, чтобы сделать фото объявления.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: !isVehicle,
      quality: 0.82,
    });

    if (!result.canceled) {
      setImages((prev) => (isVehicle ? Array.from(new Set([...prev, result.assets[0].uri])) : [result.assets[0].uri]));
    }
  };

  const validate = () => {
    if (!form.title.trim() || !form.price.trim()) {
      return isConsultation ? 'Имя специалиста и ставка обязательны.' : 'Название и цена обязательны.';
    }

    if (!isVehicle && !form.location.trim()) {
      return 'Укажите город или регион.';
    }

    if (!isVehicle && !isConsultation && !form.category.trim()) {
      return 'Укажите тип услуги.';
    }

    return '';
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      showToast(validationError);
      return;
    }

    setLoading(true);
    try {
      const updated = await updateMarketListing(categoryId, listing, {
        title: form.title,
        name: form.title,
        price: form.price,
        hourlyRate: form.price,
        currency: 'EUR',
        category: form.category,
        location: form.location,
        region: form.location,
        description: form.description,
        brand: form.brand,
        model: form.model,
        year: form.year,
        mileage: form.mileage,
        fuel: form.fuel,
        gearbox: form.gearbox,
        body: form.body,
        drive: form.drive,
        engineVolume: form.engineVolume,
        seats: form.seats,
        registration: form.registration,
        partGroup: form.partGroup,
        partCategory: form.partCategory,
        unit: form.unit,
        tags: form.tags,
        specialties: form.specialties,
        badge: form.badge,
        imageUris: images,
      });

      showToast('Объявление обновлено', 'success');
      markSaved();
      navigation.replace('MarketListingDetails', { listing: updated, categoryId });
    } catch (e: any) {
      showToast(e.response?.data?.message || e.message || 'Не удалось обновить объявление', 'error');
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
        <Text style={styles.sectionTitle}>{isConsultation ? 'Профиль специалиста' : 'Основное'}</Text>
        {input('title', isConsultation ? 'Имя специалиста' : 'Название объявления')}
        {input('price', isConsultation ? 'Ставка в EUR / час' : 'Цена в EUR', { keyboardType: 'numeric' })}
        {input('location', isVehicle ? 'Регион / город' : 'Город / регион')}

        {!isVehicle ? (
          <>
            {!isConsultation ? input('category', 'Тип услуги') : null}
            {categoryId === 'car-services' ? input('unit', 'Единица: /услуга, /час, /визит') : null}
            {isConsultation ? (
              <>
                {input('specialties', 'Специализации через запятую')}
                {input('tags', 'Теги через запятую')}
              </>
            ) : (
              <>
                {input('tags', 'Теги через запятую')}
                {(categoryId === 'auto-tuning' || categoryId === 'dry-cleaning') ? input('badge', 'Бейдж') : null}
              </>
            )}
          </>
        ) : (
          <>
            {input('brand', 'Марка')}
            {input('model', 'Модель')}
            {input('year', 'Год', { keyboardType: 'numeric' })}

            {categoryId === 'cars' ? (
              <>
                <Text style={styles.sectionTitle}>Характеристики авто</Text>
                {input('mileage', 'Пробег, км', { keyboardType: 'numeric' })}
                {input('fuel', 'Топливо')}
                {input('gearbox', 'Коробка передач')}
                {input('body', 'Кузов')}
                {input('drive', 'Привод')}
                {input('engineVolume', 'Объем двигателя')}
                {input('seats', 'Количество мест', { keyboardType: 'numeric' })}
                {input('registration', 'Регистрация')}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Категория запчасти</Text>
                {input('partGroup', 'Группа')}
                {input('partCategory', 'Категория')}
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
        <View style={styles.imageBlock}>
          {previewImage ? (
            <Image source={{ uri: previewImage }} style={styles.previewImage} />
          ) : (
            <View style={[styles.previewImage, styles.imageFallback]}>
              <Ionicons name="image-outline" size={34} color={colors.textFaint} />
            </View>
          )}
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.imagePicker} onPress={takePhoto} activeOpacity={0.85}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
              <Text style={styles.imagePickerText}>Камера</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImages} activeOpacity={0.85}>
              <Ionicons name="images-outline" size={20} color={colors.text} />
              <Text style={styles.imagePickerText}>{images.length ? 'Выбрать другие' : 'Заменить фото'}</Text>
            </TouchableOpacity>
            {images.length ? (
              <TouchableOpacity style={styles.clearImageBtn} onPress={() => setImages([])}>
                <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
                <Text style={styles.clearImageText}>Оставить текущее</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {isVehicle && images.length > 1 ? (
          <View style={styles.selectedRow}>
            {images.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.selectedThumb} />
            ))}
          </View>
        ) : null}

        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color={colors.onAccent} />
              <Text style={styles.submitText}>Сохранить</Text>
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
  content: { padding: 16, paddingBottom: 32 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  sectionTitle: { marginTop: 14, marginBottom: 8, color: colors.text, fontSize: 15, fontWeight: '900' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 15,
    marginBottom: 10,
    backgroundColor: colors.surfaceAlt,
  },
  textArea: { minHeight: 110, paddingTop: 12, lineHeight: 20 },
  imageBlock: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', aspectRatio: 1.5, backgroundColor: colors.surfaceAlt },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageActions: { padding: 10, gap: 8 },
  imagePicker: {
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  imagePickerText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  clearImageBtn: {
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  clearImageText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  selectedThumb: { width: 58, height: 58, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: colors.onAccent, fontSize: 16, fontWeight: '900' },
});
