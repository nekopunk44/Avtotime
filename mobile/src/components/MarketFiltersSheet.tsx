import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
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
import { MarketCategoryId, MarketSort } from '../api/market';
import { colors, font, radius, shadow, space } from '../theme';
import { PressableScale } from './ui';

export interface MarketFilters {
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
}

export const emptyMarketFilters: MarketFilters = {
  brand: '', model: '', partGroup: '', region: '',
  priceMin: '', priceMax: '', yearFrom: '', yearTo: '', mileageMin: '', mileageMax: '',
  fuel: '', gearbox: '', bodyType: '', driveType: '',
  sortBy: 'newest',
};

/** Сколько условий реально сужают выдачу — число рисуется точкой на кнопке. */
export const countActiveFilters = (filters: MarketFilters) =>
  Object.entries(filters).filter(([key, value]) =>
    key === 'sortBy' ? value !== 'newest' : Boolean(value)).length;

export const hasActiveFilters = (filters: MarketFilters) => countActiveFilters(filters) > 0;

type FieldKey = 'brand' | 'model' | 'partGroup' | 'year' | 'price' | 'mileage' | 'fuel' | 'gearbox' | 'bodyType' | 'driveType' | 'region';

// Набор полей повторяет условия фильтра на бэкенде: показывать поле, которого
// сервер не учитывает для этой категории, — обманывать пользователя.
const FIELDS: Record<MarketCategoryId, FieldKey[]> = {
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

const SORTS: Array<{ value: MarketSort; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'newest', label: 'Новые', icon: 'time-outline' },
  { value: 'price_asc', label: 'Дешевле', icon: 'arrow-down-outline' },
  { value: 'price_desc', label: 'Дороже', icon: 'arrow-up-outline' },
  { value: 'oldest', label: 'Старые', icon: 'calendar-outline' },
];

const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 9);

interface Props {
  visible: boolean;
  categoryId: MarketCategoryId;
  value: MarketFilters;
  /** Сколько объявлений сейчас в выдаче — на кнопке «Показать». */
  resultCount: number;
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
  visible, categoryId, value, resultCount, onApply, onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<MarketFilters>(value);
  // Модалка держится смонтированной до конца анимации ухода — иначе шторка
  // исчезала бы мгновенно, а не уезжала вниз.
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(520);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMounted(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    // value намеренно не в зависимостях: черновик берётся один раз, на открытии.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, anim]);

  const set = (key: keyof MarketFilters, next: string) =>
    setDraft((prev) => ({ ...prev, [key]: next }));

  const fields = FIELDS[categoryId] || FIELDS.cars;
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

  const renderChips = (label: string, key: keyof MarketFilters, options: string[]) => (
    <View key={label} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((option) => {
          const active = draft[key] === option;
          return (
            <PressableScale
              key={option}
              scaleTo={0.95}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => set(key, active ? '' : option)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderField = (key: FieldKey) => {
    switch (key) {
      case 'brand': return renderText('Марка', 'brand', 'Напр. BMW');
      case 'model': return renderText('Модель', 'model', 'Напр. X5');
      case 'partGroup': return renderText('Группа запчастей', 'partGroup', 'Напр. Тормоза');
      case 'region': return renderText('Регион / город', 'region', 'Город');
      case 'price': return renderRange('Цена, €', 'priceMin', 'priceMax');
      case 'year': return renderRange('Год', 'yearFrom', 'yearTo');
      case 'mileage': return renderRange('Пробег, км', 'mileageMin', 'mileageMax');
      case 'fuel': return renderChips('Топливо', 'fuel', FUEL);
      case 'gearbox': return renderChips('Коробка', 'gearbox', GEARBOX);
      case 'bodyType': return renderChips('Кузов', 'bodyType', BODY);
      case 'driveType': return renderChips('Привод', 'driveType', DRIVE);
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
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [sheetHeight, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.grabber} />

            <View style={styles.headerRow}>
              <Text style={styles.title}>Фильтры</Text>
              <PressableScale style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={colors.text} />
              </PressableScale>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {fields.map(renderField)}

              <View style={styles.field}>
                <Text style={styles.label}>Сортировка</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {SORTS.map((sort) => {
                    const active = draft.sortBy === sort.value;
                    return (
                      <PressableScale
                        key={sort.value}
                        scaleTo={0.95}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setDraft((prev) => ({ ...prev, sortBy: sort.value }))}
                      >
                        <Ionicons name={sort.icon} size={14} color={active ? colors.onAccent : colors.textMuted} />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{sort.label}</Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.actions}>
              <PressableScale
                style={styles.resetBtn}
                onPress={() => setDraft({ ...emptyMarketFilters })}
              >
                <Ionicons name="refresh-outline" size={17} color={colors.text} />
                <Text style={styles.resetText}>Сбросить</Text>
              </PressableScale>
              <PressableScale style={styles.applyBtn} onPress={() => onApply(draft)}>
                <Text style={styles.applyText}>
                  {activeCount ? `Показать · ${activeCount}` : `Показать (${resultCount})`}
                </Text>
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
  grabber: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi, marginBottom: space.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: font.h2, fontWeight: '900' },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },

  body: { marginTop: space.md },
  bodyContent: { gap: space.lg, paddingBottom: space.md },
  field: { gap: space.sm },
  label: {
    color: colors.textMuted, fontSize: font.tiny, fontWeight: '900',
    marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body,
  },
  rangeRow: { flexDirection: 'row', gap: space.sm },
  rangeInput: {
    flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body,
  },
  chipRow: { gap: space.sm, paddingVertical: 1 },
  chip: {
    height: 38, borderRadius: radius.pill, paddingHorizontal: space.md,
    backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  chipTextActive: { color: colors.onAccent },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  resetBtn: {
    height: 52, borderRadius: radius.lg, paddingHorizontal: space.lg, backgroundColor: colors.surfaceAlt,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  resetText: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  applyBtn: {
    flex: 1, height: 52, borderRadius: radius.lg, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  applyText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
});
