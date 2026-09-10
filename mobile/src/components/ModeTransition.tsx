import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * Кинопереход между Соцсетью и Маркетом: экран затемняется, иконка текущего
 * режима плавно распадается на фрагменты, и НАВСТРЕЧУ им из глубины сходятся
 * фрагменты иконки целевого режима — обе живут в кадре одновременно,
 * растворяясь одна в другую. Момента «подмены» не существует: старые
 * фрагменты тают в полёте, новые материализуются дальше от центра уже в
 * движении к своим местам.
 *
 * Фрагменты — сетка GRID x GRID клип-ячеек: в каждой лежит полная иконка со
 * смещением, так что ячейка показывает только свой участок глифа. Распад
 * упорядоченный, по радиальным осям, с волной от краёв к центру; сборка —
 * обратной волной, от центра к краям. Обе иконки ведёт ОДНО Animated-значение
 * progress 0→1: у исходной интерполяции живут в первой половине, у целевой —
 * во второй, с перехлёстом вокруг середины.
 *
 * progress разбит на две последовательные фазы (0→0.5 с ускорением, 0.5→1 с
 * торможением): у нативно-ведомой анимации JS-слушатели значения не
 * вызываются, а навигацию нужно выполнить строго под непрозрачным фоном — в
 * колбэке между фазами. Пара in/out-изингов смыкается в один плавный свод:
 * скорость на стыке максимальна с обеих сторон, рывка нет.
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
// Насколько раздвигается сетка исходной иконки при полном распаде.
const SPREAD_OUT = 1.9;
// Фрагменты целевой стартуют чуть дальше — сходятся из более широкого круга.
const SPREAD_IN = 2.3;
// Волновые запаздывания: распад начинают внешние фрагменты, сборку
// завершают тоже внешние — иконка «закрывается» от центра к краям.
const OUT_LAG = 0.1;
const IN_LAG = 0.12;

interface Piece {
  row: number;
  col: number;
  dxOut: number;
  dyOut: number;
  dxIn: number;
  dyIn: number;
  /** 0..1 — удаление фрагмента от центра иконки. */
  rNorm: number;
}

const R_MAX = Math.hypot((GRID / 2 - 0.5) * PIECE, (GRID / 2 - 0.5) * PIECE);

const PIECES: Piece[] = Array.from({ length: GRID * GRID }, (_, index) => {
  const row = Math.floor(index / GRID);
  const col = index % GRID;
  const cx = (col + 0.5 - GRID / 2) * PIECE;
  const cy = (row + 0.5 - GRID / 2) * PIECE;
  return {
    row,
    col,
    dxOut: cx * SPREAD_OUT,
    dyOut: cy * SPREAD_OUT,
    dxIn: cx * SPREAD_IN,
    dyIn: cy * SPREAD_IN,
    rNorm: Math.hypot(cx, cy) / R_MAX,
  };
});

export default function ModeTransition() {
  const [request, setRequest] = useState<TransitionRequest | null>(null);
  const overlay = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    requestListener = setRequest;
    return () => {
      requestListener = null;
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    running = true;
    overlay.setValue(0);
    progress.setValue(0);

    Animated.sequence([
      Animated.timing(overlay, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.delay(80),
      Animated.timing(progress, {
        toValue: 0.5,
        duration: 540,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Середина морфа, фон непрозрачен: переключаем экраны под оверлеем.
      request.onSwitch();

      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 580,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(180),
        Animated.timing(overlay, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => {
        running = false;
        setRequest(null);
      });
    });
  }, [request, overlay, progress]);

  if (!request) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlay }]} pointerEvents="auto">
      {/* Исходная иконка: расходится и тает в первой половине progress. */}
      <View style={styles.iconBox} pointerEvents="none">
        {PIECES.map((piece, index) => (
          <Animated.View
            key={index}
            style={[
              styles.piece,
              {
                left: piece.col * PIECE,
                top: piece.row * PIECE,
                opacity: progress.interpolate({
                  inputRange: [0.34, 0.56],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [OUT_LAG * (1 - piece.rNorm), 0.56],
                      outputRange: [0, piece.dxOut],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [OUT_LAG * (1 - piece.rNorm), 0.56],
                      outputRange: [0, piece.dyOut],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={{ marginLeft: -piece.col * PIECE, marginTop: -piece.row * PIECE }}>
              <Ionicons name={request.fromIcon} size={ICON_SIZE} color={colors.accent} />
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Целевая иконка: проявляется навстречу и собирается во второй половине. */}
      <View style={[styles.iconBox, styles.iconBoxOverlap]} pointerEvents="none">
        {PIECES.map((piece, index) => (
          <Animated.View
            key={index}
            style={[
              styles.piece,
              {
                left: piece.col * PIECE,
                top: piece.row * PIECE,
                opacity: progress.interpolate({
                  inputRange: [0.44, 0.62],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0.44, 1 - IN_LAG * (1 - piece.rNorm)],
                      outputRange: [piece.dxIn, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0.44, 1 - IN_LAG * (1 - piece.rNorm)],
                      outputRange: [piece.dyIn, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={{ marginLeft: -piece.col * PIECE, marginTop: -piece.row * PIECE }}>
              <Ionicons name={request.toIcon} size={ICON_SIZE} color={colors.accent} />
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
  // Оба слоя занимают одно и то же место в центре оверлея.
  iconBoxOverlap: {
    position: 'absolute',
  },
  piece: {
    position: 'absolute',
    width: PIECE,
    height: PIECE,
    overflow: 'hidden',
  },
});
