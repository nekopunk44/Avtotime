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

const SERVICES: Service[] = [
  { icon: 'car-sport-outline', label: 'Подбор авто', desc: 'Заявка на подбор под ваши критерии', screen: 'CarRequest' },
  { icon: 'git-compare-outline', label: 'Сравнение', desc: 'Сравнить объявления по характеристикам', screen: 'Compare' },
  { icon: 'bar-chart-outline', label: 'Аналитика', desc: 'Просмотры и контакты по объявлениям', screen: 'MarketAnalytics' },
  { icon: 'heart-outline', label: 'Запросы помощи', desc: 'Помощь на дороге и вашим заявкам', screen: 'HelpRequests' },
  { icon: 'school-outline', label: 'Автокурсы', desc: 'Тесты ПДД и подготовка к экзамену', screen: 'DrivingQuiz' },
  { icon: 'leaf-outline', label: 'Эко советы', desc: 'Экономия и забота об экологии', screen: 'EcoTips' },
  { icon: 'game-controller-outline', label: 'Детям и игры', desc: 'Раскраски и мини-игры про машины', screen: 'KidsGames' },
  { icon: 'card-outline', label: 'Тарифы', desc: 'Планы продавца и история оплат', screen: 'Billing' },
];

export default function MarketServicesScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.lead}>Инструменты и разделы маркета Avtotime в одном месте.</Text>
      <View style={styles.grid}>
        {SERVICES.map((s) => (
          <PressableScale key={s.label} style={styles.card} onPress={() => navigation.navigate(s.screen as any)}>
            <View style={styles.iconTile}>
              <Ionicons name={s.icon} size={22} color={colors.text} />
            </View>
            <Text style={styles.label}>{s.label}</Text>
            <Text style={styles.desc} numberOfLines={2}>{s.desc}</Text>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xxl },
  lead: { color: colors.textMuted, fontSize: font.small, fontWeight: '700', lineHeight: 19, marginBottom: space.md, paddingHorizontal: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: {
    width: '48.5%', minHeight: 132, borderRadius: radius.lg, backgroundColor: colors.surface,
    padding: space.md, gap: 8, ...shadow.card,
  },
  iconTile: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  label: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  desc: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '600', lineHeight: 16 },
});
