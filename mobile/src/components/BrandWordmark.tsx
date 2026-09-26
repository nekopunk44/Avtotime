import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { colors } from '../theme';

interface Props {
  size?: number;
  /** Задержка появления, мс — чтобы надпись выехала после сборки эмблемы. */
  delay?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Фирменная надпись Avtotime гоночным шрифтом Racing Sans One (OFL).
 * Появляется снизу с мягким подъёмом; пока шрифт грузится, не рисуем
 * ничего — мигание системным начертанием выглядело бы хуже паузы.
 */
export default function BrandWordmark({ size = 30, delay = 900, style }: Props) {
  const [loaded] = useFonts({
    RacingSansOne: require('../../assets/fonts/RacingSansOne-Regular.ttf'),
  });
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loaded) return;
    const a = Animated.timing(anim, { toValue: 1, duration: 420, delay, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [loaded, delay, anim]);

  if (!loaded) return null;

  return (
    <Animated.Text
      style={[
        {
          fontFamily: 'RacingSansOne',
          fontSize: size,
          color: colors.white,
          letterSpacing: 2,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
        style,
      ]}
    >
      Avtotime
    </Animated.Text>
  );
}
