import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, shadow, space } from '../../theme';
import PressableScale from './PressableScale';

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
  const slide = useRef(new Animated.Value(48)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(48);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      ]).start();
    }
  }, [visible, slide, fade]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

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
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    marginBottom: space.lg,
  },
  title: { color: colors.text, fontSize: font.h2, fontWeight: '900' },
  message: {
    color: colors.textMuted,
    fontSize: font.body,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: space.xs + 2,
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
