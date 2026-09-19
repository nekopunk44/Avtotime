import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, shadow, space } from '../../theme';

// Ход выезда заведомо больше панели: старт всегда за краем экрана, иначе
// вместо движения получается скачок.
const SHEET_TRAVEL = Dimensions.get('window').height;

interface ChoiceSheetProps {
  visible: boolean;
  title: string;
  options: string[];
  value?: string;
  /** Подпись пункта, который сбрасывает выбор. Без неё сброса не будет. */
  clearLabel?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/**
 * Выбор одного значения из готового списка. Печатать «Бензин» или «Автомат»
 * руками незачем: вариантов немного, и они известны заранее.
 */
export default function ChoiceSheet({
  visible, title, options, value, clearLabel, onSelect, onClose,
}: ChoiceSheetProps) {
  // Модалка живёт до конца анимации ухода — иначе панель исчезает вместо
  // того, чтобы уехать вниз.
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setMounted(false); });
  }, [visible, anim]);

  if (!mounted) return null;

  const pick = (next: string) => {
    onSelect(next);
    onClose();
  };

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: anim }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + space.md },
            {
              transform: [{
                translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [SHEET_TRAVEL, 0] }),
              }],
            },
          ]}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>

          <ScrollView style={styles.list} bounces={false}>
            {clearLabel ? (
              <Pressable
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => pick('')}
              >
                <Text style={[styles.optionText, styles.optionMuted]}>{clearLabel}</Text>
                {!value ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
              </Pressable>
            ) : null}

            {options.map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => pick(option)}
              >
                <Text style={styles.optionText}>{option}</Text>
                {value === option ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: space.md, paddingTop: space.sm,
    maxHeight: '75%',
    ...shadow.float,
  },
  grabber: {
    alignSelf: 'center', width: 42, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi, marginBottom: space.md,
  },
  title: { textAlign: 'center', color: colors.text, fontSize: font.h3, fontWeight: '900', marginBottom: space.sm },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 50, paddingHorizontal: space.md, borderRadius: radius.md,
  },
  optionPressed: { backgroundColor: colors.surfaceAlt },
  optionText: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  optionMuted: { color: colors.textMuted },
});
