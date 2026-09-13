import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, space } from '../../theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Полный список вариантов; фильтрация по вводу идёт здесь, без сети. */
  options: string[];
  placeholder?: string;
  /** Что сказать, когда подсказывать нечего: пустой список ≠ поломка. */
  emptyNote?: string;
  maxSuggestions?: number;
  autoCapitalize?: 'none' | 'words';
  onPick?: (value: string) => void;
}

/**
 * Поле с живыми подсказками из готового списка. Список приходит один раз, а
 * совпадения ищутся на месте: подсказка должна успевать за буквой, а не за
 * сетью.
 */
export default function SuggestField({
  label, value, onChangeText, options, placeholder, emptyNote,
  maxSuggestions = 8, autoCapitalize = 'words', onPick,
}: Props) {
  const [focused, setFocused] = useState(false);

  const typed = value.trim().toLowerCase();
  const matched = typed ? options.filter((item) => item.toLowerCase().includes(typed)) : options;
  // Точное совпадение — это уже введённое значение, подсказывать его нечего.
  const exact = matched.length === 1 && matched[0].toLowerCase() === typed;
  const suggestions = focused && !exact ? matched.slice(0, maxSuggestions) : [];
  const note = focused && !exact && !matched.length
    ? (options.length ? 'Совпадений нет' : emptyNote || '')
    : '';

  const pick = (item: string) => {
    onChangeText(item);
    onPick?.(item);
    setFocused(false);
  };

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {value ? (
          <Pressable onPress={() => onChangeText('')} hitSlop={8}>
            <Text style={styles.clear}>Сбросить</Text>
          </Pressable>
        ) : null}
      </View>

      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />

      {note ? (
        <View style={styles.box}>
          <Text style={styles.note}>{note}</Text>
        </View>
      ) : null}

      {suggestions.length ? (
        <View style={styles.box}>
          {suggestions.map((item, index) => (
            <Pressable
              key={item}
              style={[styles.item, index > 0 && styles.itemDivided]}
              // onPressIn: обычное нажатие не успевает — потеря фокуса
              // убирает список раньше, чем касание доходит до обработчика.
              onPressIn={() => pick(item)}
            >
              <Text style={styles.itemText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    color: colors.textMuted, fontSize: font.tiny, fontWeight: '900',
    marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  clear: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '900' },
  input: {
    height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body,
  },
  box: {
    borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden',
  },
  item: { paddingHorizontal: space.md, paddingVertical: 11 },
  itemDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemText: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  note: {
    paddingHorizontal: space.md, paddingVertical: 11,
    color: colors.textFaint, fontSize: font.tiny, fontWeight: '700',
  },
});
