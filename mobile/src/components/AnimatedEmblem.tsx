import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { EMBLEM_CANVAS, EMBLEM_LAYERS, EmblemLayerName } from './emblemLayers';

// Штрихи скорости: очередь въезда слева и сдвиг мерцания в холостом цикле.
const STREAKS: { name: EmblemLayerName; delay: number; from: number }[] = [
  { name: 'tr1', delay: 480, from: -220 },
  { name: 'tr2', delay: 560, from: -220 },
  { name: 'tr3', delay: 640, from: -220 },
  { name: 'tr4', delay: 720, from: -220 },
  { name: 'mid', delay: 540, from: -260 },
  { name: 'br1', delay: 600, from: -260 },
  { name: 'br2', delay: 660, from: -260 },
  { name: 'fl1', delay: 700, from: -160 },
  { name: 'fl2', delay: 780, from: -160 },
  { name: 'fl3', delay: 860, from: -160 },
];

const GRILLE: EmblemLayerName[] = ['grille1', 'grille2', 'grille3', 'grille4', 'grille5'];
const SPECKS: EmblemLayerName[] = ['specksLeft', 'specksRight', 'specksBottom'];

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Фирменная эмблема, разобранная на куски настоящего логотипа: PNG порезан
 * на слои по связным областям (scripts/split_emblem.py), и каждый слой
 * въезжает по-своему — кольцо спидометра доворачивается, циферблат
 * распахивается, корпус и крыша влетают слева с параллаксом, колесо
 * прыгает на место, решётка загорается полоска за полоской, штрихи
 * скорости продолжают мерцать, искры рассыпаются последними. В покое все
 * слои стоят в нуле — картинка сходится в исходный логотип пиксель в
 * пиксель.
 */
