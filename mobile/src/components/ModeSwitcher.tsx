import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';

export const SEG_W = 98;

// Top segmented switch between the social and market experiences. The thumb is
// positioned statically by `current` — headers remount on every tab change, so
// animating it here would jerk on each switch; the screen transition carries it.
export default function ModeSwitcher({ current }: { current: 'social' | 'market' }) {
  const navigation = useNavigation<any>();
  const offset = current === 'social' ? 0 : SEG_W;

  return (
    <View style={styles.switcher}>
      <View style={[styles.thumb, { transform: [{ translateX: offset }] }]} />
      <TouchableOpacity style={styles.segment} activeOpacity={0.9} onPress={() => navigation.navigate('SocialTabs')}>
        <Ionicons name="people" size={15} color={current === 'social' ? colors.onAccent : colors.textMuted} />
        <Text style={[styles.segmentText, current === 'social' && styles.segmentTextActive]}>Соцсеть</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.segment} activeOpacity={0.9} onPress={() => navigation.navigate('MarketTabs')}>
        <Ionicons name="storefront" size={15} color={current === 'market' ? colors.onAccent : colors.textMuted} />
        <Text style={[styles.segmentText, current === 'market' && styles.segmentTextActive]}>Маркет</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 999, padding: 4, height: 40 },
  thumb: { position: 'absolute', top: 4, left: 4, width: SEG_W, height: 32, borderRadius: 999, backgroundColor: colors.accent },
  segment: { width: SEG_W, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  segmentText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  segmentTextActive: { color: colors.onAccent },
});
