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

const GAME_ID = 'tetris';
const GAME_NAME = 'Тетрис';
const COLS = 10;
const ROWS = 18;
const CELL_COUNT = COLS * ROWS;
const TICK_MS = 520;

type GameStatus = 'idle' | 'running' | 'finished';
type Matrix = number[][];
type Board = Array<Array<string | null>>;

type PieceTemplate = {
  key: string;
  color: string;
  matrix: Matrix;
};

type Piece = PieceTemplate & {
  x: number;
  y: number;
};

type RuntimeState = {
  board: Board;
  piece: Piece;
  nextPiece: Piece;
  score: number;
  lines: number;
  level: number;
  drops: number;
  startedAt: number;
};

const PIECES: PieceTemplate[] = [
  { key: 'I', color: '#36a3ff', matrix: [[1, 1, 1, 1]] },
  { key: 'O', color: '#f5a400', matrix: [[1, 1], [1, 1]] },
  { key: 'T', color: '#a855f7', matrix: [[0, 1, 0], [1, 1, 1]] },
  { key: 'S', color: '#21a856', matrix: [[0, 1, 1], [1, 1, 0]] },
  { key: 'Z', color: colors.danger, matrix: [[1, 1, 0], [0, 1, 1]] },
  { key: 'J', color: '#1d4ed8', matrix: [[1, 0, 0], [1, 1, 1]] },
  { key: 'L', color: '#ff7a1a', matrix: [[0, 0, 1], [1, 1, 1]] },
];

const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));

const cloneMatrix = (matrix: Matrix): Matrix => matrix.map((row) => [...row]);

const randomPiece = (): Piece => {
  const template = PIECES[Math.floor(Math.random() * PIECES.length)];
  const matrix = cloneMatrix(template.matrix);
  return {
    ...template,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };
};

const rotateMatrix = (matrix: Matrix): Matrix => matrix[0].map((_, colIndex) =>
  matrix.map((row) => row[colIndex]).reverse(),
);

const canPlace = (board: Board, piece: Piece) => {
  for (let row = 0; row < piece.matrix.length; row += 1) {
    for (let col = 0; col < piece.matrix[row].length; col += 1) {
      if (!piece.matrix[row][col]) continue;

      const x = piece.x + col;
      const y = piece.y + row;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && board[y][x]) return false;
    }
  }
  return true;
};

const mergePiece = (board: Board, piece: Piece): Board => {
  const next = board.map((row) => [...row]);
  for (let row = 0; row < piece.matrix.length; row += 1) {
    for (let col = 0; col < piece.matrix[row].length; col += 1) {
      if (!piece.matrix[row][col]) continue;
      const x = piece.x + col;
      const y = piece.y + row;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        next[y][x] = piece.color;
      }
    }
  }
  return next;
};

const clearLines = (board: Board) => {
  const kept = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - kept.length;
  const newRows = Array.from({ length: cleared }, () => Array.from({ length: COLS }, () => null));
  return {
    board: [...newRows, ...kept],
    cleared,
  };
};

const lineScore = (lines: number, level: number) => {
  const scores = [0, 100, 300, 500, 800];
  return (scores[lines] || 0) * level;
};

const createRuntime = (): RuntimeState => ({
  board: emptyBoard(),
  piece: randomPiece(),
  nextPiece: randomPiece(),
  score: 0,
  lines: 0,
  level: 1,
  drops: 0,
  startedAt: Date.now(),
});

const withSpawnPosition = (piece: Piece): Piece => ({
  ...piece,
  matrix: cloneMatrix(piece.matrix),
  x: Math.floor((COLS - piece.matrix[0].length) / 2),
  y: 0,
});

