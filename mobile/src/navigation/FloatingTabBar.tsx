import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import SpeedSurface from '../components/SpeedSurface';
import { colors, radius, shadow } from '../theme';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Feed:      { on: 'home',           off: 'home-outline' },
  Search:    { on: 'search',         off: 'search-outline' },
  Loops:     { on: 'play-circle',    off: 'play-circle-outline' },
  Market:    { on: 'car-sport',      off: 'car-sport-outline' },
  Compare:   { on: 'git-compare',    off: 'git-compare-outline' },
  HelpRequests:{ on: 'heart',       off: 'heart-outline' },
  Driving:   { on: 'school',         off: 'school-outline' },
  Messages:  { on: 'chatbubbles',    off: 'chatbubbles-outline' },
  Profile:   { on: 'person',         off: 'person-outline' },
};

const clamp = { extrapolate: 'clamp' as const };

const BAR_HEIGHT = 58;
const BAR_PAD = 8;
/**
 * Сколько снизу занимает плавающая панель. Экраны добавляют это к отступу
 * содержимого: сцена идёт под панель, чтобы карточки было видно за ней, но
 * последняя строка списка должна доезжать выше неё.
 */
export const TAB_BAR_SPACE = 96;
// Индикатор — сквиркл: скруглённый прямоугольник, шире, чем выше.
const IND_W = 52;
const IND_H = 40;

function TabButton({
  routeName, focused, onPress, onLongPress, badge,
}: {
  routeName: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  badge?: number | string;
}) {
  const focusA = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const wasFocused = useRef(focused);

  useEffect(() => {
    // Ранний return отсекает и первый рендер: активная вкладка при старте
    // приложения не должна «попывать».
    if (focused === wasFocused.current) return;
    wasFocused.current = focused;

    if (focused) {
      // Поп: заполненная иконка влетает с перелётом, кнопка подпрыгивает и
      // пружинно оседает — как раз к моменту, когда подъезжает круг.
      Animated.spring(focusA, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 14 }).start();
      hop.setValue(0);
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(hop, { toValue: 0, useNativeDriver: true, speed: 9, bounciness: 12 }),
      ]).start();
    } else {
      // Уход прежней вкладки — тихий и быстрый: внимание достаётся новой.
      Animated.timing(focusA, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [focused, focusA, hop]);

  const icon = ICONS[routeName] || ICONS.Feed;

  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() =>
        Animated.spring(press, { toValue: 0.86, useNativeDriver: true, speed: 40, bounciness: 0 }).start()}
      onPressOut={() =>
        Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 10 }).start()}
      hitSlop={6}
    >
      <Animated.View
        style={[
          styles.iconWrap,
          {
            transform: [
              { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
              { scale: press },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.iconLayer,
            { opacity: focusA.interpolate({ inputRange: [0, 1], outputRange: [1, 0], ...clamp }) },
          ]}
        >
          <Ionicons name={icon.off} size={23} color={colors.textFaint} />
        </Animated.View>
        <Animated.View
          style={[
            styles.iconLayer,
            {
              opacity: focusA.interpolate({ inputRange: [0, 1], outputRange: [0, 1], ...clamp }),
              transform: [{ scale: focusA.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            },
          ]}
        >
          <Ionicons name={icon.on} size={23} color={colors.onAccent} />
        </Animated.View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{typeof badge === 'number' && badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barW, setBarW] = useState(0);
  // Экран может попросить спрятать панель (шторка комментариев в Loops
  // занимает весь экран, и панель поверх неё была бы мусором).
  const focusedOptions = descriptors[state.routes[state.index].key]?.options;
  const hidden = (focusedOptions?.tabBarStyle as { display?: string } | undefined)?.display === 'none';
  // Один индикатор на всю панель: он физически скользит к выбранной
  // вкладке, а не рождается заново под каждой.
  const slideX = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);

  const count = state.routes.length;
  const itemW = barW > 0 && count > 0 ? (barW - BAR_PAD * 2) / count : 0;
  const targetX = BAR_PAD + itemW * (state.index + 0.5) - IND_W / 2;

  useEffect(() => {
    if (barW <= 0) return;
    if (!placed.current) {
      // Первое размещение — без анимации, индикатор просто стоит на активной.
      placed.current = true;
      slideX.setValue(targetX);
      return;
    }
    Animated.parallel([
      Animated.spring(slideX, { toValue: targetX, useNativeDriver: true, speed: 14, bounciness: 9 }),
      // Желе: в разгоне сквиркл вытягивается по ходу движения и пружинно
      // возвращается к форме, когда доезжает.
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1.18, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(stretch, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 11 }),
      ]),
    ]).start();
  }, [targetX, barW, slideX, stretch]);

  if (hidden) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) + 6 }]}>
      <View style={styles.barShell} pointerEvents="box-none">
        {/* Свечение — два слоя ореола за панелью: на тёмном контенте панель
            сливалась с фоном, а Android не умеет светлых теней. Два кольца
            убывающей яркости читаются как мягкое гало. */}
        <View style={styles.glowOuter} pointerEvents="none" />
        <View style={styles.glowInner} pointerEvents="none" />
      <View style={styles.bar} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        <SpeedSurface subtle />
        <Animated.View
          style={[
            styles.slider,
            { opacity: barW > 0 ? 1 : 0, transform: [{ translateX: slideX }, { scaleX: stretch }] },
          ]}
        />
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const badge = options.tabBarBadge as number | string | undefined;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate(route.name);
            }
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <TabButton
              key={route.key}
              routeName={route.name}
              focused={focused}
              onPress={onPress}
              onLongPress={onLongPress}
              badge={badge}
            />
          );
        })}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'stretch', paddingHorizontal: 14 },
  barShell: { alignSelf: 'stretch' },
  glowOuter: {
    position: 'absolute', left: -8, right: -8, top: -8, bottom: -8,
    borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.035)',
  },
  glowInner: {
    position: 'absolute', left: -4, right: -4, top: -4, bottom: -4,
    borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.surface,
    borderRadius: radius.pill, paddingHorizontal: BAR_PAD, height: BAR_HEIGHT,
    // Кромка светлее обычной: волосяная граница цвета border тонула в контенте.
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceHi,
    // Подложка со штрихами скорости не должна выглядывать за скругление.
    overflow: 'hidden',
    ...shadow.float,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 56, height: 44, alignItems: 'center', justifyContent: 'center' },
  slider: {
    position: 'absolute', left: 0, top: (BAR_HEIGHT - IND_H) / 2, width: IND_W, height: IND_H,
    borderRadius: 15, backgroundColor: colors.accent,
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  iconLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 0, right: 6, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.surface,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
});
