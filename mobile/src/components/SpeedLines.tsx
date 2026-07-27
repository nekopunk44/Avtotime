import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type Line = { top: DimensionValue; width: number; delay: number; duration: number };

const LINES: Line[] = [
  { top: '30%', width: 48, delay: 0, duration: 1400 },
  { top: '46%', width: 34, delay: 450, duration: 1600 },
  { top: '58%', width: 66, delay: 200, duration: 1250 },
  { top: '68%', width: 30, delay: 800, duration: 1700 },
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

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [40, -170] });
  const opacity = t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.28, 0.28, 0] });

  return <Animated.View style={[styles.streak, { top, width, opacity, transform: [{ translateX }] }]} />;
}

// Horizontal streaks that rush leftward — makes the (right-facing) car feel like
// it's driving. Overlay it over a dark hero.
export default function SpeedLines({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {LINES.map((line, i) => (
        <Streak key={i} {...line} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  streak: { position: 'absolute', right: '14%', height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
});
