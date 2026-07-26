import React from 'react';
import { StyleSheet, Text } from 'react-native';
import PressableScale from './PressableScale';
import { colors, radius } from '../../theme';

export default function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.accent },
  text: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  textActive: { color: colors.onAccent },
});
