import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getDistinctBrands,
  getDistinctModels,
  getViewerGeo,
  MARKET_CATEGORIES,
  MarketCategoryId,
  MarketSort,
} from '../api/market';
import { colors, font, radius, shadow, space } from '../theme';
import { PressableScale, SuggestField } from './ui';

export interface MarketFilters {
  /** Раздел маркета. Пусто — показываем всё, что есть. */
  type: MarketCategoryId | '';
  brand: string;
  model: string;
  partGroup: string;
  region: string;
  priceMin: string;
  priceMax: string;
  yearFrom: string;
  yearTo: string;
  mileageMin: string;
  mileageMax: string;
  fuel: string;
  gearbox: string;
  bodyType: string;
  driveType: string;
  sortBy: MarketSort;
  /**
   * Город, подставленный кнопкой геолокации, и его координаты. Пока они есть,
   * город не сужает выдачу, а задаёт порядок: ближние объявления идут первыми.
   * Ручная правка поля отменяет это — набранный город снова просто фильтр.
   */
  nearCity: string;
  nearLat: number | null;
  nearLng: number | null;
}

export const emptyMarketFilters: MarketFilters = {
  type: '',
  brand: '', model: '', partGroup: '', region: '',
  priceMin: '', priceMax: '', yearFrom: '', yearTo: '', mileageMin: '', mileageMax: '',
  fuel: '', gearbox: '', bodyType: '', driveType: '',
  sortBy: 'newest',
  nearCity: '', nearLat: null, nearLng: null,
};

const NOT_A_CONDITION = new Set(['nearCity', 'nearLat', 'nearLng']);

/** Сколько условий реально сужают выдачу — число рисуется точкой на кнопке. */
export const countActiveFilters = (filters: MarketFilters) =>
  Object.entries(filters).filter(([key, value]) => {
    if (key === 'sortBy') return value !== 'newest';
    // Спутники поля «город», отдельными условиями не считаются.
    if (NOT_A_CONDITION.has(key)) return false;
    return Boolean(value);
  }).length;

export const hasActiveFilters = (filters: MarketFilters) => countActiveFilters(filters) > 0;

type FieldKey = 'brand' | 'model' | 'partGroup' | 'year' | 'price' | 'mileage' | 'fuel' | 'gearbox' | 'bodyType' | 'driveType' | 'region';

// Набор полей повторяет условия фильтра на бэкенде: показывать поле, которого
// сервер не учитывает для этой категории, — обманывать пользователя. Пустой
// ключ — «все разделы»: общими остаются только цена и место.
const FIELDS: Record<MarketCategoryId | '', FieldKey[]> = {
  '': ['price', 'region'],
  cars: ['brand', 'model', 'year', 'price', 'mileage', 'fuel', 'gearbox', 'bodyType', 'driveType', 'region'],
  parts: ['brand', 'model', 'partGroup', 'year', 'price', 'region'],
  'car-services': ['price', 'region'],
  'auto-tuning': ['brand', 'model', 'price', 'region'],
  consultations: ['price', 'region'],
  'dry-cleaning': ['price', 'region'],
};

const FUEL = ['Бензин', 'Дизель', 'Газ', 'Гибрид', 'Электро'];
const GEARBOX = ['Механика', 'Автомат', 'Робот', 'Вариатор'];
const BODY = ['Седан', 'Хэтчбек', 'Универсал', 'Кроссовер', 'Внедорожник', 'Купе', 'Минивэн', 'Пикап', 'Кабриолет'];
const DRIVE = ['Передний', 'Задний', 'Полный'];

// Значения хранятся строкой через запятую — ровно так их принимает бэкенд
// ($in по списку), поэтому наружу уходит то же, что и раньше.
const listOf = (value: string) => (value ? value.split(',').filter(Boolean) : []);
const toggleValue = (current: string, option: string) => {
  const list = listOf(current);
  const next = list.includes(option) ? list.filter((item) => item !== option) : [...list, option];
  return next.join(',');
};

const SORTS: Array<{ value: MarketSort; label: string }> = [
  { value: 'newest', label: 'Новые' },
  { value: 'price_asc', label: 'Дешевле' },
  { value: 'price_desc', label: 'Дороже' },
  { value: 'oldest', label: 'Старые' },
];

const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 9);

interface Props {
  visible: boolean;
  value: MarketFilters;
  onApply: (filters: MarketFilters) => void;
  onClose: () => void;
}

/**
 * Фильтры маркета шторкой снизу вместо отдельного экрана: выдача остаётся под
 * рукой, а закрытие не выбрасывает пользователя из списка.
 *
 * Правки живут в черновике и уезжают наружу только по «Показать» — свайп вниз
 * или тап по подложке должны быть отменой без последствий.
 */
