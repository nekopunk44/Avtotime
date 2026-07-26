import React, { useCallback, useMemo, useState } from 'react';
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

const GAME_ID = 'game-2048';
const GAME_NAME = '2048';
const BOARD_SIZE = 4;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;

type GameStatus = 'idle' | 'running' | 'finished';
type Direction = 'up' | 'right' | 'down' | 'left';
type Board = number[];

const emptyBoard = (): Board => Array.from({ length: BOARD_CELLS }, () => 0);

const sameBoard = (a: Board, b: Board) => a.every((value, index) => value === b[index]);

const maxTile = (board: Board) => Math.max(0, ...board);

const progressFromBoard = (board: Board) => {
  const max = maxTile(board);
  if (max < 2) return 0;
  return Math.min(100, Math.round((Math.log2(max) / 11) * 100));
};

const addRandomTile = (board: Board) => {
  const empty = board
    .map((value, index) => (value === 0 ? index : -1))
    .filter((index) => index >= 0);

  if (!empty.length) return board;

  const next = [...board];
  const index = empty[Math.floor(Math.random() * empty.length)];
  next[index] = Math.random() < 0.9 ? 2 : 4;
  return next;
};

const createBoard = () => addRandomTile(addRandomTile(emptyBoard()));

const getLine = (board: Board, lineIndex: number, direction: Direction) => {
  if (direction === 'left' || direction === 'right') {
    const row = board.slice(lineIndex * BOARD_SIZE, lineIndex * BOARD_SIZE + BOARD_SIZE);
    return direction === 'right' ? row.reverse() : row;
  }

  const column = Array.from({ length: BOARD_SIZE }, (_, rowIndex) => board[rowIndex * BOARD_SIZE + lineIndex]);
  return direction === 'down' ? column.reverse() : column;
};

const setLine = (board: Board, lineIndex: number, line: number[], direction: Direction) => {
  const values = direction === 'right' || direction === 'down' ? [...line].reverse() : line;
  const next = [...board];

  if (direction === 'left' || direction === 'right') {
    values.forEach((value, colIndex) => {
      next[lineIndex * BOARD_SIZE + colIndex] = value;
    });
    return next;
  }

  values.forEach((value, rowIndex) => {
    next[rowIndex * BOARD_SIZE + lineIndex] = value;
  });
  return next;
};

const mergeLine = (line: number[]) => {
  const compact = line.filter(Boolean);
  const merged: number[] = [];
  let gained = 0;

  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const value = compact[index] * 2;
      merged.push(value);
      gained += value;
      index += 1;
    } else {
      merged.push(compact[index]);
    }
  }

  while (merged.length < BOARD_SIZE) merged.push(0);
  return { line: merged, gained };
};

const moveBoard = (board: Board, direction: Direction) => {
  let next = [...board];
  let gained = 0;

  for (let lineIndex = 0; lineIndex < BOARD_SIZE; lineIndex += 1) {
    const line = getLine(board, lineIndex, direction);
    const result = mergeLine(line);
    gained += result.gained;
    next = setLine(next, lineIndex, result.line, direction);
  }

  return {
    board: sameBoard(board, next) ? board : addRandomTile(next),
    gained,
    changed: !sameBoard(board, next),
  };
};

const hasMoves = (board: Board) => {
  if (board.some((value) => value === 0)) return true;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const value = board[row * BOARD_SIZE + col];
      const right = col < BOARD_SIZE - 1 ? board[row * BOARD_SIZE + col + 1] : null;
      const down = row < BOARD_SIZE - 1 ? board[(row + 1) * BOARD_SIZE + col] : null;
      if (value === right || value === down) return true;
    }
  }

  return false;
};

const getTileStyle = (value: number) => {
  if (!value) return styles.tileEmpty;
  if (value <= 4) return styles.tileLow;
  if (value <= 32) return styles.tileWarm;
  if (value <= 256) return styles.tileStrong;
  return styles.tileHot;
};

const getTileTextStyle = (value: number) => (value <= 4 ? styles.tileTextDark : styles.tileTextLight);

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

