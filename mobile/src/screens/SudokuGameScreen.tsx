import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import {
  GameProgress,
  getGameLeaderboard,
  getGameProgress,
  saveGameProgress,
} from '../api/kidsGames';

const GAME_ID = 'sudoku';
const GAME_NAME = 'Судоку';
const SIZE = 9;
const CELL_COUNT = SIZE * SIZE;
const MAX_MISTAKES = 3;

type GameStatus = 'idle' | 'running' | 'finished';

type SaveSnapshot = {
  values: number[];
  score: number;
  mistakes: number;
  startedAt: number;
  won: boolean;
};

const HOLES = 44; // cells removed from the solved grid to form the puzzle

const shuffle = <T,>(input: T[]): T[] => {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const canPlaceNumber = (grid: number[], pos: number, num: number) => {
  const row = Math.floor(pos / SIZE);
  const col = pos % SIZE;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < SIZE; i += 1) {
    if (grid[row * SIZE + i] === num) return false;
    if (grid[i * SIZE + col] === num) return false;
  }
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (grid[(boxRow + r) * SIZE + (boxCol + c)] === num) return false;
    }
  }
  return true;
};

// Backtracking generator: fills a valid complete grid, then removes cells.
const generateSolved = (): number[] => {
  const grid = new Array(CELL_COUNT).fill(0);
  const fill = (pos: number): boolean => {
    if (pos === CELL_COUNT) return true;
    for (const num of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (canPlaceNumber(grid, pos, num)) {
        grid[pos] = num;
        if (fill(pos + 1)) return true;
        grid[pos] = 0;
      }
    }
    return false;
  };
  fill(0);
  return grid;
};

const createGame = () => {
  const solution = generateSolved();
  const values = [...solution];
  const order = shuffle(Array.from({ length: CELL_COUNT }, (_, index) => index));
  for (let i = 0; i < HOLES; i += 1) values[order[i]] = 0;
  return {
    values,
    solution,
    fixed: values.map((item) => item > 0),
    selectedIndex: values.findIndex((item) => item === 0),
  };
};

const countFilled = (values: number[]) => values.filter(Boolean).length;

const progressFromValues = (values: number[]) => Math.min(100, Math.round((countFilled(values) / CELL_COUNT) * 100));

const getLevel = (values: number[]) => Math.max(1, Math.min(9, Math.floor(countFilled(values) / 9)));

const getRow = (index: number) => Math.floor(index / SIZE);
const getCol = (index: number) => index % SIZE;
const getBox = (index: number) => `${Math.floor(getRow(index) / 3)}:${Math.floor(getCol(index) / 3)}`;

const getPlayerName = (item: GameProgress) => {
  if (!item.userId || typeof item.userId === 'string') return 'Игрок';
  return item.userId.name || item.userId.userName || 'Игрок';
};

const formatPlayTime = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!minutes) return `${rest} сек`;
  return `${minutes} мин ${rest} сек`;
};

