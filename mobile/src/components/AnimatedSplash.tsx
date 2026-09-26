import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import AnimatedEmblem from './AnimatedEmblem';
import BrandWordmark from './BrandWordmark';

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
  return (
    <View style={styles.container}>
      <AnimatedEmblem size={260} />
      <BrandWordmark size={32} style={styles.wordmark} />
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
  wordmark: { marginTop: 6 },
  dots: { flexDirection: 'row', gap: 9, position: 'absolute', bottom: 90 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' },
});
