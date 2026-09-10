import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow } from '../theme';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Feed:      { on: 'home',           off: 'home-outline' },
  Search:    { on: 'search',         off: 'search-outline' },
  Loops:     { on: 'play-circle',    off: 'play-circle-outline' },
  Market:    { on: 'car-sport',      off: 'car-sport-outline' },
  Favorites: { on: 'heart',          off: 'heart-outline' },
  MyListings:{ on: 'pricetags',      off: 'pricetags-outline' },
  Driving:   { on: 'school',         off: 'school-outline' },
  Messages:  { on: 'chatbubbles',    off: 'chatbubbles-outline' },
  Profile:   { on: 'person',         off: 'person-outline' },
};

const clamp = { extrapolate: 'clamp' as const };

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
      // Поп: круг разгоняется с перелётом за единицу, кнопка подпрыгивает
      // и пружинно оседает на место.
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
            styles.circle,
            {
              opacity: focusA.interpolate({ inputRange: [0, 1], outputRange: [0, 1], ...clamp }),
              // Спринг перелетает за 1 — круг в момент попа чуть крупнее себя.
              transform: [{ scale: focusA.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            },
          ]}
        />
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
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) + 6 }]}>
      <View style={styles.bar}>
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
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'stretch', paddingHorizontal: 14 },
  bar: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.surface,
    borderRadius: radius.pill, paddingHorizontal: 8, height: 58,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    ...shadow.float,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 56, height: 44, alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute', width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.accent,
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
