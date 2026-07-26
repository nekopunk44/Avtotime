import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { colors, font, radius } from '../../theme';

type Variant = 'primary' | 'accent' | 'secondary';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Button({ label, onPress, variant = 'primary', icon, loading, disabled, style }: Props) {
  const bg = variant === 'accent' ? colors.accent : variant === 'secondary' ? colors.surfaceAlt : colors.ink;
  const fg = variant === 'secondary' ? colors.text : colors.white;
  const blocked = disabled || loading;

  return (
    <PressableScale
      onPress={blocked ? undefined : onPress}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.text, { color: fg }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52, borderRadius: radius.pill, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20,
  },
  text: { fontSize: font.body, fontWeight: '900' },
});