export default function MarketFiltersSheet({
  visible, value, onApply, onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<MarketFilters>(value);
  // Модалка держится смонтированной до конца анимации ухода — иначе шторка
  // исчезала бы мгновенно, а не уезжала вниз.
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(520);
  const anim = useRef(new Animated.Value(0)).current;
  // Смещение пальцем. Драйвер у обоих значений один (JS): нативная и
  // не-нативная анимации на одном transform несовместимы.
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMounted(true);
      anim.setValue(0);
      drag.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    // Уезжает и то, что натянуто пальцем: сумма смещений идёт вниз без рывка.
    Animated.parallel([
      Animated.timing(anim, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      Animated.timing(drag, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    // value намеренно не в зависимостях: черновик берётся один раз, на открытии.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, anim, drag]);

  // ── Подсказки марок и моделей ────────────────────────────────────────────
  // Списки приходят с сервера один раз, совпадения ищутся на месте: подсказка
  // должна успевать за буквой, а не за сетью.
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    getDistinctBrands(draft.type || 'all').then((list) => { if (alive) setBrands(list); }).catch(() => {});
    return () => { alive = false; };
  }, [visible, draft.type]);

  // Модели зависят от марки: пока она не выбрана, показываем весь список.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const brand = draft.brand.trim();
    getDistinctModels(brand, draft.type || 'all').then((list) => { if (alive) setModels(list); }).catch(() => {});
    return () => { alive = false; };
  }, [visible, draft.type, draft.brand]);

  // ── Сортировка: заливка едет к выбранному варианту ───────────────────────
  const [sortWidth, setSortWidth] = useState(0);
  const sortSlide = useRef(new Animated.Value(0)).current;
  const sortPlaced = useRef(false);
  const sortSeg = sortWidth > 0 ? (sortWidth - 8) / SORTS.length : 0;
  const sortIndex = Math.max(0, SORTS.findIndex((s) => s.value === draft.sortBy));
  const sortTargetX = 4 + sortSeg * sortIndex;

  useEffect(() => {
    if (sortSeg <= 0) return;
    if (!sortPlaced.current) {
      // Первая раскладка — без анимации: шторка открывается уже с выбранным.
      sortPlaced.current = true;
      sortSlide.setValue(sortTargetX);
      return;
    }
    Animated.spring(sortSlide, { toValue: sortTargetX, useNativeDriver: true, speed: 16, bounciness: 7 }).start();
  }, [sortTargetX, sortSeg, sortSlide]);

  // ── Геолокация ───────────────────────────────────────────────────────────
  const [locating, setLocating] = useState(false);

  const detectCity = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const geo = await getViewerGeo();
      if (!geo.city) {
        Alert.alert('Город', 'Не удалось определить город по вашему подключению.');
        return;
      }
      // Город пишется прямо в поле; координаты рядом — по ним считается,
      // что ближе, а что дальше.
      setDraft((prev) => ({
        ...prev,
        region: geo.city,
        nearCity: geo.city,
        nearLat: geo.lat,
        nearLng: geo.lng,
      }));
    } catch {
      Alert.alert('Город', 'Не удалось определить город. Проверьте соединение.');
    } finally {
      setLocating(false);
    }
  };

  // Закрытие живёт в ref: PanResponder создаётся один раз и иначе держал бы
  // самый первый onClose.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const pan = useRef(
    PanResponder.create({
      // Перехватываем только явное движение вниз — горизонтальные и мелкие
      // касания остаются кнопкам и полям.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) drag.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        // Либо утянули достаточно далеко, либо бросили резким движением вниз.
        if (g.dy > 90 || g.vy > 0.9) {
          closeRef.current();
          return;
        }
        Animated.spring(drag, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 14 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 14 }).start();
      },
    }),
  ).current;

  const set = (key: keyof MarketFilters, next: string) =>
    setDraft((prev) => ({ ...prev, [key]: next }));

  const fields = FIELDS[draft.type] || FIELDS[''];
  const activeCount = countActiveFilters(draft);

  const renderRange = (label: string, minKey: keyof MarketFilters, maxKey: keyof MarketFilters) => (
    <View key={label} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rangeRow}>
        <TextInput
          style={styles.rangeInput}
          placeholder="от"
          placeholderTextColor={colors.textFaint}
          value={draft[minKey] as string}
          onChangeText={(v) => set(minKey, digits(v))}
          keyboardType="number-pad"
        />
        <TextInput
          style={styles.rangeInput}
          placeholder="до"
          placeholderTextColor={colors.textFaint}
          value={draft[maxKey] as string}
          onChangeText={(v) => set(maxKey, digits(v))}
          keyboardType="number-pad"
        />
      </View>
    </View>
  );

  const renderText = (label: string, key: keyof MarketFilters, placeholder: string) => (
    <View key={label} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        value={draft[key] as string}
        onChangeText={(v) => set(key, v)}
        autoCapitalize="none"
      />
    </View>
  );

  /** Поле с подсказками; логика общая с заявкой на подбор авто. */
  const renderSuggest = (label: string, key: 'brand' | 'model', placeholder: string) => (
    <SuggestField
      key={label}
      label={label}
      value={draft[key]}
      onChangeText={(v) => {
        set(key, v);
        // Смена марки обнуляет модель: пары «BMW + Octavia» не бывает.
        if (key === 'brand') set('model', '');
      }}
      options={key === 'brand' ? brands : models}
      placeholder={placeholder}
      emptyNote={key === 'brand'
        ? 'Подсказки недоступны'
        : draft.brand.trim()
          ? `Для «${draft.brand.trim()}» моделей пока нет`
          : 'Моделей пока нет'}
    />
  );

  /** Город: ручной ввод и кнопка определения прямо внутри поля. */
  const renderCity = () => (
    <View key="city" style={styles.field}>
      <Text style={styles.label}>Регион / город</Text>
      <View style={[styles.input, styles.inputWithAction]}>
        <TextInput
          style={styles.inputInner}
          placeholder="Город"
          placeholderTextColor={colors.textFaint}
          value={draft.region}
          onChangeText={(v) => {
            // Правка руками отменяет режим близости: набранный город снова
            // обычный фильтр, а не точка отсчёта.
            setDraft((prev) => ({
              ...prev,
              region: v,
              ...(v === prev.nearCity ? {} : { nearCity: '', nearLat: null, nearLng: null }),
            }));
          }}
          autoCapitalize="words"
        />
        <Pressable onPress={detectCity} hitSlop={8} style={styles.inputAction}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons
              name="locate"
              size={18}
              color={draft.nearCity ? colors.accent : colors.textMuted}
            />
          )}
        </Pressable>
      </View>
    </View>
  );

  /**
   * Значения — список с отметками в две колонки: видно все варианты сразу
   * (в горизонтальной ленте половина уезжала за край) и видно, что выбрать
   * можно несколько.
   */
  const renderOptions = (label: string, key: keyof MarketFilters, options: string[]) => {
    const chosen = listOf(draft[key] as string);
    return (
      <View key={label} style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {chosen.length ? <Text style={styles.labelCount}>{`  ${chosen.length}`}</Text> : null}
          </Text>
          {chosen.length ? (
            <Pressable onPress={() => set(key, '')} hitSlop={8}>
              <Text style={styles.labelClear}>Сбросить</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.optionGrid}>
          {options.map((option) => {
            const active = chosen.includes(option);
            return (
              <PressableScale
                key={option}
                scaleTo={0.96}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => set(key, toggleValue(draft[key] as string, option))}
              >
                <Text
                  style={[styles.optionText, active && styles.optionTextActive]}
                  numberOfLines={1}
                >
                  {option}
                </Text>
                <View style={[styles.check, active && styles.checkActive]}>
                  {active ? <Ionicons name="checkmark" size={13} color={colors.onAccent} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>
    );
  };

  const renderField = (key: FieldKey) => {
    switch (key) {
      case 'brand': return renderSuggest('Марка', 'brand', 'Напр. BMW');
      case 'model': return renderSuggest('Модель', 'model', 'Напр. X5');
      case 'partGroup': return renderText('Группа запчастей', 'partGroup', 'Напр. Тормоза');
      case 'region': return renderCity();
      case 'price': return renderRange('Цена, €', 'priceMin', 'priceMax');
      case 'year': return renderRange('Год', 'yearFrom', 'yearTo');
      case 'mileage': return renderRange('Пробег, км', 'mileageMin', 'mileageMax');
      case 'fuel': return renderOptions('Топливо', 'fuel', FUEL);
      case 'gearbox': return renderOptions('Коробка', 'gearbox', GEARBOX);
      case 'bodyType': return renderOptions('Кузов', 'bodyType', BODY);
      case 'driveType': return renderOptions('Привод', 'driveType', DRIVE);
      default: return null;
    }
  };

  return (
    // animationType="none": появление рисуем сами — подложка проявляется,
    // шторка выезжает снизу на собственную измеренную высоту.
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <Animated.View
            onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
            style={[
              styles.sheet,
              {
                paddingBottom: insets.bottom + space.md,
                transform: [
                  {
                    translateY: Animated.add(
                      anim.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }),
                      drag,
                    ),
                  },
                ],
              },
            ]}
          >
            {/* Шапка — ручка шторки: тянется вниз и закрывает панель.
                Очистка вынесена сюда и позиционируется поверх, чтобы
                заголовок остался ровно по центру. */}
            <View {...pan.panHandlers} style={styles.handleZone}>
              <View style={styles.grabber} />
              {/* Кнопка растянута по высоте строки заголовка — так иконка
                  стоит на одном уровне с ним при любом кегле шрифта. */}
              <View style={styles.titleRow}>
                <Text style={styles.title}>Фильтры</Text>
                <Pressable
                  style={styles.clearBtn}
                  hitSlop={12}
                  disabled={!activeCount}
                  onPress={() => setDraft({ ...emptyMarketFilters })}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={activeCount ? colors.text : colors.textFaint}
                  />
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Раздел — выбор один, поэтому кружок, а не отметка. Пустой
                  выбор означает «всё сразу» и стоит первым. */}
              <View style={styles.field}>
                <Text style={styles.label}>Раздел</Text>
                <View style={styles.optionGrid}>
                  {[{ id: '' as const, shortLabel: 'Все разделы' }, ...MARKET_CATEGORIES].map((item) => {
                    const active = draft.type === item.id;
                    return (
                      <PressableScale
                        key={item.id || 'all'}
                        scaleTo={0.96}
                        style={[styles.option, active && styles.optionActive]}
                        onPress={() => setDraft((prev) => (
                          // Смена раздела уносит поля, которых в нём нет:
                          // «Кузов: седан» в запчастях — мусор, а не фильтр.
                          prev.type === item.id
                            ? prev
                            : { ...emptyMarketFilters, type: item.id, region: prev.region, sortBy: prev.sortBy }
                        ))}
                      >
                        <Text
                          style={[styles.optionText, active && styles.optionTextActive]}
                          numberOfLines={1}
                        >
                          {item.shortLabel}
                        </Text>
                        <View style={[styles.radio, active && styles.radioActive]}>
                          {active ? <View style={styles.radioDot} /> : null}
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              {fields.map(renderField)}

              {/* Сортировка — выбор ровно один, поэтому сегменты, а не отметки. */}
              <View style={styles.field}>
                <Text style={styles.label}>Сортировка</Text>
                <View
                  style={styles.segment}
                  onLayout={(e) => setSortWidth(e.nativeEvent.layout.width)}
                >
                  {sortSeg > 0 ? (
                    <Animated.View
                      style={[styles.segmentThumb, { width: sortSeg, transform: [{ translateX: sortSlide }] }]}
                    />
                  ) : null}
                  {SORTS.map((sort) => {
                    const active = draft.sortBy === sort.value;
                    return (
                      <Pressable
                        key={sort.value}
                        style={styles.segmentItem}
                        onPress={() => setDraft((prev) => ({ ...prev, sortBy: sort.value }))}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                          {sort.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.actions}>
              <PressableScale style={styles.applyBtn} onPress={() => onApply(draft)}>
                <Text style={styles.applyText}>Показать</Text>
              </PressableScale>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
    paddingHorizontal: space.xl,
    maxHeight: '86%',
    ...shadow.card,
  },
  // Зона перетаскивания шире самой полоски: попасть пальцем в 4 пикселя нельзя.
  handleZone: { paddingTop: space.xs, paddingBottom: space.sm, alignItems: 'center' },
  grabber: {
    width: 44, height: 5, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi, marginBottom: space.md,
  },
  titleRow: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: font.h2, fontWeight: '900', textAlign: 'center' },
  clearBtn: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 32, alignItems: 'flex-end', justifyContent: 'center',
  },

  body: { marginTop: space.md },
  bodyContent: { gap: space.lg, paddingBottom: space.md },
  field: { gap: space.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    color: colors.textMuted, fontSize: font.tiny, fontWeight: '900',
    marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  labelClear: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '900' },
  labelCount: { color: colors.accent },

  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    // Две колонки: половина ширины минус половина зазора между ними.
    width: '48.5%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm,
    height: 46, borderRadius: radius.md, paddingHorizontal: space.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
  },
  optionActive: { borderColor: colors.accent, backgroundColor: colors.surfaceHi },
  optionText: { flex: 1, color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  optionTextActive: { color: colors.text, fontWeight: '900' },
  check: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  input: {
    height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body,
  },
  // Кнопка живёт внутри поля: рамка одна на ввод и действие.
  inputWithAction: { flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
  inputInner: { flex: 1, height: '100%', color: colors.text, fontSize: font.body, padding: 0 },
  inputAction: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  rangeRow: { flexDirection: 'row', gap: space.sm },
  rangeInput: {
    flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body,
  },
  segment: {
    flexDirection: 'row', backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, padding: 4, gap: 4,
  },
  segmentThumb: {
    position: 'absolute', left: 0, top: 4, bottom: 4,
    borderRadius: radius.sm, backgroundColor: colors.accent,
  },
  segmentItem: {
    flex: 1, height: 38, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  segmentText: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  segmentTextActive: { color: colors.onAccent, fontWeight: '900' },

  actions: { marginTop: space.md },
  applyBtn: {
    alignSelf: 'stretch', height: 46, borderRadius: radius.pill,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  applyText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
});
