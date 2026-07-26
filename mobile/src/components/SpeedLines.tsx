import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type Line = { top: DimensionValue; width: number; delay: number; duration: number };

const LINES: Line[] = [
  { top: '26%', width: 64, delay: 0, duration: 1300 },
  { top: '38%', width: 44, delay: 350, duration: 1550 },
  { top: '52%', width: 90, delay: 150, duration: 1200 },
  { top: '62%', width: 40, delay: 650, duration: 1650 },
  { top: '70%', width: 58, delay: 900, duration: 1450 },
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

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [70, -150] });
  const opacity = t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.55, 0.55, 0] });

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
  streak: { position: 'absolute', right: '18%', height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
});
