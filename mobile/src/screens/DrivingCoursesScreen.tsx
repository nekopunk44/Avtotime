import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  DrivingMode,
  DrivingStatistics,
  DrivingTestResult,
  DrivingTicket,
  getDrivingResults,
  getDrivingStatistics,
  getDrivingTickets,
} from '../api/driving';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

const modes: Array<{
  mode: DrivingMode;
  title: string;
  description: string;
  icon: string;
  color: string;
  backgroundColor: string;
}> = [
  {
    mode: 'exam',
    title: 'Экзамен',
    description: '20 вопросов, результат и проходной балл 70%',
    icon: 'timer-outline',
    color: '#1d4ed8',
    backgroundColor: colors.surfaceAlt,
  },
  {
    mode: 'practice',
    title: 'Тренировка',
    description: 'Билет без таймера, ответы с объяснениями',
    icon: 'book-outline',
    color: '#b45309',
    backgroundColor: 'rgba(246,178,61,0.14)',
  },
  {
    mode: 'marathon',
    title: 'Марафон',
    description: '100 случайных вопросов для закрепления',
    icon: 'flash-outline',
    color: '#7c3aed',
    backgroundColor: colors.surfaceAlt,
  },
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

export default function DrivingCoursesScreen({ navigation }: Props) {
  const [tickets, setTickets] = useState<DrivingTicket[]>([]);
  const [statistics, setStatistics] = useState<DrivingStatistics | null>(null);
  const [recentResults, setRecentResults] = useState<DrivingTestResult[]>([]);
  const [selectedMode, setSelectedMode] = useState<DrivingMode>('exam');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [ticketData, statsData] = await Promise.all([
        getDrivingTickets(),
        getDrivingStatistics().catch(() => null),
      ]);
      const resultData = await getDrivingResults({ limit: 5 }).catch(() => []);
      setTickets(ticketData);
      setStatistics(statsData);
      setRecentResults(resultData);
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

  const startMode = (mode: DrivingMode, ticketNumber?: number) => {
    navigation.navigate('DrivingQuiz', { mode, ticketNumber });
  };

  const openResults = (mode?: DrivingMode) => {
    navigation.navigate('DrivingResults', mode ? { mode } : undefined);
  };

  const repeatResult = (result: DrivingTestResult) => {
    const firstTicket = result.ticketNumbers?.[0];
    startMode(result.mode, result.mode === 'marathon' ? undefined : firstTicket);
  };

  const activeMode = modes.find((item) => item.mode === selectedMode) ?? modes[0];

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
        <View style={styles.headerIcon}>
          <Ionicons name="school-outline" size={28} color={colors.text} />
        </View>
        <Text style={styles.title}>Автокурсы</Text>
        <Text style={styles.subtitle}>Билеты, тренировка и экзамен по вопросам ПДД</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={22} color="#b91c1c" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics?.totalTests ?? 0}</Text>
          <Text style={styles.statLabel}>тестов</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics?.averagePercentage ?? 0}%</Text>
          <Text style={styles.statLabel}>средний балл</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics?.passedExams ?? 0}</Text>
          <Text style={styles.statLabel}>экзаменов</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.historyBtn} onPress={() => openResults()} activeOpacity={0.88}>
        <View style={styles.historyIcon}>
          <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
        </View>
        <View style={styles.historyTextWrap}>
          <Text style={styles.historyTitle}>История результатов</Text>
          <Text style={styles.historySubtitle}>Оценки, ошибки и повтор билетов</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      {recentResults.length ? (
        <View style={styles.recentBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleCompact}>Последние попытки</Text>
            <TouchableOpacity onPress={() => openResults()}>
              <Text style={styles.sectionLink}>Все</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.recentList}>
            {recentResults.map((result) => (
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

      <Text style={styles.sectionTitle}>Режим</Text>
      <View style={styles.modeList}>
        {modes.map((item) => {
          const selected = item.mode === selectedMode;
          return (
            <TouchableOpacity
              key={item.mode}
              style={[styles.modeCard, selected && styles.modeCardActive, { backgroundColor: selected ? item.backgroundColor : colors.surface }]}
              onPress={() => setSelectedMode(item.mode)}
              activeOpacity={0.88}
            >
              <View style={[styles.modeIcon, { backgroundColor: item.backgroundColor }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <View style={styles.modeTextWrap}>
                <Text style={styles.modeTitle}>{item.title}</Text>
                <Text style={styles.modeDescription}>{item.description}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={item.color} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedMode === 'marathon' ? (
        <TouchableOpacity
          style={[styles.startBigBtn, { backgroundColor: activeMode.color }]}
          onPress={() => startMode('marathon')}
          activeOpacity={0.9}
        >
          <Ionicons name="flash-outline" size={20} color="#fff" />
          <Text style={styles.startBigText}>Начать марафон</Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.ticketHeader}>
            <Text style={styles.sectionTitle}>Билеты</Text>
            <Text style={styles.ticketHint}>1-40</Text>
          </View>
          <FlatList
            data={tickets.length ? tickets : Array.from({ length: 40 }, (_, index) => ({ number: index + 1, totalQuestions: 20 }))}
            keyExtractor={(item) => String(item.number)}
            numColumns={5}
            scrollEnabled={false}
            columnWrapperStyle={styles.ticketRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.ticketBtn}
                onPress={() => startMode(selectedMode, item.number)}
                activeOpacity={0.85}
              >
                <Text style={styles.ticketNumber}>{item.number}</Text>
                <Text style={styles.ticketCount}>{item.totalQuestions || 20}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  header: { alignItems: 'center', paddingTop: 14, paddingBottom: 20 },
  headerIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { marginTop: 12, color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 5, color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,90,95,0.12)', borderColor: '#fee2e2', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: '#991b1b', fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  historyBtn: { minHeight: 68, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  historyTextWrap: { flex: 1 },
  historyTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  historySubtitle: { marginTop: 3, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  recentBlock: { marginBottom: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitleCompact: { color: colors.text, fontSize: 17, fontWeight: '900' },
  sectionLink: { color: colors.text, fontSize: 13, fontWeight: '900' },
  recentList: { gap: 8 },
  resultMiniCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12 },
  resultMiniTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  resultMiniMode: { color: colors.text, fontSize: 14, fontWeight: '900' },
  resultMiniStatus: { fontSize: 16, fontWeight: '900' },
  resultPassed: { color: '#15803d' },
  resultFailed: { color: '#b91c1c' },
  resultMiniMeta: { marginTop: 4, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 10 },
  modeList: { gap: 9 },
  modeCard: { minHeight: 78, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeCardActive: { borderColor: '#d5d5d5' },
  modeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modeTextWrap: { flex: 1 },
  modeTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  modeDescription: { marginTop: 3, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  startBigBtn: { height: 52, borderRadius: 12, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startBigText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  ticketHeader: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketHint: { color: colors.textFaint, fontSize: 12, fontWeight: '800' },
  ticketRow: { gap: 8, marginBottom: 8 },
  ticketBtn: { flex: 1, aspectRatio: 1, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ticketNumber: { color: colors.text, fontSize: 17, fontWeight: '900' },
  ticketCount: { marginTop: 2, color: colors.textFaint, fontSize: 10, fontWeight: '800' },
});
