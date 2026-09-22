import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../theme';

/**
 * Переход Соцсеть <-> Маркет: направленная «продувка».
 *
 * Раньше экран просто затемнялся и на чёрном шёл морф иконки — два мёртвых
 * фейда по краям и никакой связи с жестом. Теперь через экран в направлении
 * переключения проносится сплошная панель, и всё происходит внутри неё одним
 * непрерывным движением:
 *
 *   1. Панель влетает со стороны целевого режима (в Маркет — справа, как едет
 *      бегунок переключателя) и накрывает экран. На ней уже стоит эмблема
 *      текущего режима.
 *   2. «Ветер» разносит эмблему на фрагменты по направлению движения — первым
 *      срывает наветренный край. Навстречу, с той же стороны, прилетают
 *      фрагменты целевой эмблемы и оседают по ветру; под ней проявляется имя
 *      режима. Экраны переключаются под накрытой панелью.
 *   3. Панель, не меняя направления, уносится за противоположный край и
 *      открывает новый экран. Эмблема и подпись уезжают вместе с ней.
 *
 * Один вектор движения от начала до конца: нет момента «замерли и поехали
 * обратно», а направление панели совпадает с движением бегунка в шапке.
 *
 * Фрагменты — сетка GRID x GRID клип-ячеек, в каждой полная иконка со
 * смещением. Разлёт и сборку ведёт одно значение progress 0→1, разбитое на
 * две фазы (0→0.5 с ускорением, 0.5→1 с торможением): у нативно-ведомой
 * анимации JS-слушатели не работают, а навигация обязана случиться строго под
 * непрозрачной панелью — в колбэке между фазами. Пара in/out-изингов
 * смыкается без рывка: скорость на стыке максимальна с обеих сторон.
 */

type ModeIcon = keyof typeof Ionicons.glyphMap;

interface TransitionRequest {
  fromIcon: ModeIcon;
  toIcon: ModeIcon;
  toLabel: string;
  /** +1 — панель летит справа налево (в Маркет), -1 — слева направо. */
  dir: 1 | -1;
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
    toLabel: to === 'market' ? 'Маркет' : 'Соцсеть',
    dir: to === 'market' ? 1 : -1,
    onSwitch,
  });
};

const SCREEN_W = Dimensions.get('window').width;
// Панель шире экрана: её скруглённые углы видны только в полёте, а на месте
// уходят за края, и покрытие остаётся сплошным.
const PANEL_OVERHANG = 36;
const PANEL_W = SCREEN_W + PANEL_OVERHANG * 2;

const ICON_SIZE = 104;
const GRID = 4;
const PIECE = ICON_SIZE / GRID;
// Как далеко ветер уносит фрагменты старой эмблемы и откуда прилетают новые.
const BLOW_OUT = ICON_SIZE * 1.15;
const BLOW_IN = ICON_SIZE * 1.35;
// Волновые запаздывания по столбцам: срыв идёт с наветренного края, посадка
// закрывается к нему же — сборка «дозревает» вслед за порывом.
const OUT_LAG = 0.1;
const IN_LAG = 0.12;

interface Piece {
  row: number;
  col: number;
  /** Смещение центра фрагмента от центра иконки. */
  cx: number;
  cy: number;
  /** 0..1 вдоль оси X: 0 — левый столбец, 1 — правый. */
  colNorm: number;
  /** Детерминированный разброс 0.92..1.08 — живость без хаоса. */
  scatter: number;
}

const PIECES: Piece[] = Array.from({ length: GRID * GRID }, (_, index) => {
  const row = Math.floor(index / GRID);
  const col = index % GRID;
  // Псевдослучайность из номера фрагмента: стабильна между запусками.
  const noise = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
  return {
    row,
    col,
    cx: (col + 0.5 - GRID / 2) * PIECE,
    cy: (row + 0.5 - GRID / 2) * PIECE,
    colNorm: GRID > 1 ? col / (GRID - 1) : 0,
    scatter: 0.92 + noise * 0.16,
  };
});

