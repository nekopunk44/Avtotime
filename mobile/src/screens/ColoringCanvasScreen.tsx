import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../store/toastStore';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { getColoringTemplateUrl, saveColoringDrawing } from '../api/kidsGames';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'ColoringCanvas'>;
  route: RouteProp<AppStackParamList, 'ColoringCanvas'>;
};

type Stroke = { color: string; width: number; d: string };

const PALETTE = ['#FF6B6B', '#FF922B', '#FFD93D', '#6BCB77', '#4D96FF', '#9D4EDD', '#F783AC', '#8B5E3C', '#2B2B2B', '#FFFFFF'];
const BRUSHES = [10, 20, 34];

// Pull the viewBox and every <path> outline out of the template SVG.
const parseTemplate = (svg: string) => {
  const vb = svg.match(/viewBox="([^"]+)"/);
  let viewBox = vb ? vb[1] : '';
  if (!viewBox) {
    const w = svg.match(/\bwidth="([\d.]+)"/);
    const h = svg.match(/\bheight="([\d.]+)"/);
    viewBox = `0 0 ${w ? w[1] : 1000} ${h ? h[1] : 1000}`;
  }
  const [, , vw, vh] = viewBox.split(/\s+/).map(Number);
  const paths: string[] = [];
  const re = /<path\b[^>]*?\bd="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) paths.push(m[1]);
  return { viewBox, vw: vw || 1000, vh: vh || 1000, paths };
};

export default function ColoringCanvasScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { template } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tpl, setTpl] = useState<{ viewBox: string; vw: number; vh: number; paths: string[] } | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(BRUSHES[1]);
  const [saving, setSaving] = useState(false);

  const canvas = useRef({ w: 1, h: 1 });
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const tplRef = useRef(tpl);
  colorRef.current = color;
  widthRef.current = width;
  tplRef.current = tpl;
  const pointsRef = useRef<string>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(getColoringTemplateUrl(template));
        const svg = await res.text();
        if (alive) setTpl(parseTemplate(svg));
      } catch (e: any) {
        if (alive) setError('Не удалось загрузить шаблон');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [template]);

  const toSvg = useCallback((x: number, y: number) => {
    const t = tplRef.current;
    if (!t) return { x: 0, y: 0 };
    return {
      x: +((x / canvas.current.w) * t.vw).toFixed(1),
      y: +((y / canvas.current.h) * t.vh).toFixed(1),
    };
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const p = toSvg(e.nativeEvent.locationX, e.nativeEvent.locationY);
        pointsRef.current = `M ${p.x} ${p.y}`;
        setCurrent({ color: colorRef.current, width: widthRef.current, d: `${pointsRef.current} L ${p.x} ${p.y}` });
      },
      onPanResponderMove: (e) => {
        const p = toSvg(e.nativeEvent.locationX, e.nativeEvent.locationY);
        pointsRef.current += ` L ${p.x} ${p.y}`;
        setCurrent({ color: colorRef.current, width: widthRef.current, d: pointsRef.current });
      },
      onPanResponderRelease: () => {
        const d = pointsRef.current;
        pointsRef.current = '';
        setCurrent(null);
        if (d.includes('L')) setStrokes((prev) => [...prev, { color: colorRef.current, width: widthRef.current, d }]);
      },
    }),
  ).current;

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    canvas.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  const allStrokes = useMemo(() => (current ? [...strokes, current] : strokes), [strokes, current]);

  const save = async () => {
    if (!tpl || saving) return;
    setSaving(true);
    try {
      const strokeSvg = strokes
        .map((s) => `<path d="${s.d}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
        .join('');
      const outlineSvg = tpl.paths.map((d) => `<path d="${d}" fill="#111111"/>`).join('');
      const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tpl.viewBox}"><rect width="100%" height="100%" fill="#ffffff"/>${strokeSvg}${outlineSvg}</svg>`;
      await saveColoringDrawing({
        templateId: template.id,
        title: template.title,
        imageData: `data:image/svg+xml;utf8,${encodeURIComponent(out)}`,
        progress: strokes.length ? 100 : 0,
        colorsUsed: Array.from(new Set(strokes.map((s) => s.color))),
      });
      showToast('Раскраска сохранена в ваши рисунки', 'success');
      navigation.goBack();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{template.title}</Text>
        <TouchableOpacity style={[styles.saveBtn, (!strokes.length || saving) && styles.saveBtnOff]} onPress={save} disabled={!strokes.length || saving}>
          {saving ? <ActivityIndicator color={colors.onAccent} size="small" /> : <Text style={styles.saveText}>Готово</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.canvasWrap}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.text} />
        ) : error || !tpl ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.textFaint} />
            <Text style={styles.errorText}>{error || 'Шаблон недоступен'}</Text>
          </View>
        ) : (
          <View style={[styles.canvas, { aspectRatio: tpl.vw / tpl.vh }]} onLayout={onCanvasLayout} {...pan.panHandlers}>
            <Svg width="100%" height="100%" viewBox={tpl.viewBox}>
              {allStrokes.map((s, i) => (
                <Path key={i} d={s.d} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {tpl.paths.map((d, i) => (
                <Path key={`o-${i}`} d={d} fill="#111111" />
              ))}
            </Svg>
          </View>
        )}
      </View>

      <View style={styles.toolbar}>
        <View style={styles.brushRow}>
          {BRUSHES.map((b) => (
            <TouchableOpacity key={b} style={[styles.brushBtn, width === b && styles.brushBtnActive]} onPress={() => setWidth(b)}>
              <View style={[styles.brushDot, { width: b, height: b, backgroundColor: color === '#FFFFFF' ? colors.textMuted : color }]} />
            </TouchableOpacity>
          ))}
          <View style={styles.toolSpacer} />
          <TouchableOpacity style={styles.toolBtn} onPress={undo} disabled={!strokes.length}>
            <Ionicons name="arrow-undo-outline" size={20} color={strokes.length ? colors.text : colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={clear} disabled={!strokes.length}>
            <Ionicons name="trash-outline" size={20} color={strokes.length ? colors.danger : colors.textFaint} />
          </TouchableOpacity>
        </View>
        <View style={styles.paletteRow}>
          {PALETTE.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive, c === '#FFFFFF' && styles.swatchBorder]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: 10, fontSize: 16, fontWeight: '900', color: colors.text },
  saveBtn: { height: 40, minWidth: 84, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  saveBtnOff: { backgroundColor: colors.surfaceAlt },
  saveText: { fontSize: 14, fontWeight: '900', color: colors.onAccent },

  canvasWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  canvas: { width: '100%', maxHeight: '100%', backgroundColor: '#ffffff', borderRadius: 14, overflow: 'hidden' },
  errorBox: { alignItems: 'center', gap: 10 },
  errorText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },

  toolbar: { padding: 12, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
  brushRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brushBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  brushBtnActive: { borderColor: colors.accent, borderWidth: 2 },
  brushDot: { borderRadius: 999 },
  toolSpacer: { flex: 1 },
  toolBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  swatch: { width: 38, height: 38, borderRadius: 19 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
  swatchBorder: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
