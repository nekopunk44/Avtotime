import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

// Small stylised car used in both outcome scenes.
function CarSvg({ color = '#EDEFF3' }: { color?: string }) {
  return (
    <Svg width={94} height={46} viewBox="0 0 94 46">
      <Path
        d="M4 32 L4 30 C4 27 6 26 9 25 L20 24 L30 13 C32 11 34 10 38 10 L58 10 C62 10 65 11 68 14 L78 24 L86 26 C90 27 90 30 90 32 L90 34 C90 35 89 36 88 36 L6 36 C5 36 4 35 4 34 Z"
        fill={color}
      />
      <Path d="M34 14 L56 14 C59 14 61 15 63 17 L69 23 L34 23 Z" fill="#11131A" opacity={0.55} />
      <Circle cx={26} cy={37} r={8} fill="#11131A" />
      <Circle cx={26} cy={37} r={3.4} fill={color} />
      <Circle cx={68} cy={37} r={8} fill="#11131A" />
      <Circle cx={68} cy={37} r={3.4} fill={color} />
      <Rect x={84} y={28} width={5} height={4} rx={1.5} fill="#F6B23D" />
    </Svg>
  );
}

const SEASONS = [
  { label: 'Зима', emoji: '❄️', bg: '#1E2E3C' },
  { label: 'Весна', emoji: '🌸', bg: '#223E2C' },
  { label: 'Лето', emoji: '☀️', bg: '#3B331E' },
  { label: 'Осень', emoji: '🍂', bg: '#3A271B' },
];

export default function ExamOutcomeScene({ passed }: { passed: boolean }) {
  const [width, setWidth] = useState(0);
  const [season, setSeason] = useState(0);
  const drive = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!passed) return undefined;
    const id = setInterval(() => setSeason((s) => (s + 1) % SEASONS.length), 1500);
    return () => clearInterval(id);
  }, [passed]);

  useEffect(() => {
    if (!width) return undefined;
    if (passed) {
      drive.setValue(0);
      const loop = Animated.loop(
        Animated.timing(drive, { toValue: 1, duration: 3400, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
      return () => loop.stop();
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drive, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(drive, { toValue: 1, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(tilt, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
            Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(flash, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [width, passed, drive, flash, tilt, shake]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const carX = passed
    ? drive.interpolate({ inputRange: [0, 1], outputRange: [-100, width + 40] })
    : drive.interpolate({ inputRange: [0, 1], outputRange: [-100, Math.max(0, width / 2 - 47)] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] });
  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-16deg'] });

  const bg = passed ? SEASONS[season].bg : '#301619';

  return (
    <View style={[styles.stage, { backgroundColor: bg }]} onLayout={onLayout}>
      {passed ? (
        <View style={styles.seasonBadge}>
          <Text style={styles.seasonEmoji}>{SEASONS[season].emoji}</Text>
          <Text style={styles.seasonLabel}>{SEASONS[season].label}</Text>
        </View>
      ) : null}

      <View style={styles.road} />
      <View style={styles.roadLine} />

      <Animated.View style={[styles.car, { transform: [{ translateX: carX }, { translateX: shakeX }, { rotate }] }]}>
        <CarSvg />
      </Animated.View>

      {!passed ? (
        <>
          <Animated.Text style={[styles.boom, { opacity: flash }]}>💥</Animated.Text>
          <Animated.View style={[styles.crashFlash, { opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', height: 150, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  seasonBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  seasonEmoji: { fontSize: 14 },
  seasonLabel: { color: '#fff', fontSize: 12, fontWeight: '900' },
  road: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 34, backgroundColor: 'rgba(0,0,0,0.28)' },
  roadLine: { position: 'absolute', left: 0, right: 0, bottom: 16, height: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  car: { position: 'absolute', left: 0, bottom: 20 },
  boom: { position: 'absolute', alignSelf: 'center', bottom: 46, fontSize: 46 },
  crashFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.danger },
});
