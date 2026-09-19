import React, { useCallback, useMemo, useRef, useState } from 'react';
import { showToast } from '../store/toastStore';
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
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import {
  GameProgress,
  getGameLeaderboard,
  getGameProgress,
  saveGameProgress,
} from '../api/kidsGames';

const GAME_ID = 'svg-puzzle-gallery';
const GAME_NAME = 'Пазлы';
const GRID_SIZE = 3;
const TILE_COUNT = GRID_SIZE * GRID_SIZE;
const SOLVED_BOARD = [1, 2, 3, 4, 5, 6, 7, 8, 0];

type GameStatus = 'idle' | 'running' | 'finished';
type Board = number[];

type SaveSnapshot = {
  board: Board;
  moves: number;
  score: number;
  startedAt: number;
  won: boolean;
};

const TILE_META: Record<number, { icon: string; label: string; color: string }> = {
  1: { icon: 'car-sport-outline', label: 'Кузов', color: colors.danger },
  2: { icon: 'speedometer-outline', label: 'Скорость', color: colors.text },
  3: { icon: 'key-outline', label: 'Ключ', color: '#f5a400' },
  4: { icon: 'construct-outline', label: 'Сервис', color: colors.textMuted },
  5: { icon: 'map-outline', label: 'Маршрут', color: colors.danger },
  6: { icon: 'shield-checkmark-outline', label: 'Защита', color: colors.text },
  7: { icon: 'flash-outline', label: 'Тюнинг', color: '#f5a400' },
  8: { icon: 'flag-outline', label: 'Финиш', color: colors.textMuted },
};

const getRow = (index: number) => Math.floor(index / GRID_SIZE);
const getCol = (index: number) => index % GRID_SIZE;
const isSolved = (board: Board) => board.every((value, index) => value === SOLVED_BOARD[index]);

const getMovableIndexes = (emptyIndex: number) => {
  const row = getRow(emptyIndex);
  const col = getCol(emptyIndex);
  const options: number[] = [];
  if (row > 0) options.push(emptyIndex - GRID_SIZE);
  if (row < GRID_SIZE - 1) options.push(emptyIndex + GRID_SIZE);
  if (col > 0) options.push(emptyIndex - 1);
  if (col < GRID_SIZE - 1) options.push(emptyIndex + 1);
  return options;
};

const swapTiles = (board: Board, first: number, second: number) => {
  const next = [...board];
  [next[first], next[second]] = [next[second], next[first]];
  return next;
};

const createBoard = () => {
  let board = [...SOLVED_BOARD];
  let previousEmpty = -1;

  for (let move = 0; move < 90; move += 1) {
    const emptyIndex = board.indexOf(0);
    const options = getMovableIndexes(emptyIndex).filter((index) => index !== previousEmpty);
    const candidates = options.length ? options : getMovableIndexes(emptyIndex);
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    previousEmpty = emptyIndex;
    board = swapTiles(board, emptyIndex, picked);
  }

  return isSolved(board) ? swapTiles(board, 7, 8) : board;
};

const correctTiles = (board: Board) => board.filter((value, index) => value !== 0 && value === SOLVED_BOARD[index]).length;
const progressFromBoard = (board: Board) => Math.round((correctTiles(board) / 8) * 100);
const scoreFromBoard = (board: Board, moves: number, won: boolean) =>
  Math.max(0, correctTiles(board) * 90 + (won ? 500 : 0) - moves * 4);

