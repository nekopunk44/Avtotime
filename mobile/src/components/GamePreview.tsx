import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

type Props = { gameId: string; style?: StyleProp<ViewStyle> };

const W = 320;
const H = 160;

const THEMES: Record<string, [string, string]> = {
  snake: ['#15442D', '#0B2418'],
  tetris: ['#392A5E', '#1B1531'],
  'game-2048': ['#5C4026', '#2C1E12'],
  sudoku: ['#173B51', '#0E232F'],
  'car-jump': ['#213A52', '#111F2C'],
  'road-fighter': ['#34363F', '#17181E'],
  'coloring-cars': ['#4A2541', '#251324'],
  'svg-puzzle-gallery': ['#3B4A28', '#1D2A15'],
};

const R = (x: number, y: number, w: number, h: number, fill: string, rx = 5, opacity = 1) => (
  <Rect x={x} y={y} width={w} height={h} rx={rx} ry={rx} fill={fill} opacity={opacity} />
);

const grid = (color: string) => {
  const lines: React.ReactNode[] = [];
  for (let x = 40; x < W; x += 40) lines.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke={color} strokeWidth={1} opacity={0.5} />);
  for (let y = 40; y < H; y += 40) lines.push(<Line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={color} strokeWidth={1} opacity={0.5} />);
  return <G>{lines}</G>;
};

function motif(gameId: string): React.ReactNode {
  switch (gameId) {
    case 'snake':
      return (
        <G>
          {grid('#3DD68C')}
          {[80, 108, 136, 164].map((x) => R(x, 96, 24, 24, '#2EB877', 7))}
          {R(164, 68, 24, 24, '#2EB877', 7)}
          {R(192, 68, 24, 24, '#3DD68C', 7)}
          <Circle cx={244} cy={80} r={11} fill="#FF5A5F" />
        </G>
      );
    case 'tetris':
      return (
        <G>
          {R(120, 44, 26, 26, '#4D96FF', 4)}
          {R(120, 70, 26, 26, '#4D96FF', 4)}
          {R(94, 96, 26, 26, '#FFD93D', 4)}
          {R(120, 96, 26, 26, '#FFD93D', 4)}
          {R(146, 96, 26, 26, '#FFD93D', 4)}
          {R(176, 70, 26, 26, '#FF6B6B', 4)}
          {R(202, 70, 26, 26, '#FF6B6B', 4)}
          {R(176, 96, 26, 26, '#6BCB77', 4)}
          {R(202, 96, 26, 26, '#6BCB77', 4)}
        </G>
      );
    case 'game-2048': {
      const t = (x: number, y: number, bg: string, n: string, tc: string) => (
        <G>
          {R(x, y, 54, 54, bg, 8)}
          <SvgText x={x + 27} y={y + 35} fill={tc} fontSize={22} fontWeight="900" textAnchor="middle">{n}</SvgText>
        </G>
      );
      return (
        <G>
          {t(96, 24, '#EEE4DA', '2', '#7A6A5A')}
          {t(158, 24, '#EDE0C8', '4', '#7A6A5A')}
          {t(96, 84, '#F2B179', '8', '#FFFFFF')}
          {t(158, 84, '#F59563', '16', '#FFFFFF')}
        </G>
      );
    }
    case 'sudoku':
      return (
        <G>
          {R(108, 20, 104, 104, 'rgba(255,255,255,0.06)', 6)}
          {[108, 143.3, 178.6, 212].map((x, i) => <Line key={`sv${i}`} x1={x} y1={20} x2={x} y2={124} stroke="#9AD1EC" strokeWidth={i === 0 || i === 3 ? 2 : 1} opacity={0.6} />)}
          {[20, 55.3, 90.6, 124].map((y, i) => <Line key={`sh${i}`} x1={108} y1={y} x2={212} y2={y} stroke="#9AD1EC" strokeWidth={i === 0 || i === 3 ? 2 : 1} opacity={0.6} />)}
          {[['5', 120, 44], ['3', 190, 44], ['8', 155, 80], ['2', 120, 116], ['7', 190, 116]].map(([n, x, y], i) => (
            <SvgText key={`sn${i}`} x={Number(x) + 6} y={Number(y)} fill="#EAF6FC" fontSize={18} fontWeight="800" textAnchor="middle">{n as string}</SvgText>
          ))}
        </G>
      );
    case 'car-jump':
      return (
        <G>
          <Line x1={0} y1={134} x2={W} y2={134} stroke="#3DD68C" strokeWidth={3} opacity={0.5} />
          {R(48, 122, 74, 12, '#2C4A63', 4)}
          {R(206, 96, 74, 12, '#2C4A63', 4)}
          {R(150, 58, 58, 26, '#FFD93D', 7)}
          {R(160, 46, 30, 16, '#FFF2B8', 5)}
          <Circle cx={166} cy={86} r={9} fill="#17181D" />
          <Circle cx={196} cy={86} r={9} fill="#17181D" />
        </G>
      );
    case 'road-fighter':
      return (
        <G>
          {R(108, -6, 104, 172, '#20222A', 0)}
          <Line x1={108} y1={0} x2={108} y2={H} stroke="#F6B23D" strokeWidth={3} />
          <Line x1={212} y1={0} x2={212} y2={H} stroke="#F6B23D" strokeWidth={3} />
          {[6, 52, 98, 144].map((y) => R(157, y, 6, 26, '#FFFFFF', 2, 0.85))}
          {R(140, 92, 40, 50, '#FF5A5F', 8)}
          {R(147, 100, 26, 16, '#2A0E10', 4)}
          <Circle cx={138} cy={104} r={6} fill="#111" />
          <Circle cx={182} cy={104} r={6} fill="#111" />
        </G>
      );
    case 'coloring-cars':
      return (
        <G>
          <Path
            d="M78 96 L96 66 C100 60 106 56 116 56 L196 56 C206 56 214 60 220 68 L238 92 L246 96 C250 98 252 102 252 106 L252 112 L78 112 Z"
            fill="rgba(255,255,255,0.10)"
            stroke="#F7F0FF"
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Circle cx={118} cy={112} r={14} fill="#251324" stroke="#F7F0FF" strokeWidth={3} />
          <Circle cx={210} cy={112} r={14} fill="#251324" stroke="#F7F0FF" strokeWidth={3} />
          {['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9D4EDD'].map((c, i) => (
            <Circle key={c} cx={110 + i * 26} cy={136} r={9} fill={c} />
          ))}
        </G>
      );
    case 'svg-puzzle-gallery': {
      const p = (x: number, y: number, c: string) => (
        <G>
          {R(x, y, 44, 44, c, 6)}
          <Circle cx={x + 44} cy={y + 22} r={8} fill={c} />
          <Circle cx={x + 22} cy={y} r={8} fill={c} />
        </G>
      );
      return (
        <G>
          {p(108, 34, '#FF6B6B')}
          {p(160, 34, '#4D96FF')}
          {p(108, 86, '#FFD93D')}
          {p(160, 86, '#6BCB77')}
        </G>
      );
    }
    default:
      return null;
  }
}

export default function GamePreview({ gameId, style }: Props) {
  const [c0, c1] = THEMES[gameId] || ['#2B2D35', '#17181D'];
  const gid = `gp-${gameId}`;
  return (
    <View style={style}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={c0} />
            <Stop offset="1" stopColor={c1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${gid})`} />
        {motif(gameId)}
      </Svg>
    </View>
  );
}
