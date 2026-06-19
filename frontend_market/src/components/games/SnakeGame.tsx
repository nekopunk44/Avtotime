import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Play, X } from 'lucide-react';

interface SnakeGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
  onClose?: () => void;
}

interface Position {
  x: number;
  y: number;
}

const TARGET_CELL_PX = 34;
const MIN_COLS = 12;
const MAX_COLS = 22;
const MIN_ROWS = 14;
const MAX_ROWS = 28;
const TICK_MS = 180;

const initialSnake = (cols: number, rows: number): Position[] => {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
};

export const SnakeGame: React.FC<SnakeGameProps> = ({ onScore, onGameOver, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<{ cols: number; rows: number }>({ cols: 16, rows: 22 });
  const [snake, setSnake] = useState<Position[]>(() => initialSnake(16, 22));
  const [food, setFood] = useState<Position>({ x: 4, y: 4 });
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [nextDirection, setNextDirection] = useState({ x: 1, y: 0 });
  const directionRef = useRef(direction);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number>(() => {
    try { return Number(localStorage.getItem('snake-best') || 0) || 0; } catch { return 0; }
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [foodPulse, setFoodPulse] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const cols = Math.max(MIN_COLS, Math.min(MAX_COLS, Math.round(w / TARGET_CELL_PX)));
      const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.round(h / TARGET_CELL_PX)));
      setGrid((prev) => (prev.cols === cols && prev.rows === rows ? prev : { cols, rows }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (gameStarted || gameOver) return;
    setSnake(initialSnake(grid.cols, grid.rows));
    setFood({ x: Math.min(grid.cols - 3, Math.floor(grid.cols * 0.75)), y: Math.floor(grid.rows / 2) });
  }, [grid, gameStarted, gameOver]);

  const fillRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fill();
  };

  const drawFuel = (ctx: CanvasRenderingContext2D, cellX: number, cellY: number, cell: number, pulse: number) => {
    const px = cellX * cell;
    const py = cellY * cell;
    const cx = px + cell / 2;
    const cy = py + cell / 2;

    const glowR = cell * (0.55 + pulse * 0.12);
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, glowR);
    glow.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
    glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    const inset = Math.max(3, cell * 0.18);
    const x = px + inset;
    const y = py + inset;
    const w = cell - inset * 2;
    const h = cell - inset * 2;

    ctx.fillStyle = '#ef4444';
    fillRoundedRect(ctx, x, y + 1, w, h - 1, Math.max(4, cell * 0.22));

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    fillRoundedRect(ctx, x + 2, y + 3, Math.max(4, w * 0.35), Math.max(6, h * 0.55), Math.max(3, cell * 0.16));

    const handleW = Math.max(6, w * 0.42);
    const handleH = Math.max(5, h * 0.24);
    ctx.fillStyle = 'rgba(11,18,32,0.6)';
    fillRoundedRect(ctx, x + 2, y - 1, handleW, handleH, Math.max(3, cell * 0.12));

    ctx.fillStyle = 'rgba(11,18,32,0.85)';
    fillRoundedRect(ctx, x + w - Math.max(6, w * 0.2), y + 2, Math.max(5, w * 0.18), Math.max(4, h * 0.18), Math.max(2, cell * 0.08));

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    fillRoundedRect(ctx, x + w * 0.32, y + h * 0.46, w * 0.42, h * 0.3, Math.max(3, cell * 0.1));
  };

  const drawCarHead = (
    ctx: CanvasRenderingContext2D,
    cellX: number,
    cellY: number,
    cell: number,
    dir: { x: number; y: number }
  ) => {
    const px = cellX * cell;
    const py = cellY * cell;
    const cx = px + cell / 2;
    const cy = py + cell / 2;

    let rot = 0;
    if (dir.x === 0 && dir.y === -1) rot = -Math.PI / 2;
    else if (dir.x === -1 && dir.y === 0) rot = Math.PI;
    else if (dir.x === 0 && dir.y === 1) rot = Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);

    const inset = Math.max(2, cell * 0.08);
    const w = cell - inset * 2;
    const h = cell - inset * 2;
    const x = px + inset;
    const y = py + inset;

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#60A5FA');
    grad.addColorStop(1, '#1D4ED8');
    ctx.fillStyle = grad;
    fillRoundedRect(ctx, x, y, w, h, Math.max(4, cell * 0.18));

    ctx.fillStyle = 'rgba(125, 211, 252, 0.95)';
    fillRoundedRect(ctx, x + w * 0.18, y + h * 0.12, w * 0.64, h * 0.32, Math.max(2, cell * 0.1));

    ctx.fillStyle = 'rgba(11,18,32,0.9)';
    fillRoundedRect(ctx, x + w * 0.2, y + h * 0.52, w * 0.6, h * 0.28, Math.max(2, cell * 0.1));

    ctx.fillStyle = '#0b1220';
    const wheelR = Math.max(2, cell * 0.13);
    ctx.beginPath();
    ctx.arc(x + w * 0.22, y + h - wheelR, wheelR, 0, Math.PI * 2);
    ctx.arc(x + w * 0.78, y + h - wheelR, wheelR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FACC15';
    ctx.fillRect(x + w - Math.max(2, cell * 0.08), y + h * 0.32, Math.max(2, cell * 0.08), Math.max(3, cell * 0.16));

    ctx.restore();
  };

  const generateFood = useCallback((snakeBody: Position[]): Position => {
    const positions: Position[] = [];
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        if (!snakeBody.some(s => s.x === x && s.y === y)) positions.push({ x, y });
      }
    }
    if (positions.length === 0) return { x: 0, y: 0 };
    return positions[Math.floor(Math.random() * positions.length)];
  }, [grid]);

  const startGame = () => {
    const fresh = initialSnake(grid.cols, grid.rows);
    setSnake(fresh);
    setFood(generateFood(fresh));
    setScore(0);
    setDirection({ x: 1, y: 0 });
    setNextDirection({ x: 1, y: 0 });
    directionRef.current = { x: 1, y: 0 };
    setGameStarted(true);
    setGameOver(false);
  };

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const gameLoop = setInterval(() => {
      setSnake(prevSnake => {
        setDirection(nextDirection);
        directionRef.current = nextDirection;

        const head = prevSnake[0];
        const newHead = {
          x: (head.x + nextDirection.x + grid.cols) % grid.cols,
          y: (head.y + nextDirection.y + grid.rows) % grid.rows,
        };

        if (prevSnake.some(s => s.x === newHead.x && s.y === newHead.y)) {
          setGameOver(true);
          setGameStarted(false);
          setBestScore((prev) => {
            const next = Math.max(prev, score);
            try { localStorage.setItem('snake-best', String(next)); } catch { /* ignore */ }
            return next;
          });
          onGameOver?.();
          return prevSnake;
        }

        let newSnake = [newHead, ...prevSnake];

        if (newHead.x === food.x && newHead.y === food.y) {
          const newScore = score + 10;
          setScore(newScore);
          onScore?.(newScore);
          setFood(generateFood(newSnake));
        } else {
          newSnake = newSnake.slice(0, -1);
        }

        return newSnake;
      });
    }, TICK_MS);

    return () => clearInterval(gameLoop);
  }, [gameStarted, gameOver, nextDirection, food, score, grid, generateFood, onScore, onGameOver]);

  useEffect(() => {
    if (!gameStarted) return;
    let raf = 0;
    const tick = () => {
      setFoodPulse((p) => (p + 0.04) % (Math.PI * 2));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gameStarted]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === 'arrowup' || key === 'w') {
        e.preventDefault();
        if (directionRef.current.y === 0) setNextDirection({ x: 0, y: -1 });
      } else if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
        if (directionRef.current.y === 0) setNextDirection({ x: 0, y: 1 });
      } else if (key === 'arrowleft' || key === 'a') {
        e.preventDefault();
        if (directionRef.current.x === 0) setNextDirection({ x: -1, y: 0 });
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault();
        if (directionRef.current.x === 0) setNextDirection({ x: 1, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const SWIPE_THRESHOLD_PX = 14;

    let isDown = false;
    let didSwipe = false;
    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;

    const setDirectionFromDelta = (dx: number, dy: number) => {
      const current = directionRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && current.x === 0) setNextDirection({ x: 1, y: 0 });
        if (dx < 0 && current.x === 0) setNextDirection({ x: -1, y: 0 });
        return;
      }
      if (dy > 0 && current.y === 0) setNextDirection({ x: 0, y: 1 });
      if (dy < 0 && current.y === 0) setNextDirection({ x: 0, y: -1 });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      isDown = true;
      didSwipe = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDown || didSwipe) return;
      if (activePointerId !== e.pointerId) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
      didSwipe = true;
      setDirectionFromDelta(dx, dy);
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (activePointerId !== e.pointerId) return;
      isDown = false;
      didSwipe = false;
      activePointerId = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));

    const cellPx = Math.min(cssW / grid.cols, cssH / grid.rows);
    const worldW = grid.cols * cellPx;
    const worldH = grid.rows * cellPx;
    const offsetX = (cssW - worldW) / 2;
    const offsetY = (cssH - worldH) / 2;

    const targetW = Math.floor(cssW * dpr);
    const targetH = Math.floor(cssH * dpr);
    if (canvas.width !== targetW) canvas.width = targetW;
    if (canvas.height !== targetH) canvas.height = targetH;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Full canvas dark background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, cssH);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cssW, cssH);

    // Playfield panel
    ctx.save();
    ctx.translate(offsetX, offsetY);

    const fieldGrad = ctx.createLinearGradient(0, 0, 0, worldH);
    fieldGrad.addColorStop(0, '#1E293B');
    fieldGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, 0, worldW, worldH);

    // Subtle grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < grid.cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellPx, 0);
      ctx.lineTo(i * cellPx, worldH);
      ctx.stroke();
    }
    for (let i = 1; i < grid.rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellPx);
      ctx.lineTo(worldW, i * cellPx);
      ctx.stroke();
    }

    // Field border
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, worldW - 1.5, worldH - 1.5);

    // Food (with pulse)
    const pulseAmount = (Math.sin(foodPulse * 4) + 1) / 2;
    drawFuel(ctx, food.x, food.y, cellPx, pulseAmount);

    // Snake body
    for (let idx = snake.length - 1; idx >= 1; idx--) {
      const segment = snake[idx];
      if (!segment) continue;
      const prev = snake[idx - 1];
      const next = snake[idx + 1];
      const innerInset = Math.max(1, cellPx * 0.06);
      const x = segment.x * cellPx + innerInset;
      const y = segment.y * cellPx + innerInset;
      const size = cellPx - innerInset * 2;
      const t = (idx - 1) / Math.max(1, snake.length - 1);
      const color = idx === snake.length - 1 ? '#15803D' : (idx % 2 === 0 ? '#22C55E' : '#16A34A');
      ctx.fillStyle = color;
      fillRoundedRect(ctx, x, y, size, size, cellPx * 0.28);

      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      fillRoundedRect(ctx, x + size * 0.15, y + size * 0.1, size * 0.5, size * 0.18, cellPx * 0.1);

      // Connect to neighbours so the body looks continuous
      const connect = (other?: Position) => {
        if (!other) return;
        const dx = other.x - segment.x;
        const dy = other.y - segment.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) return;

        const cx = segment.x * cellPx;
        const cy = segment.y * cellPx;
        const midX = cx + cellPx / 2;
        const midY = cy + cellPx / 2;
        const half = cellPx / 2;
        const thickness = cellPx - innerInset * 2;

        let rx = midX, ry = midY, rw = half, rh = thickness;
        if (dx === -1) { rx = cx - 1; ry = cy + innerInset; rw = half + 2; rh = thickness; }
        else if (dx === 1) { rx = midX - 1; ry = cy + innerInset; rw = half + 2; rh = thickness; }
        else if (dy === -1) { rx = cx + innerInset; ry = cy - 1; rw = thickness; rh = half + 2; }
        else if (dy === 1) { rx = cx + innerInset; ry = midY - 1; rw = thickness; rh = half + 2; }

        ctx.fillStyle = color;
        fillRoundedRect(ctx, rx, ry, rw, rh, cellPx * 0.24);
      };

      connect(prev);
      connect(next);
      void t;
    }

    // Snake head (car)
    const head = snake[0];
    if (head) drawCarHead(ctx, head.x, head.y, cellPx, direction);

    ctx.restore();
  }, [snake, food, direction, grid, foodPulse]);

  const resetGame = () => {
    const fresh = initialSnake(grid.cols, grid.rows);
    setSnake(fresh);
    setFood(generateFood(fresh));
    setScore(0);
    setDirection({ x: 1, y: 0 });
    setNextDirection({ x: 1, y: 0 });
    directionRef.current = { x: 1, y: 0 };
    setGameStarted(false);
    setGameOver(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full h-full overflow-hidden bg-slate-950">
      <h2 className="sr-only">Змейка</h2>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none block w-full h-full select-none"
      />

      <div className="pointer-events-none absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-4 py-2 text-white font-extrabold">
        Очки: <span className="tabular-nums text-yellow-300">{score}</span>
        {bestScore > 0 ? <span className="text-white/45 text-xs ml-2">рекорд {bestScore}</span> : null}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] -translate-x-1/2 rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-4 py-2 text-white font-extrabold">
        Змейка
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] inline-flex items-center justify-center rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 p-2.5 text-white/90 hover:bg-black/70 transition disabled:opacity-40"
        aria-label="Закрыть игру"
        disabled={!onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {!gameStarted && !gameOver ? (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="text-center max-w-xs">
            <div className="text-white text-2xl font-extrabold tracking-wider mb-2">ЗМЕЙКА</div>
            <p className="text-white/65 text-sm mb-5">Ешь канистры с топливом и не врезайся в свой хвост. Управление: стрелки / WASD / свайпы.</p>
            <button
              type="button"
              onClick={startGame}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-extrabold text-lg rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-emerald-900/40"
            >
              <Play className="w-5 h-5" fill="currentColor" />
              НАЧАТЬ ИГРУ
            </button>
          </div>
        </div>
      ) : null}

      {gameOver ? (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-red-400 text-3xl font-extrabold mb-2">ИГРА ОКОНЧЕНА</div>
            <div className="text-white text-base mb-1">Очки: <span className="font-extrabold text-yellow-300">{score}</span></div>
            <div className="text-white/55 text-sm mb-6">Рекорд: <span className="font-bold text-cyan-300">{bestScore}</span></div>
            <button
              type="button"
              onClick={resetGame}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-extrabold text-lg rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-emerald-900/40"
            >
              <RotateCcw className="w-5 h-5" />
              ЗАНОВО
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
