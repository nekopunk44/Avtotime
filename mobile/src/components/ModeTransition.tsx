import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

/**
 * Кинопереход между Соцсетью и Маркетом: экран затемняется, появляется иконка
 * текущего режима и флипом перестраивается в иконку целевого; сама навигация
 * происходит в середине, под непрозрачным фоном, поэтому смены экранов не
 * видно. Обратное направление — та же хореография с обратной парой иконок.
 *
 * Оверлей живёт над NavigationContainer; экраны запускают его через
 * playModeTransition и не знают о деталях анимации.
 */

type ModeIcon = keyof typeof Ionicons.glyphMap;

interface TransitionRequest {
  fromIcon: ModeIcon;
  toIcon: ModeIcon;
  onSwitch: () => void;
}

let requestListener: ((request: TransitionRequest) => void) | null = null;
let running = false;

export const playModeTransition = (
  to: 'social' | 'market',
  onSwitch: () => void,
) => {
  // Повторный тап во время перехода не должен наслаивать второй.
  if (running || !requestListener) {
    if (!requestListener) onSwitch();
    return;
  }
  const icons: Record<'social' | 'market', ModeIcon> = {
    social: 'people',
    market: 'storefront',
  };
  requestListener({
    fromIcon: icons[to === 'market' ? 'social' : 'market'],
    toIcon: icons[to],
    onSwitch,
  });
};

export default function ModeTransition() {
  const [request, setRequest] = useState<TransitionRequest | null>(null);
  const overlay = useRef(new Animated.Value(0)).current;
  // 0 → иконка «откуда» анфас; 0.5 — ребро (момент подмены); 1 — иконка «куда».
  const flip = useRef(new Animated.Value(0)).current;
  const [showTarget, setShowTarget] = useState(false);

  useEffect(() => {
    requestListener = setRequest;
    return () => {
      requestListener = null;
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    running = true;
    setShowTarget(false);
    overlay.setValue(0);
    flip.setValue(0);

    // Флип разбит на две фазы с колбэком между ними: у нативно-ведомой
    // анимации JS-слушатели значения не вызываются, так что «поймать ребро»
    // слушателем нельзя.
    Animated.sequence([
      Animated.timing(overlay, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.delay(60),
      Animated.timing(flip, {
        toValue: 0.5,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Бейдж повёрнут ребром, фон непрозрачен: подменяем иконку и экраны.
      setShowTarget(true);
      request.onSwitch();

      Animated.sequence([
        Animated.timing(flip, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(140),
        Animated.timing(overlay, { toValue: 0, duration: 230, useNativeDriver: true }),
      ]).start(() => {
        running = false;
        setRequest(null);
      });
    });
  }, [request, overlay, flip]);

  if (!request) return null;

  const rotateY = flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '0deg'],
  });
  // Лёгкий «вдох» на ребре подчёркивает перестройку.
  const scale = flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.82, 1],
  });
  // Бейдж появляется вместе с затемнением; итоговый масштаб — произведение
  // входа и «вдоха» (два scale в одном transform дублируются).
  const badgeIn = overlay.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const badgeScale = Animated.multiply(badgeIn, scale);

  return (
    <Animated.View style={[styles.overlay, { opacity: overlay }]} pointerEvents="auto">
      <Animated.View
        style={[
          styles.badge,
          { transform: [{ perspective: 700 }, { rotateY }, { scale: badgeScale }] },
        ]}
      >
        <Ionicons
          name={showTarget ? request.toIcon : request.fromIcon}
          size={54}
          color={colors.accent}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  badge: {
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
