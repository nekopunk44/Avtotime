import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

// Per-game preview tiles built from plain Views only — no react-native-svg —
// so they render on any build. Positions are percentages of the tile.
type Props = { gameId: string; style?: StyleProp<ViewStyle> };

const BG: Record<string, string> = {
  snake: '#12331F',
  tetris: '#241B3E',
  'game-2048': '#3A2A18',
  sudoku: '#132B3A',
  'car-jump': '#1A2B3D',
  'road-fighter': '#1F2126',
  'coloring-cars': '#331A2E',
  'svg-puzzle-gallery': '#243318',
};

const A = StyleSheet.absoluteFillObject;

function Snake() {
  const seg = (left: string, top: string, head = false) => (
    <View key={`${left}-${top}`} style={[styles.abs, { left, top, width: '11%', aspectRatio: 1, borderRadius: 5, backgroundColor: head ? '#3DD68C' : '#2EB877' }] as any} />
  );
  return (
    <>
      {seg('22%', '52%')}
      {seg('33%', '52%')}
      {seg('44%', '52%')}
      {seg('55%', '52%')}
      {seg('55%', '32%', true)}
      <View style={[styles.abs, { left: '74%', top: '30%', width: '9%', aspectRatio: 1, borderRadius: 999, backgroundColor: '#FF5A5F' }] as any} />
    </>
  );
}

function Tetris() {
  const b = (left: string, top: string, color: string) => (
    <View key={`${left}-${top}`} style={[styles.abs, { left, top, width: '12%', aspectRatio: 1, borderRadius: 3, backgroundColor: color }] as any} />
  );
  return (
    <>
      {b('31%', '18%', '#4D96FF')}
      {b('31%', '40%', '#4D96FF')}
      {b('19%', '62%', '#FFD93D')}
      {b('31%', '62%', '#FFD93D')}
      {b('43%', '62%', '#FFD93D')}
      {b('57%', '40%', '#FF6B6B')}
      {b('69%', '40%', '#FF6B6B')}
      {b('57%', '62%', '#6BCB77')}
      {b('69%', '62%', '#6BCB77')}
    </>
  );
}

function Game2048() {
  const t = (left: string, top: string, bg: string, n: string, tc: string) => (
    <View key={n} style={[styles.abs, styles.center, { left, top, width: '22%', aspectRatio: 1, borderRadius: 7, backgroundColor: bg }] as any}>
      <Text style={[styles.tileNum, { color: tc }]}>{n}</Text>
    </View>
  );
  return (
    <>
      {t('26%', '16%', '#EEE4DA', '2', '#7A6A5A')}
      {t('52%', '16%', '#EDE0C8', '4', '#7A6A5A')}
      {t('26%', '52%', '#F2B179', '8', '#FFFFFF')}
      {t('52%', '52%', '#F59563', '16', '#FFFFFF')}
    </>
  );
}