export default function AnimatedEmblem({ size = 260, style }: Props) {
  const ringIn = useRef(new Animated.Value(0)).current;
  const ringRot = useRef(new Animated.Value(-28)).current;
  const dialIn = useRef(new Animated.Value(0)).current;
  const bodyIn = useRef(new Animated.Value(0)).current;
  const bodyX = useRef(new Animated.Value(-430)).current;
  const topIn = useRef(new Animated.Value(0)).current;
  const topX = useRef(new Animated.Value(-560)).current;
  const wheelIn = useRef(new Animated.Value(0)).current;
  const grilleIn = useRef(GRILLE.map(() => new Animated.Value(0))).current;
  const grilleX = useRef(GRILLE.map(() => new Animated.Value(-40))).current;
  const streakOp = useRef(STREAKS.map(() => new Animated.Value(0))).current;
  const streakX = useRef(STREAKS.map((s) => new Animated.Value(s.from))).current;
  const speckIn = useRef(SPECKS.map(() => new Animated.Value(0))).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const running: Animated.CompositeAnimation[] = [];
    const play = (a: Animated.CompositeAnimation) => { running.push(a); a.start(); };

    // Кольцо спидометра доворачивается на место, следом распахивается циферблат.
    play(Animated.parallel([
      Animated.timing(ringIn, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(ringRot, { toValue: 0, friction: 6, tension: 32, useNativeDriver: true }),
    ]));
    play(Animated.timing(dialIn, { toValue: 1, duration: 200, delay: 140, useNativeDriver: true }));

    // Корпус и крыша влетают слева с разной глубины — эффект сборки на ходу.
    play(Animated.parallel([
      Animated.timing(bodyIn, { toValue: 1, duration: 220, delay: 240, useNativeDriver: true }),
      Animated.spring(bodyX, { toValue: 0, delay: 240, friction: 7, tension: 34, useNativeDriver: true }),
      Animated.timing(topIn, { toValue: 1, duration: 220, delay: 320, useNativeDriver: true }),
      Animated.spring(topX, { toValue: 0, delay: 320, friction: 7, tension: 30, useNativeDriver: true }),
    ]));

    // Колесо запрыгивает на уже подъехавший корпус.
    play(Animated.timing(wheelIn, { toValue: 1, duration: 160, delay: 420, useNativeDriver: true }));

    // Решётка радиатора загорается полоска за полоской, снизу вверх.
    GRILLE.forEach((_, i) => {
      play(Animated.parallel([
        Animated.timing(grilleIn[i], { toValue: 1, duration: 150, delay: 640 + i * 70, useNativeDriver: true }),
        Animated.timing(grilleX[i], { toValue: 0, duration: 220, delay: 640 + i * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]));
    });

    // Штрихи скорости: догоняют машину, а потом мерцают, как встречный ветер.
    STREAKS.forEach((s, i) => {
      play(Animated.timing(streakX[i], { toValue: 0, duration: 420, delay: s.delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }));
      play(Animated.sequence([
        Animated.timing(streakOp[i], { toValue: 1, duration: 180, delay: s.delay, useNativeDriver: true }),
        Animated.delay(1200 + i * 220),
        Animated.loop(Animated.sequence([
          Animated.timing(streakOp[i], { toValue: 0.72, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(streakOp[i], { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])),
      ]));
    });

    // Искры рассыпаются последними.
    SPECKS.forEach((_, i) => {
      play(Animated.timing(speckIn[i], { toValue: 1, duration: 140, delay: 900 + i * 100, useNativeDriver: true }));
    });

    // Едва заметное дыхание всей эмблемы, чтобы она не замирала намертво.
    play(Animated.sequence([
      Animated.delay(2000),
      Animated.loop(Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
    ]));

    return () => running.forEach((a) => a.stop());
    // Все значения созданы через useRef и стабильны.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const k = size / EMBLEM_CANVAS;
  const layerStyle = (name: EmblemLayerName): ViewStyle => {
    const l = EMBLEM_LAYERS[name];
    return { position: 'absolute', left: l.x, top: l.y, width: l.w, height: l.h };
  };
  const img = (name: EmblemLayerName) => (
    <Image source={EMBLEM_LAYERS[name].src} style={styles.fill} resizeMode="stretch" fadeDuration={0} />
  );
  const pop = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
  });

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View
        style={[
          styles.stage,
          {
            left: (size - EMBLEM_CANVAS) / 2,
            top: (size - EMBLEM_CANVAS) / 2,
            transform: [
              { scale: k },
              { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
            ],
          },
        ]}
      >
        <Animated.View style={[layerStyle('ring'), {
          opacity: ringIn,
          transform: [{ rotate: ringRot.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] }) }],
        }]}>
          {img('ring')}
        </Animated.View>

        <Animated.View style={[layerStyle('dial'), {
          opacity: dialIn,
          transform: [{ scale: dialIn.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }]}>
          {img('dial')}
        </Animated.View>

        {STREAKS.map((s, i) => (
          <Animated.View key={s.name} style={[layerStyle(s.name), {
            opacity: streakOp[i], transform: [{ translateX: streakX[i] }],
          }]}>
            {img(s.name)}
          </Animated.View>
        ))}

        <Animated.View style={[layerStyle('carBody'), { opacity: bodyIn, transform: [{ translateX: bodyX }] }]}>
          {img('carBody')}
        </Animated.View>
        <Animated.View style={[layerStyle('carTop'), { opacity: topIn, transform: [{ translateX: topX }] }]}>
          {img('carTop')}
        </Animated.View>
        <Animated.View style={[layerStyle('wheel'), pop(wheelIn)]}>
          {img('wheel')}
        </Animated.View>

        {GRILLE.map((name, i) => (
          <Animated.View key={name} style={[layerStyle(name), {
            opacity: grilleIn[i], transform: [{ translateX: grilleX[i] }],
          }]}>
            {img(name)}
          </Animated.View>
        ))}

        {SPECKS.map((name, i) => (
          <Animated.View key={name} style={[layerStyle(name), pop(speckIn[i])]}>
            {img(name)}
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'absolute', width: EMBLEM_CANVAS, height: EMBLEM_CANVAS },
  fill: { width: '100%', height: '100%' },
});