export default function ModeTransition() {
  const [request, setRequest] = useState<TransitionRequest | null>(null);
  // 0 — панель за стартовым краем, 1 — накрыла экран, 2 — ушла за противоположный.
  const panel = useRef(new Animated.Value(0)).current;
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
    panel.setValue(0);
    progress.setValue(0);

    Animated.sequence([
      // Панель прилетает быстро и мягко досаживается — рука только что
      // нажала кнопку, отклик должен быть немедленным.
      Animated.timing(panel, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(40),
      Animated.timing(progress, {
        toValue: 0.5,
        duration: 460,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Середина морфа, экран накрыт: переключаем режимы под панелью.
      request.onSwitch();

      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(140),
        // Уходит в ту же сторону, куда летела: движение не разворачивается.
        Animated.timing(panel, {
          toValue: 2,
          duration: 340,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        running = false;
        setRequest(null);
      });
    });
  }, [request, panel, progress]);

  if (!request) return null;

  const { dir } = request;
  // Куда дует ветер: панель едет из +dir в -dir, фрагменты летят туда же.
  const windX = -dir;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{
              translateX: panel.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [dir * PANEL_W, 0, -dir * PANEL_W],
              }),
            }],
          },
        ]}
      >
        {/* Эмблема текущего режима: панель привозит её собранной, ветер
            разносит в первой половине морфа. */}
        <View style={styles.iconBox} pointerEvents="none">
          {PIECES.map((piece, index) => {
            // Наветренный столбец (откуда пришла панель) срывается первым.
            const upwind = dir === 1 ? piece.colNorm : 1 - piece.colNorm;
            const start = OUT_LAG * (1 - upwind);
            return (
              <Animated.View
                key={index}
                style={[
                  styles.piece,
                  {
                    left: piece.col * PIECE,
                    top: piece.row * PIECE,
                    opacity: progress.interpolate({
                      inputRange: [0.3, 0.52],
                      outputRange: [1, 0],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        translateX: progress.interpolate({
                          inputRange: [start, 0.54],
                          outputRange: [0, windX * BLOW_OUT * piece.scatter],
                          extrapolate: 'clamp',
                        }),
                      },
                      {
                        // Лёгкий вертикальный веер: порыв не бывает идеально ровным.
                        translateY: progress.interpolate({
                          inputRange: [start, 0.54],
                          outputRange: [0, piece.cy * 0.5 * piece.scatter],
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
            );
          })}
        </View>

        {/* Эмблема целевого режима: фрагменты прилетают той же стороной, что и
            панель, оседают по ветру, и собранная иконка чуть пружинит. */}
        <Animated.View
          style={[
            styles.iconBox,
            styles.iconBoxOverlap,
            {
              transform: [{
                scale: progress.interpolate({
                  inputRange: [0.88, 0.95, 1],
                  outputRange: [1, 1.05, 1],
                  extrapolate: 'clamp',
                }),
              }],
            },
          ]}
          pointerEvents="none"
        >
          {PIECES.map((piece, index) => {
            // Подветренные фрагменты оседают первыми: сборка закрывается
            // навстречу источнику ветра.
            const downwind = dir === 1 ? 1 - piece.colNorm : piece.colNorm;
            const end = 1 - IN_LAG * downwind;
            return (
              <Animated.View
                key={index}
                style={[
                  styles.piece,
                  {
                    left: piece.col * PIECE,
                    top: piece.row * PIECE,
                    opacity: progress.interpolate({
                      inputRange: [0.42, 0.6],
                      outputRange: [0, 1],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        translateX: progress.interpolate({
                          inputRange: [0.42, end],
                          outputRange: [dir * BLOW_IN * piece.scatter, 0],
                          extrapolate: 'clamp',
                        }),
                      },
                      {
                        translateY: progress.interpolate({
                          inputRange: [0.42, end],
                          outputRange: [piece.cy * 0.25, 0],
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
            );
          })}
        </Animated.View>

        {/* Имя режима догоняет эмблему тем же курсом и уедет вместе с панелью. */}
        <Animated.Text
          style={[
            styles.label,
            {
              opacity: progress.interpolate({
                inputRange: [0.66, 0.84],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              transform: [{
                translateX: progress.interpolate({
                  inputRange: [0.66, 0.92],
                  outputRange: [dir * 36, 0],
                  extrapolate: 'clamp',
                }),
              }],
            },
          ]}
        >
          {request.toLabel}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -PANEL_OVERHANG,
    width: PANEL_W,
    borderRadius: 32,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  // Оба слоя эмблемы занимают одно и то же место в центре панели.
  iconBoxOverlap: {
    position: 'absolute',
  },
  piece: {
    position: 'absolute',
    width: PIECE,
    height: PIECE,
    overflow: 'hidden',
  },
  label: {
    marginTop: 18,
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
