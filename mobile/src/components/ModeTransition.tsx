import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * Кинопереход между Соцсетью и Маркетом: экран затемняется, иконка текущего
 * режима ПЛАВНО РАСПАДАЕТСЯ на фрагменты, а затем фрагменты сходятся обратно —
 * уже собираясь в иконку целевого режима. Обратное направление — та же
 * механика с обратной парой иконок.
 *
 * Фрагменты — сетка GRID x GRID клип-ячеек: в каждой лежит полная иконка со
 * смещением, так что ячейка показывает только свой участок глифа. Распад
 * упорядоченный, как «разнесённая схема» в чертежах: каждый фрагмент уходит
 * строго по своей радиальной оси на расстояние, пропорциональное удалению от
 * центра, — сетка равномерно раздвигается без вращений и случайного разброса.
 * Все фрагменты ведёт одно Animated-значение. Навигация выполняется в момент
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
// Насколько раздвигается сетка при полном распаде: смещение фрагмента =
// его отступ от центра, умноженный на этот коэффициент.
const SPREAD = 1.9;

interface Piece {
  row: number;
  col: number;
  dx: number;
  dy: number;
}

const PIECES: Piece[] = Array.from({ length: GRID * GRID }, (_, index) => {
  const row = Math.floor(index / GRID);
  const col = index % GRID;
  const cx = (col + 0.5 - GRID / 2) * PIECE;
  const cy = (row + 0.5 - GRID / 2) * PIECE;
  return { row, col, dx: cx * SPREAD, dy: cy * SPREAD };
});

export default function ModeTransition() {
  const [request, setRequest] = useState<TransitionRequest | null>(null);
  const overlay = useRef(new Animated.Value(0)).current;
  // 0 — иконка собрана; 1 — сетка полностью раздвинута (фрагменты прозрачны).
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
      Animated.timing(overlay, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.delay(90),
      Animated.timing(scatter, {
        toValue: 1,
        duration: 620,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Фрагментов не видно, фон непрозрачен: подменяем иконку и экраны.
      setShowTarget(true);
      request.onSwitch();

      Animated.sequence([
        Animated.timing(scatter, {
          toValue: 0,
          duration: 680,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(180),
        Animated.timing(overlay, { toValue: 0, duration: 280, useNativeDriver: true }),
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
                  // Фрагменты видны большую часть пути и мягко гаснут к концу.
                  inputRange: [0, 0.6, 1],
                  outputRange: [1, 0.9, 0],
                }),
                transform: [
                  { translateX: scatter.interpolate({ inputRange: [0, 1], outputRange: [0, piece.dx] }) },
                  { translateY: scatter.interpolate({ inputRange: [0, 1], outputRange: [0, piece.dy] }) },
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
