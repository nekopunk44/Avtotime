import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

// Свои id градиентов на каждый экземпляр: url(#…) в react-native-svg может
// зацепить одноимённый градиент из другого Svg на экране.
let uidCounter = 0;

interface Props {
  /** Приглушить эффект (для маленьких панелей, где штрихи были бы шумом). */
  subtle?: boolean;
}

/** Диагональный штрих «скорости» с округлыми концами. */
function dash(x: number, y: number, len: number) {
  // Наклон как у штрихов в логотипе: почти горизонталь с лёгким падением.
  return { x1: x, y1: y, x2: x - len * 0.962, y2: y + len * 0.27 };
}

/**
 * Фирменная подложка панели вместо плоского серого: сверху — световая
 * плёнка, из правого верхнего угла — мягкий «свет фар», по краям —
 * диагональные штрихи скорости, эхо логотипа. Всё монохромное и едва
 * заметное: подложка добавляет глубину, не съедая содержимое. Кладётся
 * абсолютным слоем под контент; родителю нужен overflow: 'hidden'.
 */
export default function SpeedSurface({ subtle = false }: Props) {
  const uid = useRef(`speed${++uidCounter}`).current;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;

  const k = subtle ? 0.7 : 1;
  const strokeMain = `rgba(255,255,255,${0.055 * k})`;
  const strokeSoft = `rgba(255,255,255,${0.035 * k})`;

  // Пучок справа сверху и отголосок слева снизу — как россыпь в эмблеме.
  const right = [
    dash(w - 10, h * 0.2, 46),
    dash(w - 26, h * 0.2 + 10, 30),
    dash(w - 14, h * 0.2 + 20, 38),
  ];
  const left = [
    dash(w * 0.16, h * 0.62, 34),
    dash(w * 0.13, h * 0.62 + 9, 22),
  ];

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {w > 0 && h > 0 ? (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.05 * k} />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.012 * k} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            <RadialGradient
              id={`${uid}-beam`}
              cx={w * 0.85} cy={0} r={Math.max(w * 0.5, 1)}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.07 * k} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill={`url(#${uid}-sheen)`} />
          <Rect x={0} y={0} width={w} height={h} fill={`url(#${uid}-beam)`} />
          {right.map((d, i) => (
            <Line key={`r${i}`} {...d} stroke={i === 1 ? strokeSoft : strokeMain} strokeWidth={3} strokeLinecap="round" />
          ))}
          {left.map((d, i) => (
            <Line key={`l${i}`} {...d} stroke={i === 1 ? strokeSoft : strokeMain} strokeWidth={3} strokeLinecap="round" />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
