import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type Line = { top: DimensionValue; width: number; delay: number; duration: number };

const LINES: Line[] = [
  { top: '28%', width: 62, delay: 0, duration: 1250 },
  { top: '38%', width: 40, delay: 380, duration: 1500 },
  { top: '50%', width: 88, delay: 150, duration: 1150 },
  { top: '60%', width: 44, delay: 620, duration: 1600 },
  { top: '70%', width: 56, delay: 880, duration: 1400 },
];

function Streak({ top, width, delay, duration }: Line) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(t, { toValue: 1, duration, delay, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [t, duration, delay]);

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [50, -170] });
  const opacity = t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.75, 0.75, 0] });

  return <Animated.View style={[styles.streak, { top, width, opacity, transform: [{ translateX }] }]} />;
}

// Horizontal streaks that rush leftward — makes the (right-facing) car feel like
// it's driving. Overlay it over a dark hero.
export default function SpeedLines({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.tilt, style]} pointerEvents="none">
      {LINES.map((line, i) => (
        <Streak key={i} {...line} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Match the tilt of the speed streaks drawn in the emblem (right end lifted).
  tilt: { transform: [{ rotate: '-12deg' }] },
  streak: { position: 'absolute', right: '14%', height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
});
