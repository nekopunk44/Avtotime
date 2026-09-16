import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, shadow, space } from '../../theme';

export type PopoverAction = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Разрушительное действие красится в danger. */
  danger?: boolean;
  onPress: () => void;
};

interface PopoverMenuProps {
  visible: boolean;
  onClose: () => void;
  actions: PopoverAction[];
  /** Отступ сверху: меню раскрывается прямо под кнопкой, которая его открыла. */
  top: number;
  title?: string;
  subtitle?: string;
}

/**
 * Меню, вырастающее из-под кнопки в шапке, вместо системного Alert: тот
 * появлялся светлой коробкой посреди тёмного экрана и уводил взгляд в центр.
 *
 * Раскрывается от правого верхнего угла — оттуда, где стоит кнопка. Тап в
 * любом месте закрывает: меню — это подсказка, а не запрос решения.
 */
export default function PopoverMenu({ visible, onClose, actions, top, title, subtitle }: PopoverMenuProps) {
  // Модалка живёт до конца анимации ухода — иначе меню пропадало бы рывком.
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;
  // Выбранное действие ждёт, пока меню растает: иначе следующий диалог
  // выскакивает поверх ещё видимого меню.
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (visible) {
      pendingRef.current = null;
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      const run = pendingRef.current;
      pendingRef.current = null;
      run?.();
    });
  }, [visible, anim]);

  if (!mounted) return null;

  const select = (action: PopoverAction) => {
    pendingRef.current = action.onPress;
    onClose();
  };

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.card,
          { top },
          {
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
            ],
          },
        ]}
      >
        {title ? (
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        ) : null}

        {actions.map((action) => (
          <Pressable
            key={action.key}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => select(action)}
          >
            <Ionicons
              name={action.icon}
              size={19}
              color={action.danger ? colors.danger : colors.textMuted}
            />
            <Text style={[styles.label, action.danger && styles.labelDanger]}>{action.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    position: 'absolute', right: space.md,
    minWidth: 228, maxWidth: 300,
    paddingVertical: space.xs,
    borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    transformOrigin: 'top right',
    ...shadow.float,
  },
  head: {
    paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    marginBottom: space.xs,
  },
  title: { color: colors.text, fontSize: font.small, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    height: 46, paddingHorizontal: space.md, borderRadius: radius.md,
    marginHorizontal: space.xs,
  },
  itemPressed: { backgroundColor: colors.surfaceAlt },
  label: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '800' },
  labelDanger: { color: colors.danger },
});
