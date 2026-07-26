import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { colors, font, space } from '../../theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Designed empty state — never a bare "Нет данных".
export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Ionicons name={icon} size={30} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="accent" onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xxl },
  circle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.lg,
  },
  title: { fontSize: font.h3, fontWeight: '900', color: colors.text, textAlign: 'center' },
  sub: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  action: { marginTop: space.lg, paddingHorizontal: 28 },
});
