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

const GAME_ID = 'snake';
const GAME_NAME = 'Змейка';
const GRID_SIZE = 12;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const TICK_MS = 170;

type GameStatus = 'idle' | 'running' | 'finished';
type Direction = 'up' | 'right' | 'down' | 'left';

type Point = {
  x: number;
  y: number;
};

type RuntimeState = {
  snake: Point[];
  food: Point;
  direction: Direction;
  pendingDirection: Direction;
  score: number;
  level: number;
  startedAt: number;
};

const initialSnake: Point[] = [
  { x: 5, y: 7 },
  { x: 4, y: 7 },
  { x: 3, y: 7 },
];

const pointKey = (point: Point) => `${point.x}:${point.y}`;
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const hasPoint = (points: Point[], point: Point) => points.some((item) => samePoint(item, point));

const isOpposite = (current: Direction, next: Direction) => (
  (current === 'up' && next === 'down') ||
  (current === 'down' && next === 'up') ||
  (current === 'left' && next === 'right') ||
  (current === 'right' && next === 'left')
);

const nextHead = (head: Point, direction: Direction): Point => {
  if (direction === 'up') return { x: head.x, y: head.y - 1 };
  if (direction === 'down') return { x: head.x, y: head.y + 1 };
  if (direction === 'left') return { x: head.x - 1, y: head.y };
  return { x: head.x + 1, y: head.y };
};

