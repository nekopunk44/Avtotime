import React, { useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../store/toastStore';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  createServiceListing,
  createVehicleListing,
  getDistinctBrands,
  getDistinctModels,
  getMarketCategory,
  getViewerGeo,
  MARKET_CATEGORIES,
  MarketCategoryId,
} from '../api/market';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { ChoiceSheet, SuggestField } from '../components/ui';
import type { ChoiceOption } from '../components/ui/ChoiceSheet';
import { colors, radius, space } from '../theme';

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
};

const DEFAULT_CATEGORY_BY_MODE: Record<MarketCategoryId, string> = {
  cars: '',
  parts: '',
  'car-services': 'Ремонт и обслуживание',
  'auto-tuning': 'Тюнинг',
  consultations: 'Консультация',
  'dry-cleaning': 'Химчистка салона',
};

const enableLayoutAnimation = () => {
  const manager = UIManager as unknown as {
    setLayoutAnimationEnabledExperimental?: (enabled: boolean) => void;
  };
  manager.setLayoutAnimationEnabledExperimental?.(true);
};

const isVehicleMode = (mode: MarketCategoryId) => mode === 'cars' || mode === 'parts';

/**
 * Поле формы при смене раздела появляется со своим сдвигом: набор полей у
 * разделов разный, и подмена всей пачки разом читается как рывок.
 */
