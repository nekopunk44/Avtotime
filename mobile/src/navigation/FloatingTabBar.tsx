import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

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

function TabButton({
  routeName, focused, onPress, onLongPress, badge,
}: {
  routeName: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  badge?: number | string;
}) {
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 13, bounciness: 9 }).start();
  }, [focused, a]);

  const icon = ICONS[routeName] || ICONS.Feed;
  const pillScale = a.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const activeOpacity = a;
  const inactiveOpacity = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Pressable style={styles.item} onPress={onPress} onLongPress={onLongPress} hitSlop={6}>
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { opacity: activeOpacity, transform: [{ scale: pillScale }] }]} />
        <Animated.View style={[styles.iconLayer, { opacity: inactiveOpacity }]}>
          <Ionicons name={icon.off} size={23} color={colors.textFaint} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, { opacity: activeOpacity }]}>
          <Ionicons name={icon.on} size={23} color={colors.onAccent} />
        </Animated.View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{typeof badge === 'number' && badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
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
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
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
    borderRadius: 32, paddingHorizontal: 12, height: 64,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 16,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 56, height: 46, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', width: 48, height: 36, borderRadius: 18, backgroundColor: colors.accent },
  iconLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 3, right: 8, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.surface,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
});
