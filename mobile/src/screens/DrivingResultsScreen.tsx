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
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  DrivingMode,
  DrivingStatistics,
  DrivingTestResult,
  getDrivingResults,
  getDrivingStatistics,
} from '../api/driving';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'DrivingResults'>;
  route: RouteProp<AppStackParamList, 'DrivingResults'>;
};

const modeLabels: Record<DrivingMode, string> = {
  exam: 'Экзамен',
  practice: 'Тренировка',
  marathon: 'Марафон',
};

const modeColors: Record<DrivingMode, string> = {
  exam: '#1d4ed8',
  practice: '#b45309',
  marathon: '#7c3aed',
};

const filters: Array<{ label: string; value?: DrivingMode }> = [
  { label: 'Все' },
  { label: 'Экзамен', value: 'exam' },
  { label: 'Тренировка', value: 'practice' },
  { label: 'Марафон', value: 'marathon' },
];

const formatDate = (value?: string) => {
  if (!value) return 'Дата неизвестна';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата неизвестна';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (seconds?: number) => {
  const safe = Math.max(0, seconds ?? 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export default function DrivingResultsScreen({ navigation, route }: Props) {
  const [selectedMode, setSelectedMode] = useState<DrivingMode | undefined>(route.params?.mode);
  const [results, setResults] = useState<DrivingTestResult[]>([]);
  const [statistics, setStatistics] = useState<DrivingStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [resultData, statsData] = await Promise.all([
        getDrivingResults({ mode: selectedMode, limit: 50 }),
        getDrivingStatistics().catch(() => null),
      ]);
      setResults(resultData);
      setStatistics(statsData);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить историю результатов');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMode]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const totals = useMemo(() => {
    const attempts = results.length;
    const questions = results.reduce((sum, item) => sum + (item.totalQuestions || 0), 0);
    const correct = results.reduce((sum, item) => sum + (item.correctAnswers || 0), 0);
    return { attempts, questions, correct };
  }, [results]);

  const refresh = () => {
    setRefreshing(true);
    loadData();
  };

  const repeatResult = (result: DrivingTestResult) => {
    const firstTicket = result.ticketNumbers?.[0];
    navigation.navigate('DrivingQuiz', {
      mode: result.mode,
      ticketNumber: result.mode === 'marathon' ? undefined : firstTicket,
    });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="stats-chart-outline" size={28} color="#111" />
        </View>
        <Text style={styles.title}>Результаты</Text>
        <Text style={styles.subtitle}>История тестов, экзаменов и тренировок по билетам ПДД</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={22} color="#b91c1c" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics?.totalTests ?? totals.attempts}</Text>
          <Text style={styles.statLabel}>попыток</Text>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((filter) => {
          const selected = selectedMode === filter.value;
          return (
            <TouchableOpacity
              key={filter.label}
              style={[styles.filterBtn, selected && styles.filterBtnActive]}
              onPress={() => setSelectedMode(filter.value)}
              activeOpacity={0.86}
            >
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.summaryBox}>
        <View style={styles.summaryItem}>
          <Ionicons name="checkmark-done-outline" size={20} color="#15803d" />
          <Text style={styles.summaryText}>{totals.correct} верных ответов</Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="help-circle-outline" size={20} color="#555" />
          <Text style={styles.summaryText}>{totals.questions} вопросов пройдено</Text>
        </View>
      </View>

      {results.length ? (
        <View style={styles.resultList}>
          {results.map((result) => {
            const color = modeColors[result.mode];
            const ticketText = result.ticketNumbers?.length
              ? `Билет ${result.ticketNumbers.join(', ')}`
              : modeLabels[result.mode];
            return (
              <View key={result._id} style={styles.resultCard}>
                <View style={styles.resultTop}>
                  <View style={[styles.modeBadge, { backgroundColor: `${color}18` }]}>
                    <Ionicons name="school-outline" size={16} color={color} />
                    <Text style={[styles.modeBadgeText, { color }]}>{modeLabels[result.mode]}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatDate(result.createdAt)}</Text>
                </View>

                <View style={styles.scoreRow}>
                  <View>
                    <Text style={styles.ticketText}>{ticketText}</Text>
                    <Text style={styles.answerText}>
                      {result.correctAnswers} из {result.totalQuestions} правильно
                    </Text>
                  </View>
                  <View style={[styles.percentBadge, result.passed ? styles.percentPassed : styles.percentFailed]}>
                    <Text style={[styles.percentText, result.passed ? styles.percentTextPassed : styles.percentTextFailed]}>
                      {result.percentage}%
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="close-circle-outline" size={16} color="#b91c1c" />
                    <Text style={styles.metaText}>{result.wrongAnswers} ошибок</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={16} color="#555" />
                    <Text style={styles.metaText}>{formatTime(result.timeSpentSeconds)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name={result.passed ? 'checkmark-circle-outline' : 'reload-outline'} size={16} color={result.passed ? '#15803d' : '#b45309'} />
                    <Text style={styles.metaText}>{result.passed ? 'Сдано' : 'Повторить'}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.repeatBtn} onPress={() => repeatResult(result)} activeOpacity={0.88}>
                  <Ionicons name="refresh-outline" size={18} color="#111" />
                  <Text style={styles.repeatText}>Пройти еще раз</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="document-text-outline" size={42} color="#bbb" />
          <Text style={styles.emptyTitle}>Пока нет результатов</Text>
          <Text style={styles.emptyText}>Пройдите билет, тренировку или марафон, и результат появится здесь.</Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => navigation.navigate('Tabs', { screen: 'Driving' })}>
            <Text style={styles.startText}>К билетам</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  content: { padding: 16, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  header: { alignItems: 'center', paddingTop: 10, paddingBottom: 18 },
  headerIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  title: { marginTop: 12, color: '#111', fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderColor: '#fee2e2', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: '#991b1b', fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  statValue: { color: '#111', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#777', fontSize: 11, fontWeight: '700', marginTop: 3 },
  filters: { gap: 8, paddingVertical: 8 },
  filterBtn: { height: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  filterText: { color: '#555', fontSize: 13, fontWeight: '900' },
  filterTextActive: { color: '#fff' },
  summaryBox: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', padding: 12, gap: 9, marginTop: 6, marginBottom: 14 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { color: '#222', fontSize: 13, fontWeight: '800' },
  resultList: { gap: 10 },
  resultCard: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ececec', padding: 13 },
  resultTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modeBadge: { height: 30, borderRadius: 10, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  modeBadgeText: { fontSize: 12, fontWeight: '900' },
  dateText: { color: '#888', fontSize: 12, fontWeight: '700' },
  scoreRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ticketText: { color: '#111', fontSize: 16, fontWeight: '900' },
  answerText: { marginTop: 3, color: '#666', fontSize: 13, fontWeight: '700' },
  percentBadge: { minWidth: 64, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  percentPassed: { backgroundColor: '#dcfce7' },
  percentFailed: { backgroundColor: '#fee2e2' },
  percentText: { fontSize: 18, fontWeight: '900' },
  percentTextPassed: { color: '#15803d' },
  percentTextFailed: { color: '#b91c1c' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaItem: { minHeight: 28, borderRadius: 9, backgroundColor: '#f7f7f7', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: '#555', fontSize: 12, fontWeight: '800' },
  repeatBtn: { marginTop: 12, height: 42, borderRadius: 10, backgroundColor: '#f4f4f4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  repeatText: { color: '#111', fontSize: 14, fontWeight: '900' },
  emptyBox: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', padding: 22, alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: '#111', fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 6, color: '#666', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  startBtn: { marginTop: 15, height: 42, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#111', justifyContent: 'center' },
  startText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
