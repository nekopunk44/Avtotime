import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, shadow, space } from '../../theme';
import PressableScale from './PressableScale';

// Ход выезда: заведомо больше любой панели, чтобы старт всегда был за краем
// экрана, а не с середины — иначе вместо движения получается скачок.
const SHEET_TRAVEL = Dimensions.get('window').height;

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Разрушительное действие красит подтверждение в danger. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Кастомное подтверждение вместо системного Alert: тёмная шторка в языке
 * приложения. Тап по подложке равен «отмене» — случайное касание не должно
 * выполнять действие.
 *
 * Панель идёт за пальцем и закрывается, если утянуть её вниз: полоска-грабер
 * обещает это движение, и она не должна обманывать.
 */
export default function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  // Модалка живёт до конца анимации ухода — иначе шторка исчезала бы
  // мгновенно вместо того, чтобы уехать вниз.
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;
  // Смещение пальцем. Драйвер общий (JS): нативная и не-нативная анимации на
  // одном transform несовместимы.
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      anim.setValue(0);
      drag.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    Animated.parallel([
      Animated.timing(anim, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      Animated.timing(drag, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, anim, drag]);

  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  const pan = useRef(
    PanResponder.create({
      // Захват с первого касания: жест живёт на шапке, где нет кнопок, и
      // ожидание движения только мешало — панель не трогалась с места.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) drag.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        // Либо утянули достаточно далеко, либо бросили резким движением вниз.
        if (g.dy > 80 || g.vy > 0.9) {
          cancelRef.current();
          return;
        }
        Animated.spring(drag, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 14 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 14 }).start();
      },
    }),
  ).current;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: Animated.add(
                    anim.interpolate({ inputRange: [0, 1], outputRange: [SHEET_TRAVEL, 0] }),
                    drag,
                  ),
                },
              ],
            },
          ]}
        >
          {/* Тянется шапка: в ней нет кнопок, поэтому жест можно забирать
              сразу по касанию. */}
          <View {...pan.panHandlers} style={styles.handleZone}>
            <View style={styles.grabber} />
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          <View style={styles.actions}>
            <PressableScale style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.confirmBtn, destructive && styles.confirmBtnDanger]}
              onPress={onConfirm}
            >
              <Text style={[styles.confirmText, destructive && styles.confirmTextDanger]}>
                {confirmLabel}
              </Text>
            </PressableScale>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    paddingTop: space.sm,
    ...shadow.card,
  },
  handleZone: { paddingBottom: space.sm },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    marginBottom: space.lg,
  },
  title: { color: colors.text, fontSize: font.h2, fontWeight: '900', textAlign: 'center' },
  message: {
    color: colors.textMuted,
    fontSize: font.body,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: space.xs + 2,
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  confirmBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDanger: { backgroundColor: colors.danger },
  confirmText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
  confirmTextDanger: { color: colors.white },
});
