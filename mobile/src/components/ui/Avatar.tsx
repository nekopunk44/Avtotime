import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../../theme';

interface Props {
  uri?: string | null;
  /** Ник — из него берётся буква. Имя используется, если ника нет. */
  userName?: string | null;
  name?: string | null;
  size: number;
  /** Рамка/отступы поверх круга — общее подмножество View- и Image-стилей. */
  style?: StyleProp<ViewStyle & ImageStyle>;
}

const initial = (userName?: string | null, name?: string | null) => {
  const source = (userName || name || '').trim().replace(/^@/, '');
  return source ? source.charAt(0).toUpperCase() : '?';
};

/**
 * Аватар пользователя: фото, а без него — буква из ника. Иконка приложения
 * в качестве заглушки не годится: все безликие профили выглядят одинаково.
 */
export default function Avatar({ uri, userName, name, size, style }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri) return <Image source={{ uri }} style={[styles.base, shape, style as StyleProp<ImageStyle>]} />;

  return (
    <View style={[styles.base, styles.fallback, shape, style]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{initial(userName, name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceAlt },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.text, fontWeight: '900' },
});
