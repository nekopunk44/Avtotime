import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '../../theme';
import { ToastMessage, ToastTone, useToastStore } from '../../store/toastStore';

const VISIBLE_MS = 3400;

const TONES: Record<ToastTone, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  info: { icon: 'information-circle-outline', color: colors.text },
  success: { icon: 'checkmark-circle-outline', color: colors.success },
  error: { icon: 'alert-circle-outline', color: colors.danger },
};

/**
 * Плашка с коротким сообщением поверх всех экранов. Выезжает сверху, сама
 * уходит и не мешает нажимать на экран под собой — в отличие от системного
 * диалога, который останавливал работу ради строчки текста.
 */
export default function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();

  // Сообщение держится до конца анимации ухода: иначе текст исчезал бы
  // раньше самой плашки.
  const [shown, setShown] = useState<ToastMessage | null>(toast);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      setShown(toast);
      return;
    }
    // Сообщения нет — плашка уезжает и только после этого снимается.
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setShown(null); });
  }, [toast, anim]);

  const shownId = shown?.id;
  useEffect(() => {
    if (!toast) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Каждое новое сообщение продлевает показ: таймер перезапускается по id.
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [shownId, toast, anim, hide]);

  if (!shown) return null;

  const tone = TONES[shown.tone];

  return (
    <View style={[styles.host, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.card,
          {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
          },
        ]}
      >
        <Pressable style={styles.inner} onPress={hide}>
          <Ionicons name={tone.icon} size={20} color={tone.color} />
          <Text style={styles.text}>{shown.text}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingHorizontal: space.md },
  // Без elevation-тени: на почти чёрном фоне Android рисует её тёмной
  // плитой под карточкой, и плита читалась как пустая вторая строка.
  card: {
    borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceHi,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  text: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '800', lineHeight: 19, includeFontPadding: false },
});
