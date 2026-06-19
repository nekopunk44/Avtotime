import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Pause } from 'lucide-react';

interface TetrisGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
}

type PieceKey = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type Cell = PieceKey | null;
type Board = Cell[][];

const COLS = 10;
const ROWS = 20;

const PIECES: Record<PieceKey, { color: string; rotations: number[][][] }> = {
  I: { color: '#22D3EE', rotations: [
    [[1,0],[1,1],[1,2],[1,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,1],[1,1],[2,1],[3,1]],
  ]},
  O: { color: '#FACC15', rotations: [
    [[0,1],[0,2],[1,1],[1,2]],
  ]},
  T: { color: '#A855F7', rotations: [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ]},
  S: { color: '#22C55E', rotations: [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,1],[1,2],[2,0],[2,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ]},
  Z: { color: '#EF4444', rotations: [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,2],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ]},
  J: { color: '#3B82F6', rotations: [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ]},
  L: { color: '#FB923C', rotations: [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[1,2],[2,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ]},
};

const PIECE_KEYS: PieceKey[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

interface ActivePiece {
  key: PieceKey;
  rotation: number;
  x: number;
  y: number;
}

const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null) as Cell[]);

const shuffleBag = (): PieceKey[] => {
  const bag = [...PIECE_KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};

const spawnPiece = (key: PieceKey): ActivePiece => ({
  key,
  rotation: 0,
  x: key === 'O' ? 4 : 3,
  y: -1,
});

const cellsOf = (p: ActivePiece): { r: number; c: number }[] => {
  const def = PIECES[p.key];
  const rot = def.rotations[p.rotation % def.rotations.length];
  return rot.map(([r, c]) => ({ r: p.y + r, c: p.x + c }));
};

const fits = (board: Board, p: ActivePiece): boolean => {
  for (const { r, c } of cellsOf(p)) {
    if (c < 0 || c >= COLS || r >= ROWS) return false;
    if (r < 0) continue;
    if (board[r][c]) return false;
  }
  return true;
};

const merge = (board: Board, p: ActivePiece): Board => {
  const next = board.map((row) => row.slice());
  for (const { r, c } of cellsOf(p)) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) next[r][c] = p.key;
  }
  return next;
};

const clearLines = (board: Board): { board: Board; cleared: number } => {
  const remaining = board.filter((row) => row.some((c) => !c));
  const cleared = ROWS - remaining.length;
  const empty = Array.from({ length: cleared }, () => Array(COLS).fill(null) as Cell[]);
  return { board: [...empty, ...remaining], cleared };
};

const KICKS: [number, number][] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
const LINE_SCORES = [0, 40, 100, 300, 1200];

const drawBevelBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  const inset = Math.max(2, Math.floor(size * 0.18));
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size - inset, y + inset);
  ctx.lineTo(x + inset, y + inset);
  ctx.lineTo(x + inset, y + size - inset);
  ctx.lineTo(x, y + size);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x + inset, y + size - inset);
  ctx.lineTo(x + size - inset, y + size - inset);
  ctx.lineTo(x + size - inset, y + inset);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + inset + 1, y + inset + 1, size - inset * 2 - 2, 2);
};

const drawGhostBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) => {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
};