export default function SudokuGameScreen() {
  const initial = createGame();
  const savingRef = useRef(false);
  const [values, setValues] = useState<number[]>(initial.values);
  const [solution, setSolution] = useState<number[]>(initial.solution);
  const [fixed, setFixed] = useState<boolean[]>(initial.fixed);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initial.selectedIndex >= 0 ? initial.selectedIndex : null);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [nextProgress, nextLeaderboard] = await Promise.all([
        getGameProgress(GAME_ID),
        getGameLeaderboard(GAME_ID, 10),
      ]);
      setProgress(nextProgress);
      setLeaderboard(nextLeaderboard);
    } catch (e: any) {
      Alert.alert('Судоку', e.response?.data?.message || 'Не удалось загрузить прогресс игры');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const sessionProgress = useMemo(() => progressFromValues(values), [values]);
  const level = useMemo(() => getLevel(values), [values]);

  const buildAchievements = (snapshot: SaveSnapshot) => {
    const achievements: string[] = [];
    const filled = countFilled(snapshot.values);
    if (filled >= 45) achievements.push('Половина поля');
    if (snapshot.won) achievements.push('Судоку решено');
    if (snapshot.won && snapshot.mistakes === 0) achievements.push('Без ошибок');
    if (snapshot.score >= 300) achievements.push('Логический разгон');
    return achievements;
  };

  const persistResult = useCallback(async (reason: 'manual' | 'finish', snapshot: SaveSnapshot) => {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const playTime = Math.max(1, Math.round((Date.now() - snapshot.startedAt) / 1000));
      const saved = await saveGameProgress(GAME_ID, {
        gameName: GAME_NAME,
        score: snapshot.score,
        level: getLevel(snapshot.values),
        progress: progressFromValues(snapshot.values),
        playTime,
        achievements: buildAchievements(snapshot),
        gameData: {
          reason,
          mistakes: snapshot.mistakes,
          won: snapshot.won,
          filled: countFilled(snapshot.values),
        },
      });
      setProgress(saved);
      setLeaderboard(await getGameLeaderboard(GAME_ID, 10));
    } catch (e: any) {
      Alert.alert('Судоку', e.response?.data?.message || 'Не удалось сохранить результат');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  const finishGame = useCallback((won: boolean, nextValues = values, nextScore = score, nextMistakes = mistakes) => {
    setStatus('finished');
    void persistResult(won ? 'finish' : 'manual', {
      values: nextValues,
      score: nextScore,
      mistakes: nextMistakes,
      startedAt,
      won,
    });
  }, [mistakes, persistResult, score, startedAt, values]);

  const startGame = () => {
    const next = createGame();
    setValues(next.values);
    setSolution(next.solution);
    setFixed(next.fixed);
    setSelectedIndex(next.selectedIndex >= 0 ? next.selectedIndex : null);
    setScore(0);
    setMistakes(0);
    setStartedAt(Date.now());
    setStatus('running');
  };

  const setNumber = (number: number) => {
    if (status !== 'running' || selectedIndex === null || fixed[selectedIndex]) return;

    if (number === 0) {
      setValues((prev) => {
        const next = [...prev];
        next[selectedIndex] = 0;
        return next;
      });
      return;
    }

    if (number !== solution[selectedIndex]) {
      const nextMistakes = mistakes + 1;
      const nextScore = Math.max(0, score - 5);
      setMistakes(nextMistakes);
      setScore(nextScore);
      if (nextMistakes >= MAX_MISTAKES) {
        finishGame(false, values, nextScore, nextMistakes);
      }
      return;
    }

    const nextValues = [...values];
    nextValues[selectedIndex] = number;
    const nextScore = score + 12 + level;
    setValues(nextValues);
    setScore(nextScore);

    const nextEmpty = nextValues.findIndex((item, index) => item === 0 && !fixed[index]);
    setSelectedIndex(nextEmpty >= 0 ? nextEmpty : selectedIndex);

    if (nextValues.every((value, index) => value === solution[index])) {
      finishGame(true, nextValues, nextScore, mistakes);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const selectedRow = selectedIndex === null ? -1 : getRow(selectedIndex);
  const selectedCol = selectedIndex === null ? -1 : getCol(selectedIndex);
  const selectedBox = selectedIndex === null ? '' : getBox(selectedIndex);
  const bestScore = progress?.bestScore || progress?.score || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.title}>Судоку</Text>
          <Text style={styles.subtitle}>Заполните поле без ошибок и сохраните результат в общем рейтинге.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="keypad-outline" size={28} color="#fff" />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{score}</Text>
          <Text style={styles.statLabel}>Очки</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{bestScore}</Text>
          <Text style={styles.statLabel}>Рекорд</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{MAX_MISTAKES - mistakes}</Text>
          <Text style={styles.statLabel}>Ошибки</Text>
        </View>
      </View>

      <View style={styles.board}>
        {values.map((value, index) => {
          const row = getRow(index);
          const col = getCol(index);
          const active = selectedIndex === index;
          const related = row === selectedRow || col === selectedCol || getBox(index) === selectedBox;
          return (
            <TouchableOpacity
              key={`${index}-${value}`}
              style={[
                styles.cell,
                col % 3 === 0 && styles.cellBoxLeft,
                row % 3 === 0 && styles.cellBoxTop,
                related && styles.cellRelated,
                active && styles.cellActive,
                fixed[index] && styles.cellFixed,
              ]}
              activeOpacity={0.86}
              onPress={() => setSelectedIndex(index)}
            >
              {value ? (
                <Text style={[styles.cellText, fixed[index] ? styles.fixedText : styles.playerText]}>{value}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Заполнено поле</Text>
          <Text style={styles.progressValue}>{sessionProgress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${sessionProgress}%` }]} />
        </View>
      </View>

      {status === 'running' ? (
        <View style={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
            <TouchableOpacity key={number} style={styles.numberBtn} onPress={() => setNumber(number)} activeOpacity={0.85}>
              <Text style={styles.numberText}>{number}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.eraseBtn} onPress={() => setNumber(0)} activeOpacity={0.85}>
            <Ionicons name="backspace-outline" size={20} color={colors.text} />
            <Text style={styles.eraseText}>Стереть</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={() => finishGame(false)} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color={colors.text} /> : <Ionicons name="save-outline" size={20} color={colors.text} />}
            <Text style={styles.saveText}>Сохранить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.startBtn} onPress={startGame} activeOpacity={0.85}>
          <Ionicons name="play-circle-outline" size={22} color="#fff" />
          <Text style={styles.startText}>{status === 'finished' ? 'Новая партия' : 'Старт'}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
          <Text style={styles.sectionTitle}>Мой прогресс</Text>
        </View>
        <View style={styles.savedGrid}>
          <View style={styles.savedItem}>
            <Text style={styles.savedValue}>{progress?.bestScore || 0}</Text>
            <Text style={styles.savedLabel}>лучший счет</Text>
          </View>
          <View style={styles.savedItem}>
            <Text style={styles.savedValue}>{progress?.level || 1}</Text>
            <Text style={styles.savedLabel}>уровень</Text>
          </View>
          <View style={styles.savedItem}>
            <Text style={styles.savedValue}>{progress?.timesPlayed || 0}</Text>
            <Text style={styles.savedLabel}>партий</Text>
          </View>
        </View>
        <Text style={styles.playTime}>Время в игре: {formatPlayTime(progress?.totalPlayTime || 0)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy-outline" size={20} color={colors.text} />
          <Text style={styles.sectionTitle}>Рейтинг</Text>
        </View>
        {leaderboard.length ? leaderboard.map((item, index) => (
          <View key={item._id || `${item.gameId}-${index}`} style={styles.rankRow}>
            <Text style={styles.rankNumber}>{index + 1}</Text>
            <View style={styles.rankAvatar}>
              <Text style={styles.rankInitial}>{getPlayerName(item).slice(0, 1)}</Text>
            </View>
            <Text style={styles.rankName}>{getPlayerName(item)}</Text>
            <Text style={styles.rankScore}>{item.bestScore || item.score || 0}</Text>
          </View>
        )) : (
          <Text style={styles.mutedText}>Рейтинг пока пуст. Первый сохраненный результат появится здесь.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 12, paddingBottom: 30, gap: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, backgroundColor: colors.surfaceHi, padding: 14 },
  heroText: { flex: 1 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#ddd', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  board: { aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surfaceHi, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 2, borderColor: colors.border },
  cell: { width: '11.111111%', aspectRatio: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  cellBoxLeft: { borderLeftWidth: 2, borderLeftColor: colors.border },
  cellBoxTop: { borderTopWidth: 2, borderTopColor: colors.border },
  cellRelated: { backgroundColor: 'rgba(246,178,61,0.14)' },
  cellActive: { backgroundColor: '#ffe1df' },
  cellFixed: { backgroundColor: colors.surfaceAlt },
  cellText: { fontSize: 19, fontWeight: '900' },
  fixedText: { color: colors.text },
  playerText: { color: colors.danger },
  progressBlock: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  progressValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.danger },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  numberBtn: { width: '31.8%', height: 48, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  eraseBtn: { flex: 1, minWidth: '45%', height: 48, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  eraseText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  saveBtn: { flex: 1, minWidth: '45%', height: 48, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  startBtn: { height: 50, borderRadius: 8, backgroundColor: colors.surfaceHi, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  startText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  card: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  savedGrid: { flexDirection: 'row', gap: 8 },
  savedItem: { flex: 1, borderRadius: 8, backgroundColor: colors.surfaceAlt, padding: 10 },
  savedValue: { color: colors.text, fontSize: 19, fontWeight: '900' },
  savedLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  playTime: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  rankRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 8, backgroundColor: colors.bg, paddingHorizontal: 10, paddingVertical: 7 },
  rankNumber: { width: 22, color: colors.danger, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  rankAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  rankInitial: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  rankName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  rankScore: { color: colors.text, fontSize: 14, fontWeight: '900' },
  mutedText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
