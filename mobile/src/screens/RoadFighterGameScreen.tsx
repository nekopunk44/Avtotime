import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DimensionValue,
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
import { useSwipe } from '../components/useSwipe';
import {
  GameProgress,
  getGameLeaderboard,
  getGameProgress,
  saveGameProgress,
} from '../api/kidsGames';

const GAME_ID = 'road-fighter';
const GAME_NAME = 'Road Fighter';
const TICK_MS = 90;
const LANES = [0, 1, 2] as const;
const LANE_LEFT: DimensionValue[] = ['15%', '42%', '69%'];

type GameStatus = 'idle' | 'running' | 'finished';
type Lane = typeof LANES[number];
type Obstacle = { id: number; lane: Lane; y: number };

type RuntimeState = {
  score: number;
  level: number;
  lives: number;
  playerLane: Lane;
  obstacles: Obstacle[];
  nextId: number;
  dodges: number;
  startedAt: number;
};

const initialRuntime: RuntimeState = {
  score: 0,
  level: 1,
  lives: 3,
  playerLane: 1,
  obstacles: [],
  nextId: 1,
  dodges: 0,
  startedAt: 0,
};

const randomLane = (): Lane => LANES[Math.floor(Math.random() * LANES.length)];

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

export default function RoadFighterGameScreen() {
  const runtimeRef = useRef<RuntimeState>(initialRuntime);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingRef = useRef(false);

  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [playerLane, setPlayerLane] = useState<Lane>(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
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
    setScore(next.score);
    setLevel(next.level);
    setLives(next.lives);
    setPlayerLane(next.playerLane);
    setObstacles(next.obstacles);
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
      Alert.alert('Road Fighter', e.response?.data?.message || 'Не удалось загрузить прогресс игры');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    return () => clearTimers();
  }, [clearTimers, loadData]));

  const sessionProgress = useMemo(() => Math.min(100, Math.floor(score / 8)), [score]);

  const buildAchievements = (current: RuntimeState) => {
    const achievements: string[] = [];
    if (current.score >= 100) achievements.push('Первый круг');
    if (current.score >= 300) achievements.push('Скоростной коридор');
    if (current.score >= 600) achievements.push('Ночная трасса');
    if (current.dodges >= 12) achievements.push('Чистая траектория');
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
        progress: Math.min(100, Math.floor(current.score / 8)),
        playTime,
        achievements: buildAchievements(current),
        gameData: {
          reason,
          dodges: current.dodges,
          livesLeft: current.lives,
          lane: current.playerLane,
        },
      });
      setProgress(saved);
      setLeaderboard(await getGameLeaderboard(GAME_ID, 10));
    } catch (e: any) {
      Alert.alert('Road Fighter', e.response?.data?.message || 'Не удалось сохранить результат');
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
    const nextLevel = Math.min(12, Math.floor(current.score / 150) + 1);
    const speed = 2.8 + nextLevel * 0.4;
    let nextScore = current.score + 1;
    let nextLives = current.lives;
    let nextDodges = current.dodges;
    let nextId = current.nextId;

    // Advance every car; resolve those that reach the player row.
    const advanced: Obstacle[] = [];
    for (const ob of current.obstacles) {
      const y = ob.y + speed;
      if (y >= 78) {
        if (ob.lane === current.playerLane) nextLives -= 1;
        else { nextScore += 20 + nextLevel * 2; nextDodges += 1; }
      } else {
        advanced.push({ ...ob, y });
      }
    }

    // Keep a level-based number of cars on the road, spaced far enough apart
    // that there's always a free lane to dodge into.
    const target = Math.min(4, 1 + Math.floor(nextLevel / 2));
    const topY = advanced.length ? Math.min(...advanced.map((o) => o.y)) : 100;
    if (advanced.length < target && topY > 26) {
      advanced.push({ id: nextId, lane: randomLane(), y: -10 });
      nextId += 1;
    }

    syncRuntime({
      ...current,
      score: nextScore,
      level: nextLevel,
      lives: nextLives,
      obstacles: advanced,
      dodges: nextDodges,
      nextId,
    });

    if (nextLives <= 0) finishGame('finish');
  }, [finishGame, syncRuntime]);

  const startGame = () => {
    clearTimers();
    const next: RuntimeState = {
      ...initialRuntime,
      obstacles: [{ id: 1, lane: randomLane(), y: -10 }],
      nextId: 2,
      startedAt: Date.now(),
    };
    syncRuntime(next);
    setStatus('running');
    loopRef.current = setInterval(tick, TICK_MS);
  };

  const move = (direction: -1 | 1) => {
    if (status !== 'running') return;
    const current = runtimeRef.current;
    const nextLane = Math.max(0, Math.min(2, current.playerLane + direction)) as Lane;
    syncRuntime({ ...current, playerLane: nextLane });
  };

  const swipe = useSwipe((dir) => {
    if (dir === 'left') move(-1);
    else if (dir === 'right') move(1);
  });

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

  const bestScore = progress?.bestScore || progress?.score || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      scrollEnabled={status !== 'running'}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="car-sport-outline" size={30} color="#fff" />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Road Fighter</Text>
          <Text style={styles.subtitle}>Меняйте полосу, обходите машины и сохраняйте лучший заезд в профиле.</Text>
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
          <Text style={styles.statValue}>{lives}</Text>
          <Text style={styles.statLabel}>Жизни</Text>
        </View>
      </View>

      <View style={styles.road} {...swipe}>
        <View style={styles.roadHeader}>
          <Text style={styles.roadMeta}>Уровень {level}</Text>
          <Text style={styles.roadMeta}>{status === 'running' ? 'Заезд' : status === 'finished' ? 'Финиш' : 'Готово'}</Text>
        </View>
        <View style={[styles.laneLine, styles.laneLineLeft]} />
        <View style={[styles.laneLine, styles.laneLineRight]} />
        {obstacles.map((ob) => (
          <View key={ob.id} style={[styles.opponentCar, { left: LANE_LEFT[ob.lane], top: `${ob.y}%` as DimensionValue }]}>
            <Ionicons name="car" size={34} color={colors.text} />
          </View>
        ))}
        <View style={[styles.playerCar, { left: LANE_LEFT[playerLane] }]}>
          <Ionicons name="car-sport" size={40} color="#fff" />
        </View>
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
        <View style={styles.controls}>
          <TouchableOpacity style={styles.moveBtn} onPress={() => move(-1)} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.stopBtn} onPress={() => finishGame('manual')} activeOpacity={0.85}>
            <Ionicons name="stop-outline" size={20} color={colors.text} />
            <Text style={styles.stopText}>Сохранить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moveBtn} onPress={() => move(1)} activeOpacity={0.85}>
            <Ionicons name="chevron-forward" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.startBtn} onPress={startGame} activeOpacity={0.85}>
          <Ionicons name="play-circle-outline" size={22} color="#fff" />
          <Text style={styles.startText}>{status === 'finished' ? 'Новый заезд' : 'Старт'}</Text>
        </TouchableOpacity>
      )}

      {saving ? (
        <View style={styles.savingBox}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.savingText}>Сохраняю результат...</Text>
        </View>
      ) : null}

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
            <Text style={styles.savedLabel}>заездов</Text>
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
          <Text style={styles.mutedText}>Рейтинг пока пуст. Первый сохраненный заезд появится здесь.</Text>
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
  heroIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#ddd', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  road: { height: 332, borderRadius: 8, overflow: 'hidden', backgroundColor: '#242424', borderWidth: 1, borderColor: '#1a1a1a' },
  roadHeader: { height: 45, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3a3a3a' },
  roadMeta: { color: '#fff', fontSize: 12, fontWeight: '900' },
  laneLine: { position: 'absolute', top: 45, bottom: 0, width: 3, borderRadius: 2, backgroundColor: '#777' },
  laneLineLeft: { left: '35%' },
  laneLineRight: { left: '64%' },
  playerCar: { position: 'absolute', bottom: 24, width: 62, height: 72, borderRadius: 16, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  opponentCar: { position: 'absolute', width: 58, height: 66, borderRadius: 14, backgroundColor: '#f5a400', alignItems: 'center', justifyContent: 'center' },
  progressBlock: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  progressValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.danger },
  controls: { flexDirection: 'row', gap: 8 },
  moveBtn: { flex: 1, height: 54, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  stopBtn: { flex: 1.15, height: 54, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  stopText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  startBtn: { height: 50, borderRadius: 8, backgroundColor: colors.surfaceHi, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  startText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  savingBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  savingText: { color: colors.text, fontSize: 13, fontWeight: '800' },
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
