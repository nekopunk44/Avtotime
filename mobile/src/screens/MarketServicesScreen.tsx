import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors, font, radius, shadow, space } from '../theme';
import { PressableScale } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'MarketServices'> };

type Service = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  screen: keyof AppStackParamList;
};

/**
 * Главный сервис идёт отдельной широкой карточкой, остальные — сеткой.
 *
 * Так решаются две беды прежней раскладки: пять равных плиток оставляли
 * пятую сиротой в последнем ряду, а одинаковый вес у «подбора авто» и
 * «раскрасок» не подсказывал, ради чего сюда вообще заходят.
 */
const FEATURED: Service = {
  icon: 'car-sport-outline',
  label: 'Подбор авто',
  desc: 'Оставьте критерии — подберём подходящие объявления',
  screen: 'CarRequest',
};

const SERVICES: Service[] = [
  { icon: 'bar-chart-outline', label: 'Аналитика', desc: 'Просмотры и контакты по объявлениям', screen: 'MarketAnalytics' },
  { icon: 'heart-outline', label: 'Запросы помощи', desc: 'Помощь на дороге и вашим заявкам', screen: 'HelpRequests' },
  { icon: 'leaf-outline', label: 'Эко советы', desc: 'Экономия и забота об экологии', screen: 'EcoTips' },
  { icon: 'game-controller-outline', label: 'Детям и игры', desc: 'Раскраски и мини-игры про машины', screen: 'KidsGames' },
];

export default function MarketServicesScreen({ navigation }: Props) {
  const open = (screen: keyof AppStackParamList) => navigation.navigate(screen as never);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PressableScale style={styles.hero} scaleTo={0.98} onPress={() => open(FEATURED.screen)}>
        <View style={styles.heroIcon}>
          <Ionicons name={FEATURED.icon} size={26} color={colors.onAccent} />
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.heroLabel}>{FEATURED.label}</Text>
          <Text style={styles.heroDesc}>{FEATURED.desc}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </PressableScale>

      <Text style={styles.sectionTitle}>Ещё в маркете</Text>

      <View style={styles.grid}>
        {SERVICES.map((service) => (
          <PressableScale
            key={service.label}
            style={styles.card}
            scaleTo={0.97}
            onPress={() => open(service.screen)}
          >
            <View style={styles.iconTile}>
              <Ionicons name={service.icon} size={20} color={colors.text} />
            </View>
            {/* Заголовок в одну строку: иначе описания в соседних плитках
                разъезжаются по высоте и ряд выглядит рваным. */}
            <Text style={styles.label} numberOfLines={1}>{service.label}</Text>
            <Text style={styles.desc} numberOfLines={2}>{service.desc}</Text>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xxl },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderRadius: radius.xl, backgroundColor: colors.surface, padding: space.lg,
    ...shadow.card,
  },
  heroIcon: {
    width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  heroBody: { flex: 1 },
  heroLabel: { color: colors.text, fontSize: font.h3, fontWeight: '900' },
  heroDesc: { marginTop: 4, color: colors.textMuted, fontSize: font.small, fontWeight: '600', lineHeight: 18 },

  sectionTitle: {
    marginTop: space.xl, marginBottom: space.sm, marginLeft: 2,
    color: colors.textMuted, fontSize: font.tiny, fontWeight: '900',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: {
    // Ровно половина за вычетом половины зазора — ряды сходятся по краям.
    width: '48.5%', height: 138, borderRadius: radius.lg, backgroundColor: colors.surface,
    padding: space.md, ...shadow.card,
  },
  iconTile: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.md,
  },
  label: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  desc: { marginTop: 5, color: colors.textMuted, fontSize: font.tiny, fontWeight: '600', lineHeight: 16 },
});
