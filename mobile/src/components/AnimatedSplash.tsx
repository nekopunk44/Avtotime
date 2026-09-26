import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import AnimatedEmblem from './AnimatedEmblem';

function Dot({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 480, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.25, duration: 480, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [delay, v]);
  return <Animated.View style={[styles.dot, { opacity: v }]} />;
}

// Custom branded launch screen shown while the app initializes. Sits on the
// same black background as the native splash, so the handoff is seamless.
export default function AnimatedSplash() {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [glow]);

  const haloScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const haloOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.16] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
      <AnimatedEmblem size={260} />
      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0B', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: '#ffffff' },
  dots: { flexDirection: 'row', gap: 9, position: 'absolute', bottom: 90 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' },
});