const randomFood = (snake: Point[]) => {
  if (snake.length >= CELL_COUNT) return { x: 0, y: 0 };

  let food = { x: 0, y: 0 };
  do {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (hasPoint(snake, food));

  return food;
};

const createRuntime = (): RuntimeState => ({
  snake: initialSnake,
  food: randomFood(initialSnake),
  direction: 'right',
  pendingDirection: 'right',
  score: 0,
  level: 1,
  startedAt: Date.now(),
});

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

export default function SnakeGameScreen() {
  const runtimeRef = useRef<RuntimeState>(createRuntime());
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingRef = useRef(false);

  const [status, setStatus] = useState<GameStatus>('idle');
  const [snake, setSnake] = useState<Point[]>(initialSnake);
  const [food, setFood] = useState<Point>(runtimeRef.current.food);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const clearTimers = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  const syncRuntime = useCallback((next: RuntimeState) => {
    runtimeRef.current = next;
    setSnake(next.snake);
    setFood(next.food);
    setScore(next.score);
    setLevel(next.level);
  }, []);

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
      Alert.alert('Змейка', e.response?.data?.message || 'Не удалось загрузить прогресс игры');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    return () => clearTimers();
  }, [clearTimers, loadData]));

  const sessionProgress = useMemo(() => Math.min(100, Math.floor(score / 5)), [score]);

  const buildAchievements = (current: RuntimeState) => {
    const achievements: string[] = [];
    if (current.score >= 50) achievements.push('Первый набор');
    if (current.score >= 150) achievements.push('Длинная серия');
    if (current.score >= 300) achievements.push('Мастер сетки');
    if (current.snake.length >= 15) achievements.push('Большая цепочка');
    return achievements;
  };

  const persistResult = useCallback(async (reason: 'manual' | 'finish' = 'manual') => {
    if (savingRef.current) return;

    const current = runtimeRef.current;
    if (!current.startedAt) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const playTime = Math.max(1, Math.round((Date.now() - current.startedAt) / 1000));
      const saved = await saveGameProgress(GAME_ID, {
        gameName: GAME_NAME,
        score: current.score,
        level: current.level,
        progress: Math.min(100, Math.floor(current.score / 5)),
        playTime,
        achievements: buildAchievements(current),
        gameData: {
          reason,
          length: current.snake.length,
          food: pointKey(current.food),
        },
      });
      setProgress(saved);
      setLeaderboard(await getGameLeaderboard(GAME_ID, 10));
    } catch (e: any) {
      Alert.alert('Змейка', e.response?.data?.message || 'Не удалось сохранить результат');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  const finishGame = useCallback((reason: 'manual' | 'finish' = 'finish') => {
    clearTimers();
    setStatus('finished');
    void persistResult(reason);
  }, [clearTimers, persistResult]);

  const tick = useCallback(() => {
    const current = runtimeRef.current;
    const direction = current.pendingDirection;
    const head = nextHead(current.snake[0], direction);
    const outOfBounds = head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
    const eating = samePoint(head, current.food);
    const bodyToCheck = eating ? current.snake : current.snake.slice(0, -1);

    if (outOfBounds || hasPoint(bodyToCheck, head)) {
      finishGame('finish');
      return;
    }

    let nextSnake = [head, ...current.snake];
    let nextFood = current.food;
    let nextScore = current.score + 1;

    if (eating) {
      nextScore += 18 + current.level * 2;
      nextFood = randomFood(nextSnake);
    } else {
      nextSnake = nextSnake.slice(0, -1);
    }

    const nextLevel = Math.min(12, Math.floor(nextScore / 90) + 1);
    syncRuntime({
      snake: nextSnake,
      food: nextFood,
      direction,
      pendingDirection: direction,
      score: nextScore,
      level: nextLevel,
      startedAt: current.startedAt,
    });
  }, [finishGame, syncRuntime]);

  const startGame = () => {
    clearTimers();
    const next = createRuntime();
    syncRuntime(next);
    setStatus('running');
    loopRef.current = setInterval(tick, TICK_MS);
  };

  const changeDirection = (direction: Direction) => {
    if (status !== 'running') return;
    const current = runtimeRef.current;
    if (isOpposite(current.direction, direction)) return;
    runtimeRef.current = { ...current, pendingDirection: direction };
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

  const snakeKeys = new Set(snake.map(pointKey));
  const headKey = pointKey(snake[0]);
  const foodKey = pointKey(food);
  const bestScore = progress?.bestScore || progress?.score || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.title}>Змейка</Text>
          <Text style={styles.subtitle}>Управляйте движением по сетке, собирайте очки и сохраняйте лучший результат.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="trail-sign-outline" size={28} color="#fff" />
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
          <Text style={styles.statValue}>{snake.length}</Text>
          <Text style={styles.statLabel}>Длина</Text>
        </View>
      </View>

      <View style={styles.board}>
        {Array.from({ length: CELL_COUNT }, (_, index) => {
          const point = { x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) };
          const key = pointKey(point);
          const isHead = key === headKey;
          const isBody = snakeKeys.has(key);
          const isFood = key === foodKey;
          return (
            <View
              key={key}
              style={[
                styles.cell,
                isBody && styles.snakeCell,
                isHead && styles.headCell,
                isFood && styles.foodCell,
              ]}
            />
          );
        })}
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Прогресс сессии</Text>
          <Text style={styles.progressValue}>{sessionProgress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${sessionProgress}%` }]} />
        </View>
      </View>

      {status === 'running' ? (
        <View style={styles.controlPanel}>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => changeDirection('up')} activeOpacity={0.85}>
            <Ionicons name="chevron-up" size={27} color="#fff" />
          </TouchableOpacity>
          <View style={styles.middleControls}>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => changeDirection('left')} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={27} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => finishGame('manual')} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={colors.text} /> : <Ionicons name="save-outline" size={20} color={colors.text} />}
              <Text style={styles.saveText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => changeDirection('right')} activeOpacity={0.85}>
              <Ionicons name="chevron-forward" size={27} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => changeDirection('down')} activeOpacity={0.85}>
            <Ionicons name="chevron-down" size={27} color="#fff" />
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
  board: { aspectRatio: 1, borderRadius: 8, backgroundColor: '#242424', padding: 6, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '8.333333%', aspectRatio: 1, borderWidth: 1, borderColor: '#303030', backgroundColor: '#3a3a3a' },
  snakeCell: { backgroundColor: '#f5a400' },
  headCell: { backgroundColor: colors.danger },
  foodCell: { backgroundColor: colors.surface, borderColor: colors.danger },
  progressBlock: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  progressValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.danger },
  controlPanel: { alignItems: 'center', gap: 8 },
  middleControls: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  arrowBtn: { width: 62, height: 50, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { width: 122, height: 50, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
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
