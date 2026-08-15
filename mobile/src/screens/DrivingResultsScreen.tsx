import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { colors } from '../theme';

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
  exam: colors.text,
  practice: colors.text,
  marathon: colors.text,
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
  // Content-sized segments spaced evenly, with a thumb that slides + resizes to
  // the active one (so gaps between labels stay equal regardless of length).
  const [segLayouts, setSegLayouts] = useState<Array<{ x: number; width: number }>>([]);
  const thumbX = useRef(new Animated.Value(0)).current;
  const thumbW = useRef(new Animated.Value(0)).current;
  const thumbInited = useRef(false);
  const activeIndex = selectedMode === 'exam' ? 1 : selectedMode === 'practice' ? 2 : selectedMode === 'marathon' ? 3 : 0;

  useEffect(() => {
    const layout = segLayouts[activeIndex];
    if (!layout) return;
    if (!thumbInited.current) {
      thumbInited.current = true;
      thumbX.setValue(layout.x);
      thumbW.setValue(layout.width);
      return;
    }
    Animated.parallel([
      Animated.spring(thumbX, { toValue: layout.x, useNativeDriver: false, friction: 10, tension: 90 }),
      Animated.spring(thumbW, { toValue: layout.width, useNativeDriver: false, friction: 10, tension: 90 }),
    ]).start();
  }, [activeIndex, segLayouts, thumbX, thumbW]);

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
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.statsStrip}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{statistics?.totalTests ?? totals.attempts}</Text>
          <Text style={styles.statLabel}>попыток</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{statistics?.averagePercentage ?? 0}%</Text>
          <Text style={styles.statLabel}>средний балл</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{statistics?.passedExams ?? 0}</Text>
          <Text style={styles.statLabel}>экзаменов</Text>
        </View>
      </View>

      <View style={styles.segment}>
        {segLayouts.length === filters.length ? (
          <Animated.View style={[styles.segThumb, { left: thumbX, width: thumbW }]} />
        ) : null}
        {filters.map((filter, index) => {
          const selected = selectedMode === filter.value;
          return (
            <TouchableOpacity
              key={filter.label}
              style={styles.segmentBtn}
              onPress={() => setSelectedMode(filter.value)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setSegLayouts((prev) => {
                  if (prev[index] && prev[index].x === x && prev[index].width === width) return prev;
                  const next = [...prev];
                  next[index] = { x, width };
                  return next;
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]} numberOfLines={1}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
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
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.metaText}>{formatTime(result.timeSpentSeconds)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name={result.passed ? 'checkmark-circle-outline' : 'reload-outline'} size={16} color={result.passed ? colors.success : colors.warning} />
                    <Text style={styles.metaText}>{result.passed ? 'Сдано' : 'Повторить'}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.repeatBtn} onPress={() => repeatResult(result)} activeOpacity={0.88}>
                  <Ionicons name="refresh-outline" size={18} color={colors.text} />
                  <Text style={styles.repeatText}>Пройти еще раз</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="document-text-outline" size={42} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Пока нет результатов</Text>
          <Text style={styles.emptyText}>Пройдите билет, тренировку или марафон, и результат появится здесь.</Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => navigation.navigate('MarketTabs', { screen: 'Driving' })}>
            <Text style={styles.startText}>К билетам</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: 16, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,90,95,0.12)', borderColor: 'rgba(255,90,95,0.25)', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '700' },
  statsStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingVertical: 12, marginTop: 8, marginBottom: 4 },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: 19, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 3 },
  segment: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 46, marginTop: 12, marginBottom: 4 },
  segThumb: { position: 'absolute', top: 4, height: 38, borderRadius: 999, backgroundColor: colors.accent },
  segmentBtn: { height: 38, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: colors.onAccent },
  resultList: { gap: 10 },
  resultCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 13 },
  resultTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modeBadge: { height: 30, borderRadius: 10, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  modeBadgeText: { fontSize: 12, fontWeight: '900' },
  dateText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  scoreRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ticketText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  answerText: { marginTop: 3, color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  percentBadge: { minWidth: 64, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  percentPassed: { backgroundColor: 'rgba(61,214,140,0.14)' },
  percentFailed: { backgroundColor: 'rgba(255,90,95,0.12)' },
  percentText: { fontSize: 18, fontWeight: '900' },
  percentTextPassed: { color: colors.success },
  percentTextFailed: { color: colors.danger },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaItem: { minHeight: 28, borderRadius: 9, backgroundColor: colors.bg, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  repeatBtn: { marginTop: 12, height: 42, borderRadius: 10, backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  repeatText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  startBtn: { marginTop: 15, height: 42, paddingHorizontal: 20, borderRadius: 10, backgroundColor: colors.surfaceHi, justifyContent: 'center' },
  startText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