function FormBlock({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Задержка ограничена: ждать полсекунды из-за десятого поля незачем.
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      delay: Math.min(index, 6) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// Значения известны заранее — печатать их руками незачем, а разнобой в
// написании ломает фильтры выдачи.
const FUEL = ['Бензин', 'Дизель', 'Газ', 'Гибрид', 'Электро'];
const GEARBOX = ['Механика', 'Автомат', 'Робот', 'Вариатор'];
const BODY = ['Седан', 'Хэтчбек', 'Универсал', 'Кроссовер', 'Внедорожник', 'Купе', 'Минивэн', 'Пикап', 'Кабриолет'];
const DRIVE = ['Передний', 'Задний', 'Полный'];

// За что берут деньги. В карточке единица дописывается к сумме («20 €/час»),
// поэтому хранится со слешем, а человеку показывается словами.
const UNITS: ChoiceOption[] = [
  { value: '/услуга', label: 'За услугу' },
  { value: '/час', label: 'За час' },
  { value: '/визит', label: 'За визит' },
  { value: '/день', label: 'За день' },
];

// Раздел запчасти: сперва узел, потом конкретная деталь внутри него.
const PART_GROUPS = [
  'Двигатель', 'Трансмиссия', 'Тормозная система', 'Подвеска и рулевое', 'Кузов',
  'Салон', 'Электрика', 'Оптика', 'Колёса и шины', 'Выхлопная система', 'Климат', 'Расходники',
];

const PART_CATEGORIES: Record<string, string[]> = {
  'Двигатель': ['Система зажигания', 'ГРМ', 'Поршневая группа', 'Турбина', 'Система охлаждения', 'Топливная система', 'Прокладки и сальники'],
  'Трансмиссия': ['Сцепление', 'Коробка передач', 'Приводы и ШРУСы', 'Карданный вал', 'Редуктор'],
  'Тормозная система': ['Тормозные диски', 'Тормозные колодки', 'Суппорты', 'Тормозные шланги', 'Главный цилиндр'],
  'Подвеска и рулевое': ['Амортизаторы', 'Пружины', 'Рычаги', 'Сайлентблоки', 'Ступицы и подшипники', 'Рулевые тяги'],
  'Кузов': ['Бампер', 'Капот', 'Крыло', 'Двери', 'Багажник', 'Зеркала', 'Стёкла', 'Решётка радиатора'],
  'Салон': ['Сиденья', 'Панель приборов', 'Обшивка', 'Руль', 'Мультимедиа', 'Коврики'],
  'Электрика': ['Аккумуляторы', 'Генератор', 'Стартер', 'Датчики', 'Проводка', 'Блоки управления'],
  'Оптика': ['Фары', 'Задние фонари', 'Противотуманные фары', 'Лампы', 'Указатели поворота'],
  'Колёса и шины': ['Летние шины', 'Зимние шины', 'Диски', 'Колпаки', 'Датчики давления'],
  'Выхлопная система': ['Глушитель', 'Катализатор', 'Резонатор', 'Выпускной коллектор', 'Лямбда-зонд'],
  'Климат': ['Компрессор кондиционера', 'Радиатор печки', 'Салонный фильтр', 'Вентилятор'],
  'Расходники': ['Масла и жидкости', 'Фильтры', 'Свечи', 'Ремни', 'Щётки стеклоочистителя'],
};

// Без выбранной группы предлагаем все детали разом: человек может знать
// деталь, но не помнить, к какому узлу её отнесли.
const ALL_PART_CATEGORIES = Array.from(new Set(Object.values(PART_CATEGORIES).flat())).sort((a, b) => a.localeCompare(b, 'ru'));

export default function CreateMarketListingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  useEffect(enableLayoutAnimation, []);

  // Место под клавиатуру считаем по её событиям: под edge-to-edge окно не
  // сжимается, а KeyboardAvoidingView оставлял экран обрезанным и после того,
  // как клавиатура уже ушла.
  const kbLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const glide = (height: number, duration?: number) => {
      Animated.timing(kbLift, {
        // Системная полоса внизу уже даёт отступ — вычитаем, иначе останется щель.
        toValue: Math.max(0, height - insets.bottom),
        duration: duration && duration > 0 ? duration : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', (e) => glide(e.endCoordinates.height, e.duration)),
      Keyboard.addListener('keyboardDidShow', (e) => glide(e.endCoordinates.height, e.duration)),
      Keyboard.addListener('keyboardWillHide', (e) => glide(0, e.duration)),
      Keyboard.addListener('keyboardDidHide', (e) => glide(0, e.duration)),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [insets.bottom, kbLift]);
  const [mode, setMode] = useState<MarketCategoryId>('cars');
  const [form, setForm] = useState<FormState>(initialForm);
  const [images, setImages] = useState<string[]>([]);
  const { markSaved, guardSheet } = useUnsavedGuard(navigation, images.length > 0 || Object.values(form).some((value) => String(value).trim() !== ''));
  const [loading, setLoading] = useState(false);

  const activeCategory = useMemo(() => getMarketCategory(mode), [mode]);
  const isVehicle = isVehicleMode(mode);
  const isConsultation = mode === 'consultations';
  // Кадров до шести везде, кроме анкеты специалиста: там это аватар.
  const imageLimit = isConsultation ? 1 : 6;

  const animatePhotos = () => {
    LayoutAnimation.configureNext({
      duration: 240,
      update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleXY },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  };

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Подсказки марок и моделей ────────────────────────────────────────────
  // Списки приходят с сервера один раз, совпадения ищутся на месте: подсказка
  // должна успевать за буквой, а не за сетью.
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const isVehicleForm = isVehicleMode(mode);

  useEffect(() => {
    if (!isVehicleForm) return;
    let alive = true;
    getDistinctBrands(mode).then((list) => { if (alive) setBrands(list); }).catch(() => {});
    return () => { alive = false; };
  }, [mode, isVehicleForm]);

  // Пока набранное не совпало с маркой из справочника, моделей не показываем:
  // чужие модели не должны выдаваться за подходящие.
  const knownBrand = brands.find((item) => item.toLowerCase() === form.brand.trim().toLowerCase()) || '';

  useEffect(() => {
    if (!isVehicleForm) return;
    if (form.brand.trim() && !knownBrand) {
      setModels([]);
      return;
    }
    let alive = true;
    getDistinctModels(knownBrand, mode).then((list) => { if (alive) setModels(list); }).catch(() => {});
    return () => { alive = false; };
  }, [mode, isVehicleForm, form.brand, knownBrand]);

  // ── Город по геолокации ──────────────────────────────────────────────────
  const [locating, setLocating] = useState(false);

  const detectCity = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const geo = await getViewerGeo();
      if (!geo.city) {
        showToast('Не удалось определить город по вашему подключению', 'error');
        return;
      }
      update('location', geo.city);
    } catch {
      showToast('Не удалось определить город. Проверьте соединение', 'error');
    } finally {
      setLocating(false);
    }
  };

  // ── Выбор из списка вместо ручного ввода ─────────────────────────────────
  const [picker, setPicker] = useState<{ key: keyof FormState; title: string; options: ChoiceOption[] } | null>(null);
  const [photoPrompt, setPhotoPrompt] = useState(false);

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
      showToast('Разрешите доступ к фото, чтобы добавить изображение объявления.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: imageLimit > 1,
      selectionLimit: imageLimit,
      quality: 0.82,
    });

    if (!result.canceled) {
      const selected = result.assets.map((asset) => asset.uri);
      animatePhotos();
      setImages((prev) => (imageLimit > 1 ? Array.from(new Set([...prev, ...selected])).slice(0, imageLimit) : selected.slice(0, 1)));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Разрешите доступ к камере, чтобы сделать фото объявления.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: imageLimit === 1,
      quality: 0.82,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      animatePhotos();
      setImages((prev) => (imageLimit > 1 ? [...prev, uri].slice(0, imageLimit) : [uri]));
    }
  };

  const removeImage = (uri: string) => {
    // Снимок уходит, сетка сдвигается — без этого кадры перескакивают рывком.
    animatePhotos();
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
      showToast(validationError);
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

        showToast('Объявление опубликовано', 'success');
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
        imageUris: images,
        tags: form.tags,
        specialties: form.specialties,
        experience: form.experience,
      });

      showToast('Объявление опубликовано', 'success');
      markSaved();
        navigation.replace('MarketListingDetails', { listing, categoryId: mode });
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось создать объявление', 'error');
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

  /** Город: ручной ввод и определение прямо внутри поля. */
  const cityField = (
    <View style={styles.inputWrap}>
      <TextInput
        style={[styles.input, styles.inputInline]}
        placeholder={isVehicle ? 'Регион / город' : 'Город / регион'}
        placeholderTextColor={colors.textFaint}
        value={form.location}
        onChangeText={(value) => update('location', value)}
        autoCapitalize="words"
      />
      <TouchableOpacity onPress={detectCity} hitSlop={8} style={styles.inputAction}>
        {locating
          ? <ActivityIndicator size="small" color={colors.text} />
          : <Ionicons name="locate" size={18} color={colors.textMuted} />}
      </TouchableOpacity>
    </View>
  );

  /** Значение из списка: поле открывает выбор, а не клавиатуру. */
  const choice = (key: keyof FormState, placeholder: string, options: ChoiceOption[]) => {
    // В поле показываем подпись варианта, а не то, что уходит на сервер.
    const chosen = options.find((option) => (typeof option === 'string' ? option : option.value) === form[key]);
    const label = typeof chosen === 'string' ? chosen : chosen?.label || chosen?.value;

    return (
      <TouchableOpacity
        style={[styles.input, styles.choice]}
        activeOpacity={0.8}
        onPress={() => setPicker({ key, title: placeholder, options })}
      >
        <Text style={[styles.choiceText, !form[key] && styles.choicePlaceholder]}>
          {label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const blocks: React.ReactNode[] = [
    <Text style={styles.sectionTitle}>{isConsultation ? 'Профиль специалиста' : 'Основное'}</Text>,
    input('title', isConsultation ? 'Имя специалиста' : mode === 'cars' ? 'Название: BMW X5 2020' : 'Название объявления'),
    input('price', isConsultation ? 'Ставка в EUR / час' : 'Цена в EUR', { keyboardType: 'numeric' }),
    cityField,
  ];

  if (!isVehicle) {
    if (!isConsultation) {
      blocks.push(input('category', mode === 'car-services' ? 'Тип услуги: Диагностика, ремонт' : activeCategory.label));
    }
    if (mode === 'car-services') blocks.push(choice('unit', 'Единица цены', UNITS));
    if (isConsultation) {
      blocks.push(input('specialties', 'Специализации через запятую'));
      blocks.push(input('experience', 'Опыт, лет', { keyboardType: 'numeric' }));
    } else {
      blocks.push(input('tags', 'Теги через запятую'));
    }
  } else {
    blocks.push(
      <View style={styles.suggestWrap}>
        <SuggestField
          label="Марка"
          value={form.brand}
          // Смена марки обнуляет модель: пары «BMW + Octavia» не бывает.
          onChangeText={(value) => setForm((prev) => ({ ...prev, brand: value, model: '' }))}
          options={brands}
          placeholder="Марка"
          emptyNote="Подсказки недоступны"
        />
      </View>,
      <View style={styles.suggestWrap}>
        <SuggestField
          label="Модель"
          value={form.model}
          onChangeText={(value) => update('model', value)}
          options={models}
          placeholder="Модель"
          emptyNote={form.brand.trim() && !knownBrand
            ? 'Выберите марку из списка'
            : form.brand.trim()
              ? `Для «${form.brand.trim()}» моделей пока нет`
              : 'Моделей пока нет'}
        />
      </View>,
      input('year', 'Год', { keyboardType: 'numeric' }),
    );

    if (mode === 'cars') {
      blocks.push(
        <Text style={styles.sectionTitle}>Характеристики авто</Text>,
        input('mileage', 'Пробег, км', { keyboardType: 'numeric' }),
        choice('fuel', 'Топливо', FUEL),
        choice('gearbox', 'Коробка передач', GEARBOX),
        choice('body', 'Кузов', BODY),
        choice('drive', 'Привод', DRIVE),
      );
    } else {
      blocks.push(
        <Text style={styles.sectionTitle}>Категория запчасти</Text>,
        choice('partGroup', 'Группа', PART_GROUPS),
        choice('partCategory', 'Категория', PART_CATEGORIES[form.partGroup] || ALL_PART_CATEGORIES),
      );
    }

    blocks.push(
      <Text style={styles.sectionTitle}>Описание</Text>,
      input('description', 'Кратко опишите состояние, комплектацию и особенности', { multiline: true }),
    );
  }

  return (
    <Animated.View style={[styles.container, { paddingBottom: kbLift }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Поля собраны списком, чтобы каждое появилось со своим сдвигом при
            смене раздела. */}
        {blocks.map((block, index) => (
          <FormBlock key={`${mode}-${index}`} index={index}>{block}</FormBlock>
        ))}

        <View style={styles.photoHead}>
          <Text style={styles.sectionTitle}>{isConsultation ? 'Аватар' : 'Фото'}</Text>
          <Text style={styles.photoCount}>{images.length}/{imageLimit}</Text>
        </View>
        {imageLimit > 1 ? (
          <Text style={styles.photoHint}>Первое фото станет обложкой объявления</Text>
        ) : null}

        {/* Снимки и кнопка добавления лежат одной сеткой: две широкие кнопки
            занимали место и не показывали, что уже выбрано. */}
        <View style={styles.photoGrid}>
          {images.map((uri, index) => (
            <View key={uri} style={styles.photoTile}>
              <Image source={{ uri }} style={styles.photoImage} />
              {index === 0 && imageLimit > 1 ? (
                <Text style={styles.coverBadge}>Обложка</Text>
              ) : null}
              <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(uri)}>
                <Ionicons name="close" size={15} color={colors.white} />
              </TouchableOpacity>
            </View>
          ))}

          {images.length < imageLimit ? (
            <TouchableOpacity
              style={[styles.photoTile, styles.photoAdd]}
              activeOpacity={0.85}
              onPress={() => setPhotoPrompt(true)}
            >
              <Ionicons name="add" size={26} color={colors.textMuted} />
              <Text style={styles.photoAddText}>{images.length ? 'Ещё фото' : 'Добавить фото'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

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

      <ChoiceSheet
        visible={!!picker}
        title={picker?.title || ''}
        options={picker?.options || []}
        value={picker ? form[picker.key] : ''}
        clearLabel="Не указано"
        onSelect={(value) => {
          if (!picker) return;
          // Смена узла обнуляет деталь: «Кузов + Свечи» не бывает.
          if (picker.key === 'partGroup') setForm((prev) => ({ ...prev, partGroup: value, partCategory: '' }));
          else update(picker.key, value);
        }}
        onClose={() => setPicker(null)}
      />
      <ChoiceSheet
        visible={photoPrompt}
        title={isConsultation ? 'Аватар' : 'Фото объявления'}
        options={[
          { value: 'camera', label: 'Камера', icon: 'camera-outline' },
          { value: 'gallery', label: 'Галерея', icon: 'images-outline' },
        ]}
        onSelect={(value) => (value === 'camera' ? takePhoto() : pickImages())}
        onClose={() => setPhotoPrompt(false)}
      />
      {guardSheet}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
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
  // У поля с подсказками своя вёрстка с подписью — отбиваем его так же,
  // как отбиты обычные поля друг от друга.
  suggestWrap: { marginBottom: 10 },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  inputInline: { paddingRight: 44 },
  inputAction: { position: 'absolute', right: 6, top: 0, bottom: 10, width: 38, alignItems: 'center', justifyContent: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  choiceText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  choicePlaceholder: { color: colors.textFaint, fontWeight: '400' },
  photoHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  photoCount: { color: colors.textFaint, fontSize: 13, fontWeight: '900' },
  photoHint: { marginTop: -4, marginBottom: 10, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile: {
    width: '31.8%', aspectRatio: 1, borderRadius: radius.md,
    overflow: 'hidden', backgroundColor: colors.surfaceAlt,
  },
  photoImage: { width: '100%', height: '100%' },
  photoAdd: {
    alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.surfaceHi, backgroundColor: colors.bg,
  },
  // Подпись занимает всю ширину клетки и выравнивается по центру: короткая
  // строка иначе прижималась к левому краю, а длинная переносилась уступом.
  photoAddText: {
    width: '100%', color: colors.textMuted, fontSize: 11, fontWeight: '800',
    textAlign: 'center', lineHeight: 14,
  },
  coverBadge: {
    position: 'absolute', left: 6, bottom: 6,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.72)', color: colors.white, fontSize: 10, fontWeight: '900',
  },
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
