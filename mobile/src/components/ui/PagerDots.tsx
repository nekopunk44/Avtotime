import React from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';

interface Props {
  count: number;
  /** Сырой contentOffset.x ленты кадров. */
  scrollX: Animated.Value;
  /** Ширина одного кадра — шаг интерполяции. */
  slideWidth: number;
  /** Диаметр обычной точки и длина активной. */
  dotSize?: number;
  activeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Точки-страницы, ведомые положением самой ленты: активная перетекает в
 * соседнюю прямо во время свайпа, а не перескакивает после остановки. Раз их
 * ведёт сырой contentOffset, точки честно повторяют и недоведённый свайп,
 * который вернулся на место.
 *
 * Ширина — layout-свойство, поэтому драйвер JS: для нескольких точек размером
 * с булавочную головку это дёшево.
 */
export default function PagerDots({
  count,
  scrollX,
  slideWidth,
  dotSize = 6,
  activeWidth = 18,
  style,
}: Props) {
  if (count <= 1 || slideWidth <= 0) return null;

  return (
    <View style={[styles.row, style]} pointerEvents="none">
      {Array.from({ length: count }, (_, index) => {
        const inputRange = [
          (index - 1) * slideWidth,
          index * slideWidth,
          (index + 1) * slideWidth,
        ];
        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                height: dotSize,
                width: scrollX.interpolate({
                  inputRange,
                  outputRange: [dotSize, activeWidth, dotSize],
                  extrapolate: 'clamp',
                }),
                opacity: scrollX.interpolate({
                  inputRange,
                  outputRange: [0.45, 1, 0.45],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  dot: { borderRadius: radius.pill, backgroundColor: colors.white },
});
