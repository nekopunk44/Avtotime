import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// Вся геометрия живёт в квадрате 260×260 и масштабируется под size.
const STAGE = 260;
const CX = 130;
const CY = 104;
const R = 74;
const SWEEP = 240; // дуга спидометра, градусов
const ARC_LEN = (SWEEP / 360) * 2 * Math.PI * R;
const R_INNER = 62;
const ARC_INNER_LEN = (SWEEP / 360) * 2 * Math.PI * R_INNER;

/** Точка на циферблате: угол по часовой от «12 часов». */
function polar(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

function arcPath(r: number) {
  const a = polar(-SWEEP / 2, r);
  const b = polar(SWEEP / 2, r);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y}`;
}

const TICK_ANGLES = [-120, -80, -40, 0, 40, 80, 120];

// Штрихи скорости: за кормой и перед носом, у каждого своя задержка в цикле.
const STREAKS = [
  { x: 198, y: 100, w: 34, delay: 0 },
  { x: 204, y: 120, w: 26, delay: 420 },
  { x: 196, y: 146, w: 44, delay: 180 },
  { x: 200, y: 170, w: 30, delay: 640 },
  { x: 8, y: 142, w: 20, delay: 300 },
  { x: 2, y: 162, w: 26, delay: 760 },
];

const SPECKS = [
  { x: 52, y: 44, r: 4 },
  { x: 214, y: 60, r: 3.5 },
  { x: 38, y: 96, r: 3 },
];

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Фирменная эмблема, собранная из живых частей вместо статичной картинки:
 * шкала спидометра прочерчивает себя, деления загораются по ходу дуги,
 * стрелка раскручивается до упора и оседает на «рабочих оборотах», машина
 * влетает слева с крутящимся колесом, а штрихи скорости так и продолжают
 * проноситься мимо. Векторные слои, а не кадры — каждую часть двигает своя
 * анимация.
 */
export default function AnimatedEmblem({ size = STAGE, style }: Props) {
  // Прорисовка дуг и делений — свойства SVG, их ведёт JS-драйвер.
  const ring = useRef(new Animated.Value(ARC_LEN)).current;
  const innerRing = useRef(new Animated.Value(ARC_INNER_LEN)).current;
  const innerFade = useRef(new Animated.Value(0)).current;
  const ticks = useRef(TICK_ANGLES.map(() => new Animated.Value(0))).current;

  // Трансформы слоёв — нативный драйвер.
  const rev = useRef(new Animated.Value(-118)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const carX = useRef(new Animated.Value(-92)).current;
  const carIn = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const streaks = useRef(STREAKS.map(() => new Animated.Value(0))).current;
  const specks = useRef(SPECKS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const running: Animated.CompositeAnimation[] = [];
    const play = (a: Animated.CompositeAnimation) => { running.push(a); a.start(); };
    const loop = (a: Animated.CompositeAnimation) => play(Animated.loop(a));

    // Шкала прочерчивается, деления загораются вслед за пером.
    play(Animated.timing(ring, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }));
    play(Animated.parallel([
      Animated.timing(innerRing, { toValue: 0, duration: 520, delay: 140, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(innerFade, { toValue: 0.55, duration: 300, delay: 140, useNativeDriver: false }),
    ]));
    ticks.forEach((t, i) => {
      play(Animated.timing(t, { toValue: 1, duration: 190, delay: 90 + i * 64, useNativeDriver: false }));
    });

    // Стрелка: разгон до упора, отскок на рабочие обороты, затем лёгкое дыхание.
    play(Animated.sequence([
      Animated.delay(420),
      Animated.timing(rev, { toValue: 96, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(rev, { toValue: 44, friction: 5, tension: 30, useNativeDriver: true }),
    ]));
    loop(Animated.sequence([
      Animated.delay(1700),
      Animated.timing(wobble, { toValue: 2.5, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(wobble, { toValue: -2.5, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(wobble, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));

    // Машина влетает слева, колесо докручивается и останавливается.
    play(Animated.parallel([
      Animated.timing(carIn, { toValue: 1, duration: 320, delay: 260, useNativeDriver: true }),
      Animated.spring(carX, { toValue: 0, delay: 260, friction: 7, tension: 36, useNativeDriver: true }),
      Animated.timing(spin, { toValue: 1, duration: 1500, delay: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]));

    // Штрихи скорости проносятся мимо всё время, пока эмблема на экране.
    streaks.forEach((p, i) => {
      loop(Animated.sequence([
        Animated.timing(p, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(STREAKS[i].delay),
        Animated.timing(p, { toValue: 1, duration: 850, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]));
    });

    // Искры появляются последними — короткий пружинный «пок».
    specks.forEach((s, i) => {
      play(Animated.spring(s, { toValue: 1, delay: 820 + i * 140, friction: 4, tension: 60, useNativeDriver: true }));
    });

    return () => running.forEach((a) => a.stop());
    // Все значения созданы через useRef и стабильны.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needleAngle = Animated.add(rev, wobble).interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={[styles.stage, { transform: [{ scale: size / STAGE }] }]}>
        {/* Шкала: две дуги и деления */}
        <Svg width={STAGE} height={STAGE} style={StyleSheet.absoluteFill}>
          <AnimatedPath
            d={arcPath(R)}
            stroke={colors.white}
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${ARC_LEN}`}
            strokeDashoffset={ring}
          />
          <AnimatedPath
            d={arcPath(R_INNER)}
            stroke={colors.white}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            opacity={innerFade}
            strokeDasharray={`${ARC_INNER_LEN}`}
            strokeDashoffset={innerRing}
          />
          {TICK_ANGLES.map((deg, i) => {
            const long = i === 3;
            const a = polar(deg, long ? 52 : 57);
            const b = polar(deg, 68);
            return (
              <AnimatedLine
                key={deg}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={colors.white}
                strokeWidth={long ? 5 : 4}
                strokeLinecap="round"
                opacity={ticks[i]}
              />
            );
          })}
        </Svg>

        {/* Стрелка со ступицей — крутится вокруг центра шкалы */}
        <Animated.View style={[styles.needleLayer, { transform: [{ rotate: needleAngle }] }]}>
          <Svg width={208} height={208}>
            <Path d="M 104 116 L 99 104 L 104 46 L 109 104 Z" fill={colors.white} />
            <Circle cx={104} cy={104} r={7.5} fill={colors.white} />
            <Circle cx={104} cy={104} r={3} fill={colors.ink} />
          </Svg>
        </Animated.View>

        {/* Машина: корпус, решётка, лобовое, колесо с крутящимися спицами */}
        <Animated.View style={[styles.carLayer, { opacity: carIn, transform: [{ translateX: carX }] }]}>
          <Svg width={200} height={80}>
            <Path
              d="M 10 56 C 12 47 20 41 34 37 C 52 32 74 30 92 30 C 100 19 122 15 140 22 C 154 27 170 35 179 43 C 185 48 188 52 188 56 L 158 56 A 20 20 0 0 0 118 56 L 10 56 Z"
              fill={colors.white}
            />
            <Line x1={16} y1={51.5} x2={26} y2={51.5} stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round" />
            <Line x1={12} y1={54} x2={30} y2={54} stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round" />
            <Line x1={97} y1={29} x2={112} y2={20.5} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
            <Path d="M 100 34 C 96 40 94 46 95 52" stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round" fill="none" />
            <Circle cx={138} cy={56} r={15} fill={colors.ink} />
            <Circle cx={138} cy={56} r={17} stroke={colors.white} strokeWidth={4.5} fill="none" />
          </Svg>
          <Animated.View
            style={[styles.wheelLayer, {
              transform: [{
                rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '660deg'] }),
              }],
            }]}
          >
            <Svg width={44} height={44}>
              {[90, 210, 330].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                return (
                  <Line
                    key={deg}
                    x1={22} y1={22}
                    x2={22 + 11.5 * Math.sin(rad)} y2={22 - 11.5 * Math.cos(rad)}
                    stroke={colors.white} strokeWidth={3.5} strokeLinecap="round"
                  />
                );
              })}
              <Circle cx={22} cy={22} r={4.5} fill={colors.white} />
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* Штрихи скорости */}
        {STREAKS.map((s, i) => (
          <Animated.View
            key={`${s.x}-${s.y}`}
            style={[styles.streak, {
              left: s.x, top: s.y, width: s.w,
              opacity: streaks[i].interpolate({ inputRange: [0, 0.18, 0.6, 1], outputRange: [0, 0.9, 0.5, 0] }),
              transform: [{ translateX: streaks[i].interpolate({ inputRange: [0, 1], outputRange: [0, 38] }) }],
            }]}
          />
        ))}

        {/* Искры */}
        {SPECKS.map((s, i) => (
          <Animated.View
            key={`${s.x}-${s.y}`}
            style={[styles.speck, {
              left: s.x - s.r, top: s.y - s.r, width: s.r * 2, height: s.r * 2, borderRadius: s.r,
              opacity: specks[i], transform: [{ scale: specks[i] }],
            }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: STAGE, height: STAGE },
  needleLayer: { position: 'absolute', left: CX - 104, top: CY - 104, width: 208, height: 208 },
  carLayer: { position: 'absolute', left: 20, top: 122, width: 200, height: 80 },
  wheelLayer: { position: 'absolute', left: 116, top: 34, width: 44, height: 44 },
  streak: { position: 'absolute', height: 5, borderRadius: 3, backgroundColor: colors.white },
  speck: { position: 'absolute', backgroundColor: colors.white },
});
