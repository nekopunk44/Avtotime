import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, shadow, space } from '../../theme';

// Ход выезда заведомо больше панели: старт всегда за краем экрана, иначе
// вместо движения получается скачок.
const SHEET_TRAVEL = Dimensions.get('window').height;

interface FormSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Шторка с формой: та же оболочка, что у выбора и подтверждения, но внутри
 * поля ввода. Клавиатура поднимает панель по своим событиям —
 * KeyboardAvoidingView под edge-to-edge оставлял её обрезанной.
 */
export default function FormSheet({ visible, title, subtitle, onClose, children }: FormSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;
  // Смещение пальцем и подъём под клавиатуру идут тем же (JS) драйвером:
  // нативная и не-нативная анимации на одном transform несовместимы.
  const drag = useRef(new Animated.Value(0)).current;
  const kbLift = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      anim.setValue(0);
      drag.setValue(0);
      Animated.timing(anim, {
        toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
      return;
    }
    Animated.parallel([
      Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      Animated.timing(drag, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(({ finished }) => { if (finished) setMounted(false); });
  }, [visible, anim, drag]);

  useEffect(() => {
    const glide = (height: number, duration?: number) => {
      Animated.timing(kbLift, {
        // Полная высота клавиатуры: пока она открыта, safe-area снизу
        // отдаётся нулём, и вычитание прятало низ формы под её край.
        toValue: height,
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

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const pan = useRef(
    PanResponder.create({
      // Захват с первого касания: жест живёт на шапке, где нет полей ввода.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) drag.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.9) {
          Keyboard.dismiss();
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

  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.root, { paddingBottom: kbLift }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); onClose(); }}>
          <Animated.View style={[styles.backdrop, { opacity: anim }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: kbLift.interpolate({
                inputRange: [0, 1],
                outputRange: [insets.bottom + space.lg, space.lg],
                extrapolate: 'clamp',
              }),
            },
            {
              transform: [{
                translateY: Animated.add(
                  anim.interpolate({ inputRange: [0, 1], outputRange: [SHEET_TRAVEL, 0] }),
                  drag,
                ),
              }],
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.handleZone}>
            <View style={styles.grabber} />
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg, paddingTop: space.sm,
    ...shadow.float,
  },
  handleZone: { paddingBottom: space.md },
  grabber: {
    alignSelf: 'center', width: 42, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi, marginBottom: space.md,
  },
  title: { textAlign: 'center', color: colors.text, fontSize: font.h3, fontWeight: '900' },
  subtitle: {
    marginTop: 4, textAlign: 'center', color: colors.textMuted,
    fontSize: font.small, lineHeight: 19, fontWeight: '600',
  },
});
