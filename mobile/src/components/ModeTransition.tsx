import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

/**
 * Кинопереход между Соцсетью и Маркетом: экран затемняется, иконка текущего
 * режима РАЗБИВАЕТСЯ на осколки, они разлетаются, а затем слетаются обратно —
 * уже собираясь в иконку целевого режима. Обратное направление — та же
 * механика с обратной парой иконок.
 *
 * Осколки — это сетка GRID x GRID клип-ячеек: в каждой лежит полная иконка со
 * смещением, так что ячейка показывает только свой фрагмент глифа. Все
 * осколки ведёт одно Animated-значение, разлёт каждого — собственная
 * интерполяция по детерминированному вектору (радиально от центра с
 * псевдослучайным джиттером по индексу). Навигация выполняется в момент
 * полного распада, под непрозрачным фоном.
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

const ICON_SIZE = 104;
const GRID = 4;
const PIECE = ICON_SIZE / GRID;

// Детерминированный «случай»: один и тот же осколок всегда летит одинаково,
// но соседние — заметно по-разному.
const jitter = (index: number, salt: number) => {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x); // 0..1
};

interface Piece {
  row: number;
  col: number;
  dx: number;
  dy: number;
  rotate: number;
}

const PIECES: Piece[] = Array.from({ length: GRID * GRID }, (_, index) => {
  const row = Math.floor(index / GRID);
  const col = index % GRID;
  // Направление — радиально от центра иконки, чтобы разлёт читался взрывом.
  const cx = col + 0.5 - GRID / 2;
  const cy = row + 0.5 - GRID / 2;
  const len = Math.max(Math.hypot(cx, cy), 0.4);
  const distance = 70 + jitter(index, 1) * 90;
  return {
    row,
    col,
    dx: (cx / len) * distance + (jitter(index, 2) - 0.5) * 40,
    dy: (cy / len) * distance + (jitter(index, 3) - 0.5) * 40,
    rotate: (jitter(index, 4) - 0.5) * 260,
  };
});

export default function ModeTransition() {
  const [request, setRequest] = useState<TransitionRequest | null>(null);
  const overlay = useRef(new Animated.Value(0)).current;
  // 0 — иконка собрана; 1 — полностью разлетелась (осколки прозрачны).
  const scatter = useRef(new Animated.Value(0)).current;
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
    scatter.setValue(0);

    // Две фазы с колбэком между ними: у нативно-ведомой анимации JS-слушатели
    // значения не вызываются, момент полного распада ловится только так.
    Animated.sequence([
      Animated.timing(overlay, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.delay(70),
      // Распад: резкий старт, осколки гаснут к краям разлёта.
      Animated.timing(scatter, {
        toValue: 1,
        duration: 320,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Осколков не видно, фон непрозрачен: подменяем иконку и экраны.
      setShowTarget(true);
      request.onSwitch();

      Animated.sequence([
        // Сборка: осколки слетаются и «защёлкиваются» с лёгким овершутом.
        Animated.timing(scatter, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.delay(150),
        Animated.timing(overlay, { toValue: 0, duration: 230, useNativeDriver: true }),
      ]).start(() => {
        running = false;
        setRequest(null);
      });
    });
  }, [request, overlay, scatter]);

  if (!request) return null;

  const icon = showTarget ? request.toIcon : request.fromIcon;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlay }]} pointerEvents="auto">
      <View style={styles.badge} />
      <View style={styles.iconBox} pointerEvents="none">
        {PIECES.map((piece, index) => (
          <Animated.View
            key={index}
            style={[
              styles.piece,
              {
                left: piece.col * PIECE,
                top: piece.row * PIECE,
                opacity: scatter.interpolate({
                  // Осколки живы почти весь полёт и гаснут у самого края.
                  inputRange: [0, 0.75, 1],
                  outputRange: [1, 0.8, 0],
                }),
                transform: [
                  { translateX: scatter.interpolate({ inputRange: [0, 1], outputRange: [0, piece.dx] }) },
                  { translateY: scatter.interpolate({ inputRange: [0, 1], outputRange: [0, piece.dy] }) },
                  { rotate: scatter.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.rotate}deg`] }) },
                  { scale: scatter.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
                ],
              },
            ]}
          >
            {/* Полная иконка со смещением: ячейка показывает свой фрагмент. */}
            <View style={{ marginLeft: -piece.col * PIECE, marginTop: -piece.row * PIECE }}>
              <Ionicons name={icon} size={ICON_SIZE} color={colors.accent} />
            </View>
          </Animated.View>
        ))}
      </View>
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
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  iconBox: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  piece: {
    position: 'absolute',
    width: PIECE,
    height: PIECE,
    overflow: 'hidden',
  },
});
