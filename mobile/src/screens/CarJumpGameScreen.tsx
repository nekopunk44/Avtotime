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

const GAME_ID = 'car-jump';
const GAME_NAME = 'Car Jump';
const TICK_MS = 70;
const JUMP_MS = 620;

type GameStatus = 'idle' | 'running' | 'finished';

type RuntimeState = {
  score: number;
  level: number;
  lives: number;
  obstacleX: number;
  jumping: boolean;
  startedAt: number;
  obstacles: number;
};

const initialRuntime: RuntimeState = {
  score: 0,
  level: 1,
  lives: 3,
  obstacleX: 108,
  jumping: false,
  startedAt: 0,
  obstacles: 0,
};

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

export default function CarJumpGameScreen() {
  const runtimeRef = useRef<RuntimeState>(initialRuntime);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jumpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [obstacleX, setObstacleX] = useState(108);
  const [jumping, setJumping] = useState(false);
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
    if (jumpRef.current) {
      clearTimeout(jumpRef.current);
      jumpRef.current = null;
    }
  }, []);

  const syncRuntime = useCallback((next: RuntimeState) => {
    runtimeRef.current = next;
    setScore(next.score);
    setLevel(next.level);
    setLives(next.lives);
    setObstacleX(next.obstacleX);
    setJumping(next.jumping);
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
      Alert.alert('Car Jump', e.response?.data?.message || 'Не удалось загрузить прогресс игры');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    return () => clearTimers();
  }, [clearTimers, loadData]));

  const sessionProgress = useMemo(() => Math.min(100, Math.floor(score / 6)), [score]);

  const buildAchievements = (current: RuntimeState) => {
    const achievements: string[] = [];
    if (current.score >= 50) achievements.push('Первый разгон');
    if (current.score >= 150) achievements.push('Прыжок без страха');
    if (current.score >= 300) achievements.push('Мастер трамплина');
    if (current.obstacles >= 12) achievements.push('Серия прыжков');
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
        progress: Math.min(100, Math.floor(current.score / 6)),
        playTime,
        achievements: buildAchievements(current),
        gameData: {
          reason,
          obstacles: current.obstacles,
          livesLeft: current.lives,
        },
      });
      setProgress(saved);
      setLeaderboard(await getGameLeaderboard(GAME_ID, 10));
    } catch (e: any) {
      Alert.alert('Car Jump', e.response?.data?.message || 'Не удалось сохранить результат');
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
    const nextLevel = Math.min(12, Math.floor(current.score / 120) + 1);
    const speed = 4.2 + nextLevel * 0.35;
    let nextObstacleX = current.obstacleX - speed;
    let nextScore = current.score;
    let nextLives = current.lives;
    let nextObstacles = current.obstacles;

    if (nextObstacleX <= 18) {
      if (current.jumping) {
        nextScore += 18 + nextLevel * 3;
        nextObstacles += 1;
      } else {
        nextLives -= 1;
      }
      nextObstacleX = 106 + Math.random() * 18;
    } else {
      nextScore += 1;
    }

    const next: RuntimeState = {
      ...current,
      score: nextScore,
      level: nextLevel,
      lives: nextLives,
      obstacleX: nextObstacleX,
      obstacles: nextObstacles,
    };

    syncRuntime(next);

    if (nextLives <= 0) {
      finishGame('finish');
    }
  }, [finishGame, syncRuntime]);

  const startGame = () => {
    clearTimers();
    const next = { ...initialRuntime, startedAt: Date.now() };
    syncRuntime(next);
    setStatus('running');
    loopRef.current = setInterval(tick, TICK_MS);
  };

  const jump = () => {
    const current = runtimeRef.current;
    if (status !== 'running' || current.jumping) return;

    syncRuntime({ ...current, jumping: true });
    if (jumpRef.current) clearTimeout(jumpRef.current);
    jumpRef.current = setTimeout(() => {
      const latest = runtimeRef.current;
      syncRuntime({ ...latest, jumping: false });
      jumpRef.current = null;
    }, JUMP_MS);
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

  const bestScore = progress?.bestScore || progress?.score || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.title}>Car Jump</Text>
          <Text style={styles.subtitle}>Прыгайте через препятствия, набирайте очки и сохраняйте результат в профиле.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="rocket-outline" size={28} color="#fff" />
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

      <View style={styles.track}>
        <View style={styles.skyLine}>
          <Text style={styles.trackMeta}>Уровень {level}</Text>
          <Text style={styles.trackMeta}>{status === 'running' ? 'Игра идет' : status === 'finished' ? 'Финиш' : 'Готово'}</Text>
        </View>
        <View style={styles.roadLine} />
        <View style={styles.roadDash} />
        <View style={[styles.obstacle, { left: `${obstacleX}%` }]}>
          <Ionicons name="alert" size={20} color="#fff" />
        </View>
        <View style={[styles.car, jumping && styles.carJumping]}>
          <Ionicons name="car-sport" size={38} color="#fff" />
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

      <View style={styles.controls}>
        {status === 'running' ? (
          <>
            <TouchableOpacity style={styles.jumpBtn} onPress={jump} activeOpacity={0.82}>
              <Ionicons name="arrow-up" size={23} color="#fff" />
              <Text style={styles.jumpText}>Прыжок</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={() => finishGame('manual')} activeOpacity={0.85}>
              <Ionicons name="stop-outline" size={20} color={colors.text} />
              <Text style={styles.stopText}>Сохранить</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={startGame} activeOpacity={0.85}>
            <Ionicons name="play-circle-outline" size={22} color="#fff" />
            <Text style={styles.startText}>{status === 'finished' ? 'Играть еще' : 'Старт'}</Text>
          </TouchableOpacity>
        )}
      </View>

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
            <Text style={styles.savedLabel}>запусков</Text>
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
  title: { color: '#fff', fontSize: 29, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#ddd', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  track: { height: 264, borderRadius: 8, overflow: 'hidden', backgroundColor: '#252525', borderWidth: 1, borderColor: '#1a1a1a' },
  skyLine: { height: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3a3a3a' },
  trackMeta: { color: '#fff', fontSize: 12, fontWeight: '900' },
  roadLine: { position: 'absolute', left: 0, right: 0, bottom: 46, height: 3, backgroundColor: colors.surfaceAlt },
  roadDash: { position: 'absolute', left: 24, right: 24, bottom: 113, height: 3, borderRadius: 2, backgroundColor: '#777' },
  car: { position: 'absolute', left: '13%', bottom: 52, width: 74, height: 54, borderRadius: 14, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  carJumping: { bottom: 120, backgroundColor: colors.surfaceHi },
  obstacle: { position: 'absolute', bottom: 52, width: 38, height: 46, borderRadius: 8, backgroundColor: '#f5a400', alignItems: 'center', justifyContent: 'center' },
  progressBlock: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  progressValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#ededed', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.danger },
  controls: { flexDirection: 'row', gap: 8 },
  startBtn: { flex: 1, height: 50, borderRadius: 8, backgroundColor: colors.surfaceHi, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  startText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  jumpBtn: { flex: 1, height: 54, borderRadius: 8, backgroundColor: colors.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  jumpText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  stopBtn: { width: 118, height: 54, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  stopText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  savingBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  savingText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  card: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  savedGrid: { flexDirection: 'row', gap: 8 },
  savedItem: { flex: 1, borderRadius: 8, backgroundColor: '#f6f6f6', padding: 10 },
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