const canMoveTile = (board: Board, tileIndex: number) => {
  const emptyIndex = board.indexOf(0);
  return getMovableIndexes(emptyIndex).includes(tileIndex);
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

export default function PuzzleGameScreen() {
  const savingRef = useRef(false);
  const [board, setBoard] = useState<Board>(SOLVED_BOARD);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
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
      showToast(e.response?.data?.message || 'Не удалось загрузить прогресс игры');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const sessionProgress = useMemo(() => progressFromBoard(board), [board]);
  const level = useMemo(() => Math.max(1, correctTiles(board)), [board]);

  const buildAchievements = (snapshot: SaveSnapshot) => {
    const achievements: string[] = [];
    if (correctTiles(snapshot.board) >= 4) achievements.push('Половина картинки');
    if (snapshot.won) achievements.push('Пазл собран');
    if (snapshot.won && snapshot.moves <= 40) achievements.push('Быстрая сборка');
    if (snapshot.score >= 900) achievements.push('Точный порядок');
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
        level: Math.max(1, correctTiles(snapshot.board)),
        progress: progressFromBoard(snapshot.board),
        playTime,
        achievements: buildAchievements(snapshot),
        gameData: {
          reason,
          moves: snapshot.moves,
          won: snapshot.won,
          board: snapshot.board.join(','),
        },
      });
      setProgress(saved);
      setLeaderboard(await getGameLeaderboard(GAME_ID, 10));
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось сохранить результат');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  const finishGame = useCallback((won: boolean, nextBoard = board, nextMoves = moves, nextScore = score) => {
    setStatus('finished');
    void persistResult(won ? 'finish' : 'manual', {
      board: nextBoard,
      moves: nextMoves,
      score: nextScore,
      startedAt,
      won,
    });
  }, [board, moves, persistResult, score, startedAt]);

  const startGame = () => {
    const nextBoard = createBoard();
    const nextScore = scoreFromBoard(nextBoard, 0, false);
    setBoard(nextBoard);
    setMoves(0);
    setScore(nextScore);
    setStartedAt(Date.now());
    setStatus('running');
  };

  const moveTile = (tileIndex: number) => {
    if (status !== 'running' || !canMoveTile(board, tileIndex)) return;

    const emptyIndex = board.indexOf(0);
    const nextBoard = swapTiles(board, emptyIndex, tileIndex);
    const nextMoves = moves + 1;
    const won = isSolved(nextBoard);
    const nextScore = scoreFromBoard(nextBoard, nextMoves, won);
    setBoard(nextBoard);
    setMoves(nextMoves);
    setScore(nextScore);

    if (won) {
      finishGame(true, nextBoard, nextMoves, nextScore);
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

  const bestScore = progress?.bestScore || progress?.score || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.title}>Пазлы</Text>
          <Text style={styles.subtitle}>Соберите авто-картинку из плиток: передвигайте соседние элементы в пустую ячейку.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="extension-puzzle-outline" size={28} color={colors.accent} />
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
          <Text style={styles.statValue}>{moves}</Text>
          <Text style={styles.statLabel}>Ходы</Text>
        </View>
      </View>

      <View style={styles.board}>
        {board.map((tile, index) => {
          const meta = tile ? TILE_META[tile] : null;
          const movable = status === 'running' && canMoveTile(board, index);
          const solved = tile !== 0 && tile === SOLVED_BOARD[index];
          return (
            <TouchableOpacity
              key={`${index}-${tile}`}
              style={[
                styles.tile,
                tile ? styles.tileFilled : styles.tileBlank,
                movable && styles.tileMovable,
                solved && styles.tileSolved,
              ]}
              activeOpacity={tile ? 0.82 : 1}
              onPress={() => moveTile(index)}
            >
              {meta ? (
                <>
                  <View style={[styles.tileIcon, { backgroundColor: meta.color }]}>
                    <Ionicons name={meta.icon as any} size={24} color="#fff" />
                  </View>
                  <Text style={styles.tileNumber}>{tile}</Text>
                  <Text style={styles.tileLabel} numberOfLines={1}>{meta.label}</Text>
                </>
              ) : (
                <Ionicons name="scan-outline" size={28} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Правильные плитки</Text>
          <Text style={styles.progressValue}>{sessionProgress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${sessionProgress}%` }]} />
        </View>
      </View>

      {status === 'running' ? (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.shuffleBtn} onPress={startGame} activeOpacity={0.85}>
            <Ionicons name="shuffle-outline" size={20} color={colors.text} />
            <Text style={styles.shuffleText}>Заново</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={() => finishGame(false)} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color={colors.text} /> : <Ionicons name="save-outline" size={20} color={colors.text} />}
            <Text style={styles.saveText}>Сохранить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.startBtn} onPress={startGame} activeOpacity={0.85}>
          <Ionicons name="play-circle-outline" size={22} color={colors.onAccent} />
          <Text style={styles.startText}>{status === 'finished' ? 'Новый пазл' : 'Старт'}</Text>
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
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 5, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 12, backgroundColor: colors.surfaceAlt, padding: 12 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  board: { aspectRatio: 1, borderRadius: 8, backgroundColor: '#242424', padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.8%', height: '31.8%', borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 6 },
  tileFilled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tileBlank: { backgroundColor: '#333', borderWidth: 1, borderColor: '#4a4a4a' },
  tileMovable: { borderColor: colors.danger, borderWidth: 2 },
  tileSolved: { backgroundColor: 'rgba(246,178,61,0.14)' },
  tileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileNumber: { marginTop: 5, color: colors.text, fontSize: 19, fontWeight: '900' },
  tileLabel: { marginTop: 1, color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  progressBlock: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  progressValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  controls: { flexDirection: 'row', gap: 8 },
  shuffleBtn: { flex: 1, height: 50, borderRadius: 8, backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  shuffleText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  saveBtn: { flex: 1, height: 50, borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  startBtn: { height: 50, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  startText: { color: colors.onAccent, fontSize: 16, fontWeight: '900' },
  card: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14, gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  savedGrid: { flexDirection: 'row', gap: 8 },
  savedItem: { flex: 1, borderRadius: 8, backgroundColor: colors.surfaceAlt, padding: 10 },
  savedValue: { color: colors.text, fontSize: 19, fontWeight: '900' },
  savedLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  playTime: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  rankRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 8, backgroundColor: colors.bg, paddingHorizontal: 10, paddingVertical: 7 },
  rankNumber: { width: 22, color: colors.textMuted, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  rankAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  rankInitial: { color: colors.text, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  rankName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  rankScore: { color: colors.text, fontSize: 14, fontWeight: '900' },
  mutedText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