export const TetrisGame: React.FC<TetrisGameProps> = ({ onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);

  const boardRef = useRef<Board>(emptyBoard());
  const activeRef = useRef<ActivePiece | null>(null);
  const bagRef = useRef<PieceKey[]>([]);
  const dropAccRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<'idle' | 'playing' | 'over' | 'paused'>('idle');

  const [phase, setPhase] = useState<'idle' | 'playing' | 'over' | 'paused'>('idle');
  const [nextKey, setNextKey] = useState<PieceKey>(PIECE_KEYS[0]);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [bestScore, setBestScore] = useState<number>(() => {
    try { return Number(localStorage.getItem('tetris-best') || 0) || 0; } catch { return 0; }
  });
  const [cellSize, setCellSize] = useState(24);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const tickInterval = useMemo(() => Math.max(90, 800 - (level - 1) * 65), [level]);

  const drawNextFromBag = useCallback((): PieceKey => {
    if (bagRef.current.length === 0) bagRef.current = shuffleBag();
    return bagRef.current.shift()!;
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = COLS * cellSize;
    const cssH = ROWS * cellSize;
    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const grad = ctx.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize + 0.5, 0);
      ctx.lineTo(c * cellSize + 0.5, cssH);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellSize + 0.5);
      ctx.lineTo(cssW, r * cellSize + 0.5);
      ctx.stroke();
    }

    const board = boardRef.current;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (cell) drawBevelBlock(ctx, c * cellSize, r * cellSize, cellSize, PIECES[cell].color);
      }
    }

    const piece = activeRef.current;
    if (piece && phaseRef.current === 'playing') {
      let dy = 0;
      while (fits(board, { ...piece, y: piece.y + dy + 1 })) dy++;
      const ghost: ActivePiece = { ...piece, y: piece.y + dy };
      for (const { r, c } of cellsOf(ghost)) {
        if (r >= 0) drawGhostBlock(ctx, c * cellSize, r * cellSize, cellSize, PIECES[piece.key].color);
      }
      for (const { r, c } of cellsOf(piece)) {
        if (r >= 0) drawBevelBlock(ctx, c * cellSize, r * cellSize, cellSize, PIECES[piece.key].color);
      }
    }

    ctx.strokeStyle = 'rgba(99,102,241,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, cssW - 2, cssH - 2);
  }, [cellSize]);

  const renderNext = useCallback(() => {
    const canvas = nextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 18;
    const cssW = 4 * size;
    const cssH = 4 * size;
    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const def = PIECES[nextKey];
    const cells = def.rotations[0];
    const rs = cells.map(([r]) => r);
    const cs = cells.map(([, c]) => c);
    const minR = Math.min(...rs);
    const maxR = Math.max(...rs);
    const minC = Math.min(...cs);
    const maxC = Math.max(...cs);
    const offX = (cssW - (maxC - minC + 1) * size) / 2;
    const offY = (cssH - (maxR - minR + 1) * size) / 2;
    for (const [r, c] of cells) {
      drawBevelBlock(ctx, offX + (c - minC) * size, offY + (r - minR) * size, size, def.color);
    }
  }, [nextKey]);

  useEffect(() => { render(); }, [render]);
  useEffect(() => { renderNext(); }, [renderNext]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const availW = el.clientWidth - 12;
      const availH = el.clientHeight - 12;
      if (availW <= 0 || availH <= 0) return;
      const sizeW = Math.floor(availW / COLS);
      const sizeH = Math.floor(availH / ROWS);
      const next = Math.max(12, Math.min(36, Math.min(sizeW, sizeH)));
      setCellSize(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = useCallback(() => {
    bagRef.current = shuffleBag();
    const first = bagRef.current.shift()!;
    const second = bagRef.current.shift()!;
    boardRef.current = emptyBoard();
    activeRef.current = spawnPiece(first);
    setNextKey(second);
    setScore(0);
    setLines(0);
    setLevel(1);
    dropAccRef.current = 0;
    lastTimeRef.current = 0;
    setPhase('playing');
    onScore?.(0);
  }, [onScore]);

  const endGame = useCallback(() => {
    setPhase('over');
    setBestScore((prev) => {
      const final = Math.max(prev, score);
      try { localStorage.setItem('tetris-best', String(final)); } catch { /* ignore */ }
      return final;
    });
    onGameOver?.();
  }, [onGameOver, score]);

  const spawnNext = useCallback(() => {
    const incomingKey = nextKey;
    const piece = spawnPiece(incomingKey);
    if (!fits(boardRef.current, piece)) {
      activeRef.current = null;
      endGame();
      return;
    }
    activeRef.current = piece;
    setNextKey(drawNextFromBag());
  }, [nextKey, drawNextFromBag, endGame]);

  const lockPiece = useCallback(() => {
    const piece = activeRef.current;
    if (!piece) return;

    if (piece.y < 0) {
      activeRef.current = null;
      endGame();
      return;
    }

    boardRef.current = merge(boardRef.current, piece);
    const { board: cleared, cleared: count } = clearLines(boardRef.current);
    boardRef.current = cleared;

    if (count > 0) {
      setLines((prev) => {
        const next = prev + count;
        setLevel(Math.floor(next / 10) + 1);
        return next;
      });
      setScore((prev) => {
        const gain = LINE_SCORES[count] * level;
        const next = prev + gain;
        onScore?.(next);
        return next;
      });
    }

    spawnNext();
  }, [endGame, level, onScore, spawnNext]);

  const tryMove = useCallback((dx: number, dy: number): boolean => {
    const piece = activeRef.current;
    if (!piece) return false;
    const cand: ActivePiece = { ...piece, x: piece.x + dx, y: piece.y + dy };
    if (fits(boardRef.current, cand)) {
      activeRef.current = cand;
      return true;
    }
    return false;
  }, []);

  const tryRotate = useCallback(() => {
    const piece = activeRef.current;
    if (!piece) return;
    const def = PIECES[piece.key];
    const nextRot = (piece.rotation + 1) % def.rotations.length;
    for (const [dx, dy] of KICKS) {
      const cand: ActivePiece = { ...piece, rotation: nextRot, x: piece.x + dx, y: piece.y + dy };
      if (fits(boardRef.current, cand)) {
        activeRef.current = cand;
        return;
      }
    }
  }, []);

  const softDrop = useCallback(() => {
    if (tryMove(0, 1)) {
      setScore((prev) => {
        const next = prev + 1;
        onScore?.(next);
        return next;
      });
    } else {
      lockPiece();
    }
  }, [tryMove, lockPiece, onScore]);

  const hardDrop = useCallback(() => {
    const piece = activeRef.current;
    if (!piece) return;
    let dy = 0;
    while (fits(boardRef.current, { ...piece, y: piece.y + dy + 1 })) dy++;
    activeRef.current = { ...piece, y: piece.y + dy };
    setScore((prev) => {
      const next = prev + dy * 2;
      onScore?.(next);
      return next;
    });
    lockPiece();
  }, [lockPiece, onScore]);

  useEffect(() => {
    if (phase !== 'playing') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = 0;
      return;
    }
    const loop = (t: number) => {
      if (phaseRef.current !== 'playing') return;
      if (!lastTimeRef.current) lastTimeRef.current = t;
      const dt = t - lastTimeRef.current;
      lastTimeRef.current = t;
      dropAccRef.current += dt;
      while (dropAccRef.current >= tickInterval) {
        dropAccRef.current -= tickInterval;
        if (!tryMove(0, 1)) {
          lockPiece();
        }
      }
      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase, tickInterval, tryMove, lockPiece, render]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
        return;
      }
      if (phaseRef.current === 'paused') {
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          setPhase('playing');
        }
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          tryMove(-1, 0);
          render();
          break;
        case 'ArrowRight':
          e.preventDefault();
          tryMove(1, 0);
          render();
          break;
        case 'ArrowDown':
          e.preventDefault();
          softDrop();
          render();
          break;
        case 'ArrowUp':
          e.preventDefault();
          tryRotate();
          render();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          render();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setPhase('paused');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, tryMove, softDrop, tryRotate, hardDrop, render]);

  const boardWidthPx = COLS * cellSize;
  const boardHeightPx = ROWS * cellSize;

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#1E1B4B] to-[#0F172A]">
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] flex justify-center px-3 z-10 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 max-w-full justify-center">
          <Stat label="СЧЁТ" value={score.toLocaleString('ru-RU')} accent="#FACC15" />
          <Stat label="УРОВЕНЬ" value={String(level).padStart(2, '0')} accent="#A855F7" />
          <Stat label="ЛИНИИ" value={String(lines)} accent="#22C55E" />
          <NextPanel ref={nextCanvasRef} bestScore={bestScore} />
        </div>
      </div>

      <div
        ref={containerRef}
        className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+8.25rem)] bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] flex items-center justify-center px-3"
      >
        <canvas
          ref={canvasRef}
          style={{ width: boardWidthPx, height: boardHeightPx }}
          className="rounded-lg shadow-2xl shadow-indigo-900/60"
        />
      </div>

      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] flex justify-center px-4 z-10">
        {phase === 'playing' ? (
          <button
            type="button"
            onClick={() => setPhase('paused')}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md px-5 py-2.5 text-white font-bold hover:bg-white/20 transition border border-white/15"
          >
            <Pause className="w-4 h-4" /> Пауза
          </button>
        ) : null}
      </div>

      {phase === 'idle' ? (
        <Overlay>
          <h3 className="text-white text-3xl font-extrabold mb-2 tracking-wider">ТЕТРИС</h3>
          <p className="text-white/70 text-sm mb-6 max-w-xs">Собирай линии, чтобы их очистить. Каждые 10 линий — новый уровень и скорость.</p>
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 px-8 py-3.5 text-white font-extrabold text-lg hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-purple-900/40"
          >
            <Play className="w-5 h-5" fill="currentColor" /> НАЧАТЬ
          </button>
          <div className="mt-6 text-white/55 text-xs leading-relaxed text-center max-w-[260px]">
            ← → — двигать &nbsp;·&nbsp; ↑ — вращать<br />
            ↓ — ускорить &nbsp;·&nbsp; SPACE — сброс<br />
            На мобильном — свайпы.
          </div>
        </Overlay>
      ) : phase === 'paused' ? (
        <Overlay>
          <h3 className="text-white text-2xl font-extrabold mb-4">ПАУЗА</h3>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 px-7 py-3 text-white font-bold hover:scale-[1.02] transition"
          >
            <Play className="w-5 h-5" fill="currentColor" /> Продолжить
          </button>
        </Overlay>
      ) : phase === 'over' ? (
        <Overlay>
          <div className="text-red-400 text-2xl font-extrabold mb-1">ИГРА ОКОНЧЕНА</div>
          <div className="text-white text-base mb-1">Счёт: <span className="font-extrabold text-yellow-300">{score.toLocaleString('ru-RU')}</span></div>
          <div className="text-white/60 text-sm mb-5">Линии: {lines} · Уровень: {level}</div>
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 px-7 py-3 text-white font-bold hover:scale-[1.02] transition"
          >
            <RotateCcw className="w-5 h-5" /> Заново
          </button>
        </Overlay>
      ) : null}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div className="pointer-events-none rounded-2xl bg-slate-900/70 backdrop-blur-md border border-white/10 px-3 py-1.5 text-center min-w-[68px]">
    <div className="text-[9px] font-bold tracking-[0.15em] text-white/55">{label}</div>
    <div className="font-extrabold leading-tight tabular-nums" style={{ color: accent, fontSize: 14 }}>{value}</div>
  </div>
);

const NextPanel = React.forwardRef<HTMLCanvasElement, { bestScore: number }>(({ bestScore }, ref) => (
  <div className="pointer-events-none rounded-2xl bg-slate-900/70 backdrop-blur-md border border-white/10 px-3 py-1.5 flex items-center gap-2">
    <div className="text-[9px] font-bold tracking-[0.15em] text-white/55 leading-tight">
      NEXT<br />
      <span className="text-white/55">{bestScore > 0 ? `★ ${bestScore}` : ''}</span>
    </div>
    <canvas ref={ref} style={{ width: 72, height: 72 }} />
  </div>
));
NextPanel.displayName = 'NextPanel';

const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm p-6 text-center">
    {children}
  </div>
);