export default function Game2048Screen() {
  const [board, setBoard] = useState<Board>(emptyBoard());
  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
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
      Alert.alert('2048', e.response?.data?.message || 'Не удалось загрузить прогресс игры');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const level = useMemo(() => Math.max(1, Math.floor(Math.log2(Math.max(2, maxTile(board)))) - 1), [board]);
  const sessionProgress = useMemo(() => progressFromBoard(board), [board]);

  const buildAchievements = (nextBoard: Board, nextMoves: number) => {
    const max = maxTile(nextBoard);
    const achievements: string[] = [];
    if (max >= 128) achievements.push('Плитка 128');
    if (max >= 512) achievements.push('Плитка 512');
    if (max >= 2048) achievements.push('2048 собрано');
    if (nextMoves >= 50) achievements.push('Длинная партия');
    return achievements;
  };

  const persistResult = useCallback(async (
    reason: 'manual' | 'finish',
    nextStatus: GameStatus = 'finished',
    snapshot?: { board: Board; score: number; moves: number },
  ) => {
    if (!startedAt || saving) return;

    const saveBoard = snapshot?.board ?? board;
    const saveScore = snapshot?.score ?? score;
    const saveMoves = snapshot?.moves ?? moves;
    const saveLevel = Math.max(1, Math.floor(Math.log2(Math.max(2, maxTile(saveBoard)))) - 1);
    const saveProgress = progressFromBoard(saveBoard);

    setSaving(true);
    try {
      const playTime = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const saved = await saveGameProgress(GAME_ID, {
        gameName: GAME_NAME,
        score: saveScore,
        level: saveLevel,
        progress: saveProgress,
        playTime,
        achievements: buildAchievements(saveBoard, saveMoves),
        gameData: {
          reason,
          maxTile: maxTile(saveBoard),
          moves: saveMoves,
        },
      });
      setProgress(saved);
      setLeaderboard(await getGameLeaderboard(GAME_ID, 10));
      setStatus(nextStatus);
    } catch (e: any) {
      Alert.alert('2048', e.response?.data?.message || 'Не удалось сохранить результат');
    } finally {
      setSaving(false);
    }
  }, [board, moves, saving, score, startedAt]);

  const startGame = () => {
    setBoard(createBoard());
    setScore(0);
    setMoves(0);
    setStartedAt(Date.now());
    setStatus('running');
  };

  const move = (direction: Direction) => {
    if (status !== 'running') return;

    const result = moveBoard(board, direction);
    if (!result.changed) return;

    const nextScore = score + result.gained;
    const nextMoves = moves + 1;
    setBoard(result.board);
    setScore(nextScore);
    setMoves(nextMoves);

    if (!hasMoves(result.board)) {
      setTimeout(() => {
        void persistResult('finish', 'finished', {
          board: result.board,
          score: nextScore,
          moves: nextMoves,
        });
      }, 120);
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
          <Text style={styles.title}>2048</Text>
          <Text style={styles.subtitle}>Сдвигайте плитки, собирайте большие числа и сохраняйте рекорд в профиле.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="apps-outline" size={28} color="#fff" />
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
          <Text style={styles.statValue}>{maxTile(board) || 0}</Text>
          <Text style={styles.statLabel}>Плитка</Text>
        </View>
      </View>

      <View style={styles.board}>
        {board.map((value, index) => (
          <View key={`${index}-${value}`} style={[styles.tile, getTileStyle(value)]}>
            {value ? <Text style={[styles.tileText, getTileTextStyle(value)]}>{value}</Text> : null}
          </View>
        ))}
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Прогресс до 2048</Text>
          <Text style={styles.progressValue}>{sessionProgress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${sessionProgress}%` }]} />
        </View>
      </View>

      {status === 'running' ? (
        <View style={styles.controlPanel}>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => move('up')} activeOpacity={0.85}>
            <Ionicons name="chevron-up" size={27} color="#fff" />
          </TouchableOpacity>
          <View style={styles.middleControls}>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => move('left')} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={27} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => persistResult('manual')} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={colors.text} /> : <Ionicons name="save-outline" size={20} color={colors.text} />}
              <Text style={styles.saveText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => move('right')} activeOpacity={0.85}>
              <Ionicons name="chevron-forward" size={27} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => move('down')} activeOpacity={0.85}>
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
  board: { aspectRatio: 1, borderRadius: 8, backgroundColor: '#242424', padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '23.3%', height: '23.3%', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tileEmpty: { backgroundColor: '#3a3a3a' },
  tileLow: { backgroundColor: colors.surfaceAlt },
  tileWarm: { backgroundColor: '#f5a400' },
  tileStrong: { backgroundColor: colors.danger },
  tileHot: { backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: '#f5a400' },
  tileText: { fontSize: 24, fontWeight: '900' },
  tileTextDark: { color: colors.text },
  tileTextLight: { color: '#fff' },
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