function Sudoku() {
  const d = (left: string, top: string, n: string) => (
    <Text key={`${left}-${n}`} style={[styles.abs, styles.digit, { left, top }] as any}>{n}</Text>
  );
  return (
    <>
      <View style={[styles.abs, { left: '30%', top: '12%', width: '40%', height: '76%', borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(154,209,236,0.7)', backgroundColor: 'rgba(255,255,255,0.05)' }] as any} />
      <View style={[styles.abs, { left: '43%', top: '12%', width: 1, height: '76%', backgroundColor: 'rgba(154,209,236,0.45)' }] as any} />
      <View style={[styles.abs, { left: '56%', top: '12%', width: 1, height: '76%', backgroundColor: 'rgba(154,209,236,0.45)' }] as any} />
      <View style={[styles.abs, { left: '30%', top: '37%', width: '40%', height: 1, backgroundColor: 'rgba(154,209,236,0.45)' }] as any} />
      <View style={[styles.abs, { left: '30%', top: '62%', width: '40%', height: 1, backgroundColor: 'rgba(154,209,236,0.45)' }] as any} />
      {d('33%', '16%', '5')}
      {d('59%', '16%', '3')}
      {d('46%', '41%', '8')}
      {d('33%', '66%', '2')}
      {d('59%', '66%', '7')}
    </>
  );
}

function Car({ left, top, width, color }: { left: string; top: string; width: string; color: string }) {
  return (
    <View style={[styles.abs, { left, top, width }] as any}>
      <View style={{ width: '46%', height: 7, alignSelf: 'center', borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: color, opacity: 0.85 }} />
      <View style={{ width: '100%', height: 11, borderRadius: 5, backgroundColor: color }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: '10%', marginTop: -3 }}>
        <View style={styles.wheel} />
        <View style={styles.wheel} />
      </View>
    </View>
  );
}

function CarJump() {
  return (
    <>
      <View style={[styles.abs, { left: '8%', top: '74%', width: '26%', height: 7, borderRadius: 4, backgroundColor: '#2C4A63' }] as any} />
      <View style={[styles.abs, { left: '62%', top: '52%', width: '26%', height: 7, borderRadius: 4, backgroundColor: '#2C4A63' }] as any} />
      <Car left="36%" top="22%" width="26%" color="#FFD93D" />
      <View style={[styles.abs, { left: 0, right: 0, top: '92%', height: 2, backgroundColor: 'rgba(61,214,140,0.5)' }] as any} />
    </>
  );
}

function RoadFighter() {
  const dash = (top: string) => (
    <View key={top} style={[styles.abs, { left: '48.6%', top, width: '2.8%', height: '13%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' }] as any} />
  );
  return (
    <>
      <View style={[styles.abs, { left: '24%', top: 0, width: '52%', height: '100%', backgroundColor: '#26282F' }] as any} />
      <View style={[styles.abs, { left: '24%', top: 0, width: 3, height: '100%', backgroundColor: '#F6B23D' }] as any} />
      <View style={[styles.abs, { left: '74.4%', top: 0, width: 3, height: '100%', backgroundColor: '#F6B23D' }] as any} />
      {dash('4%')}
      {dash('30%')}
      {dash('56%')}
      {dash('82%')}
      <Car left="33%" top="52%" width="22%" color="#FF5A5F" />
    </>
  );
}

function Coloring() {
  const dot = (left: string, color: string) => (
    <View key={color} style={[styles.abs, { left, top: '76%', width: '7.5%', aspectRatio: 1, borderRadius: 999, backgroundColor: color }] as any} />
  );
  return (
    <>
      <View style={[styles.abs, { left: '30%', top: '22%', width: '40%', height: '14%', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 2, borderBottomWidth: 0, borderColor: 'rgba(247,240,255,0.9)' }] as any} />
      <View style={[styles.abs, { left: '20%', top: '36%', width: '60%', height: '18%', borderRadius: 8, borderWidth: 2, borderColor: 'rgba(247,240,255,0.9)' }] as any} />
      <View style={[styles.abs, { left: '29%', top: '50%', width: '8%', aspectRatio: 1, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(247,240,255,0.9)', backgroundColor: BG['coloring-cars'] }] as any} />
      <View style={[styles.abs, { left: '63%', top: '50%', width: '8%', aspectRatio: 1, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(247,240,255,0.9)', backgroundColor: BG['coloring-cars'] }] as any} />
      {dot('26%', '#FF6B6B')}
      {dot('36%', '#FFD93D')}
      {dot('46%', '#6BCB77')}
      {dot('56%', '#4D96FF')}
      {dot('66%', '#9D4EDD')}
    </>
  );
}

function Puzzle() {
  const p = (left: string, top: string, color: string) => (
    <View key={color} style={[styles.abs, { left, top, width: '17%', aspectRatio: 1 }] as any}>
      <View style={{ width: '100%', height: '100%', borderRadius: 5, backgroundColor: color }} />
      <View style={{ position: 'absolute', right: '-22%', top: '30%', width: '40%', height: '40%', borderRadius: 999, backgroundColor: color }} />
    </View>
  );
  return (
    <>
      {p('28%', '20%', '#FF6B6B')}
      {p('52%', '20%', '#4D96FF')}
      {p('28%', '54%', '#FFD93D')}
      {p('52%', '54%', '#6BCB77')}
    </>
  );
}

const SCENES: Record<string, () => React.JSX.Element> = {
  snake: Snake,
  tetris: Tetris,
  'game-2048': Game2048,
  sudoku: Sudoku,
  'car-jump': CarJump,
  'road-fighter': RoadFighter,
  'coloring-cars': Coloring,
  'svg-puzzle-gallery': Puzzle,
};

export default function GamePreview({ gameId, style }: Props) {
  const Scene = SCENES[gameId];
  return (
    <View style={[style, { backgroundColor: BG[gameId] || '#22242B', overflow: 'hidden' }]}>
      <View style={styles.glow} pointerEvents="none" />
      {Scene ? <Scene /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', top: '-45%', left: '-20%', width: '90%', aspectRatio: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  tileNum: { fontSize: 15, fontWeight: '900' },
  digit: { color: '#EAF6FC', fontSize: 13, fontWeight: '800', width: '8%', textAlign: 'center' },
  wheel: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#0E1013' },
});
