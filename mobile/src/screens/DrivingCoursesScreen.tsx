import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  DrivingMode,
  DrivingTestResult,
  DrivingTicket,
  getDrivingResults,
  getDrivingTickets,
} from '../api/driving';
import { AppStackParamList } from '../navigation/AppNavigator';
import { TAB_BAR_SPACE } from '../navigation/FloatingTabBar';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

const modes: Array<{
  mode: DrivingMode;
  title: string;
  hint: string;
  icon: string;
}> = [
  { mode: 'exam', title: 'Экзамен', hint: '20 вопросов', icon: 'clipboard-outline' },
  { mode: 'practice', title: 'Тренировка', hint: 'С ответами', icon: 'book-outline' },
  { mode: 'marathon', title: 'Марафон', hint: '100 вопросов', icon: 'flash-outline' },
];

const modeLabels: Record<DrivingMode, string> = {
  exam: 'Экзамен',
  practice: 'Тренировка',
  marathon: 'Марафон',
};

const formatDate = (value?: string) => {
  if (!value) return 'Недавно';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Недавно';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

// Faint top-left glow behind the icon. Kept as plain Views (no react-native-svg)
// so it renders on any build; a large soft circle lightens the corner.
function CardBackground() {
  return (
    <>
      <View style={styles.cardGlow} pointerEvents="none" />
      <View style={styles.cardGlowInner} pointerEvents="none" />
    </>
  );
}

export default function DrivingCoursesScreen({ navigation }: Props) {
  const [tickets, setTickets] = useState<DrivingTicket[]>([]);
  const [results, setResults] = useState<DrivingTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [ticketData, resultData] = await Promise.all([
        getDrivingTickets(),
        getDrivingResults({ limit: 50 }).catch(() => []),
      ]);
      setTickets(ticketData);
      setResults(resultData);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить автокурсы');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const refresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Ticket numbers the user has already passed — so a mode can open the next
  // ticket they still need to do.
  const passedTickets = useMemo(() => {
    const set = new Set<number>();
    results.forEach((result) => {
      if (result.passed) (result.ticketNumbers || []).forEach((n) => set.add(n));
    });
    return set;
  }, [results]);

  const recent = results.slice(0, 3);

  const startMode = (mode: DrivingMode) => {
    if (mode === 'marathon') {
      navigation.navigate('DrivingQuiz', { mode });
      return;
    }
    const all = tickets.length ? tickets.map((t) => t.number) : Array.from({ length: 40 }, (_, i) => i + 1);
    const pool = all.filter((n) => !passedTickets.has(n));
    const source = pool.length ? pool : all;
    const ticketNumber = source[Math.floor(Math.random() * source.length)];
    navigation.navigate('DrivingQuiz', { mode, ticketNumber });
  };

  const repeatResult = (result: DrivingTestResult) => {
    navigation.navigate('DrivingQuiz', {
      mode: result.mode,
      ticketNumber: result.mode === 'marathon' ? undefined : result.ticketNumbers?.[0],
    });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Автокурсы</Text>
        <Text style={styles.subtitle}>Билеты, тренировка и экзамен по вопросам ПДД</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.bento}>
        <TouchableOpacity style={styles.examBig} onPress={() => startMode('exam')} activeOpacity={0.9}>
          <CardBackground />
          <MaterialCommunityIcons name="clipboard-check-outline" size={50} color={colors.text} style={styles.examIcon} />
          <Text style={styles.examTitle}>Экзамен</Text>
          <Text style={styles.examHint}>20 вопросов на время. Чтобы сдать, нужно ответить верно минимум на 70%.</Text>
        </TouchableOpacity>

        <View style={styles.sideCol}>
          {[modes[2], modes[1]].map((item) => (
            <TouchableOpacity key={item.mode} style={styles.sideCard} onPress={() => startMode(item.mode)} activeOpacity={0.9}>
              <CardBackground />
              <Ionicons name={item.icon as any} size={26} color={colors.text} />
              <Text style={styles.sideTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.sideHint} numberOfLines={1}>{item.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.linksCard}>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('DrivingTickets')} activeOpacity={0.85}>
          <View style={styles.linkIcon}>
            <Ionicons name="grid-outline" size={19} color={colors.text} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Все билеты</Text>
            <Text style={styles.rowSubtitle}>Выберите конкретный билет</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.linkDivider} />
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('DrivingResults')} activeOpacity={0.85}>
          <View style={styles.linkIcon}>
            <Ionicons name="stats-chart-outline" size={19} color={colors.text} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>История результатов</Text>
            <Text style={styles.rowSubtitle}>Оценки, ошибки и повтор</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {recent.length ? (
        <View style={styles.recentBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleCompact}>Последние попытки</Text>
            <TouchableOpacity onPress={() => navigation.navigate('DrivingResults')}>
              <Text style={styles.sectionLink}>Все</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.recentList}>
            {recent.map((result) => (
              <TouchableOpacity
                key={result._id}
                style={styles.resultMiniCard}
                onPress={() => repeatResult(result)}
                activeOpacity={0.86}
              >
                <View style={styles.resultMiniTop}>
                  <Text style={styles.resultMiniMode}>{modeLabels[result.mode]}</Text>
                  <Text style={[styles.resultMiniStatus, result.passed ? styles.resultPassed : styles.resultFailed]}>
                    {result.percentage}%
                  </Text>
                </View>
                <Text style={styles.resultMiniMeta}>
                  {result.correctAnswers}/{result.totalQuestions} правильно · {formatDate(result.createdAt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: TAB_BAR_SPACE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { paddingTop: 6, paddingBottom: 16, alignItems: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 4, color: colors.textMuted, fontSize: 13, fontWeight: '700', lineHeight: 19, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,90,95,0.12)', borderColor: 'rgba(255,90,95,0.25)', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 10 },
  bento: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  cardGlow: { position: 'absolute', top: -70, left: -50, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.035)' },
  cardGlowInner: { position: 'absolute', top: -28, left: -18, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.045)' },
  examBig: { flex: 1, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 18, justifyContent: 'center', overflow: 'hidden' },
  examIcon: { marginBottom: 8 },
  examTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  examHint: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  sideCol: { width: 132, gap: 12 },
  sideCard: { minHeight: 88, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 13, justifyContent: 'center', overflow: 'hidden' },
  sideTitle: { marginTop: 8, color: colors.text, fontSize: 15, fontWeight: '900' },
  sideHint: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  linksCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 12, marginBottom: 18 },
  linkRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  linkIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  linkDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 },
  rowTextWrap: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  rowSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  recentBlock: { marginBottom: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitleCompact: { color: colors.text, fontSize: 17, fontWeight: '900' },
  sectionLink: { color: colors.text, fontSize: 13, fontWeight: '900' },
  recentList: { gap: 8 },
  resultMiniCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  resultMiniTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  resultMiniMode: { color: colors.text, fontSize: 14, fontWeight: '900' },
  resultMiniStatus: { fontSize: 16, fontWeight: '900' },
  resultPassed: { color: colors.success },
  resultFailed: { color: colors.danger },
  resultMiniMeta: { marginTop: 4, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
});
