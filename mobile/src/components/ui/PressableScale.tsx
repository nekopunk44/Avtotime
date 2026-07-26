import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

// Animate the Pressable itself so the passed style (width/flex/margins) lays
// out against the real parent — wrapping the style on an inner view collapses
// percentage/flex widths to the content size.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Pressable that gently scales down on press — the app's standard tap feedback.
export default function PressableScale({ children, style, scaleTo = 0.97, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <AnimatedPressable
      onPressIn={() => spring(scaleTo)}
      onPressOut={() => spring(1)}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