const getDisplayBoard = (board: Board, piece: Piece): Board => {
  const next = board.map((row) => [...row]);
  for (let row = 0; row < piece.matrix.length; row += 1) {
    for (let col = 0; col < piece.matrix[row].length; col += 1) {
      if (!piece.matrix[row][col]) continue;
      const x = piece.x + col;
      const y = piece.y + row;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = piece.color;
    }
  }
  return next;
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

export default function TetrisGameScreen() {
  const runtimeRef = useRef<RuntimeState>(createRuntime());
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingRef = useRef(false);

  const [status, setStatus] = useState<GameStatus>('idle');
  const [board, setBoard] = useState<Board>(runtimeRef.current.board);
  const [piece, setPiece] = useState<Piece>(runtimeRef.current.piece);
  const [nextPiece, setNextPiece] = useState<Piece>(runtimeRef.current.nextPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
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
    setBoard(next.board);
    setPiece(next.piece);
    setNextPiece(next.nextPiece);
    setScore(next.score);
    setLines(next.lines);
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
      Alert.alert('Тетрис', e.response?.data?.message || 'Не удалось загрузить прогресс игры');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    return () => clearTimers();
  }, [clearTimers, loadData]));

  const displayBoard = useMemo(() => getDisplayBoard(board, piece).flat(), [board, piece]);
  const sessionProgress = useMemo(() => Math.min(100, lines * 5), [lines]);

  const buildAchievements = (current: RuntimeState) => {
    const achievements: string[] = [];
    if (current.lines >= 1) achievements.push('Первая линия');
    if (current.lines >= 10) achievements.push('Десять линий');
    if (current.score >= 1000) achievements.push('Тысяча очков');
    if (current.level >= 4) achievements.push('Быстрый стакан');
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
        progress: Math.min(100, current.lines * 5),
        playTime,
        achievements: buildAchievements(current),
        gameData: {
          reason,
          lines: current.lines,
          drops: current.drops,
          nextPiece: current.nextPiece.key,
        },
      });
      setProgress(saved);
      setLeaderboard(await getGameLeaderboard(GAME_ID, 10));
    } catch (e: any) {
      Alert.alert('Тетрис', e.response?.data?.message || 'Не удалось сохранить результат');
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

  const lockPiece = useCallback((current: RuntimeState) => {
    const merged = mergePiece(current.board, current.piece);
    const cleared = clearLines(merged);
    const nextLines = current.lines + cleared.cleared;
    const nextLevel = Math.min(12, Math.floor(nextLines / 4) + 1);
    const spawned = withSpawnPosition(current.nextPiece);
    const freshNext = randomPiece();
    const nextScore = current.score + 12 + lineScore(cleared.cleared, current.level);

    const next: RuntimeState = {
      ...current,
      board: cleared.board,
      piece: spawned,
      nextPiece: freshNext,
      score: nextScore,
      lines: nextLines,
      level: nextLevel,
      drops: current.drops + 1,
    };

    if (!canPlace(cleared.board, spawned)) {
      syncRuntime({ ...next, piece: spawned });
      finishGame('finish');
      return;
    }

    syncRuntime(next);
  }, [finishGame, syncRuntime]);

  const tick = useCallback(() => {
    const current = runtimeRef.current;
    const moved = { ...current.piece, y: current.piece.y + 1 };
    if (canPlace(current.board, moved)) {
      syncRuntime({ ...current, piece: moved, score: current.score + 1 });
      return;
    }
    lockPiece(current);
  }, [lockPiece, syncRuntime]);

  const startGame = () => {
    clearTimers();
    const next = createRuntime();
    syncRuntime(next);
    setStatus('running');
    loopRef.current = setInterval(tick, TICK_MS);
  };

  const movePiece = (delta: -1 | 1) => {
    if (status !== 'running') return;
    const current = runtimeRef.current;
    const moved = { ...current.piece, x: current.piece.x + delta };
    if (canPlace(current.board, moved)) syncRuntime({ ...current, piece: moved });
  };

  const rotatePiece = () => {
    if (status !== 'running') return;
    const current = runtimeRef.current;
    const rotated = { ...current.piece, matrix: rotateMatrix(current.piece.matrix) };
    if (canPlace(current.board, rotated)) syncRuntime({ ...current, piece: rotated });
  };

  const softDrop = () => {
    if (status !== 'running') return;
    tick();
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
          <Text style={styles.title}>Тетрис</Text>
          <Text style={styles.subtitle}>Собирайте линии, повышайте уровень и сохраняйте лучший результат.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="grid-outline" size={28} color="#fff" />
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
          <Text style={styles.statValue}>{lines}</Text>
          <Text style={styles.statLabel}>Линии</Text>
        </View>
      </View>

      <View style={styles.gameRow}>
        <View style={styles.board}>
          {displayBoard.map((cell, index) => (
            <View
              key={`${index}-${cell || 'empty'}`}
              style={[
                styles.cell,
                cell ? { backgroundColor: cell } : styles.cellEmpty,
              ]}
            />
          ))}
        </View>
        <View style={styles.sidePanel}>
          <Text style={styles.sideLabel}>Следующая</Text>
          <View style={styles.preview}>
            {Array.from({ length: 16 }, (_, index) => {
              const row = Math.floor(index / 4);
              const col = index % 4;
              const filled = Boolean(nextPiece.matrix[row]?.[col]);
              return (
                <View
                  key={`preview-${index}`}
                  style={[
                    styles.previewCell,
                    filled ? { backgroundColor: nextPiece.color } : styles.previewEmpty,
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.levelBox}>
            <Text style={styles.levelValue}>{level}</Text>
            <Text style={styles.levelLabel}>уровень</Text>
          </View>
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
        <View style={styles.controlPanel}>
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => movePiece(-1)} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={27} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.rotateBtn} onPress={rotatePiece} activeOpacity={0.85}>
              <Ionicons name="refresh" size={23} color="#fff" />
              <Text style={styles.rotateText}>Поворот</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.arrowBtn} onPress={() => movePiece(1)} activeOpacity={0.85}>
              <Ionicons name="chevron-forward" size={27} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.downBtn} onPress={softDrop} activeOpacity={0.85}>
              <Ionicons name="chevron-down" size={23} color={colors.text} />
              <Text style={styles.downText}>Вниз</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => finishGame('manual')} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={colors.text} /> : <Ionicons name="save-outline" size={20} color={colors.text} />}
              <Text style={styles.saveText}>Сохранить</Text>
            </TouchableOpacity>
          </View>
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
  gameRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  board: { flex: 1, aspectRatio: COLS / ROWS, borderRadius: 8, overflow: 'hidden', backgroundColor: '#242424', flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: '#1a1a1a' },
  cell: { width: '10%', aspectRatio: 1, borderWidth: 1, borderColor: '#303030' },
  cellEmpty: { backgroundColor: '#3a3a3a' },
  sidePanel: { width: 98, gap: 10 },
  sideLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  preview: { width: 98, height: 98, borderRadius: 8, backgroundColor: '#242424', borderWidth: 1, borderColor: '#1a1a1a', flexDirection: 'row', flexWrap: 'wrap', padding: 6 },
  previewCell: { width: '25%', aspectRatio: 1, borderWidth: 1, borderColor: '#303030' },
  previewEmpty: { backgroundColor: '#3a3a3a' },
  levelBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 10 },
  levelValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  levelLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  progressBlock: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  progressValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#ededed', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.danger },
  controlPanel: { gap: 8 },
  controlRow: { flexDirection: 'row', gap: 8 },
  arrowBtn: { flex: 1, height: 50, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  rotateBtn: { flex: 1.45, height: 50, borderRadius: 8, backgroundColor: colors.surfaceHi, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rotateText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  downBtn: { flex: 1, height: 50, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  downText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  saveBtn: { flex: 1, height: 50, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  startBtn: { height: 50, borderRadius: 8, backgroundColor: colors.surfaceHi, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  startText: { color: '#fff', fontSize: 16, fontWeight: '900' },
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
