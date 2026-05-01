import React, { useState, useEffect, useRef } from 'react';
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

export const SnakeGame: React.FC<SnakeGameProps> = ({ onScore, onGameOver, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [nextDirection, setNextDirection] = useState({ x: 1, y: 0 });
  const directionRef = useRef(direction);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const GRID_SIZE = 20;
  const CELL_SIZE = 20;
  const WORLD_SIZE = GRID_SIZE * CELL_SIZE;

  const syncCanvasSize = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
    const nextHeight = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;

    const scale = Math.min(canvas.width, canvas.height) / WORLD_SIZE;
    const offsetX = (canvas.width - WORLD_SIZE * scale) / 2;
    const offsetY = (canvas.height - WORLD_SIZE * scale) / 2;

    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  };

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

  const drawFuel = (ctx: CanvasRenderingContext2D, cellX: number, cellY: number) => {
    const px = cellX * CELL_SIZE;
    const py = cellY * CELL_SIZE;
    const inset = 3;
    const x = px + inset;
    const y = py + inset;
    const w = CELL_SIZE - inset * 2;
    const h = CELL_SIZE - inset * 2;

    ctx.save();

    // can body
    ctx.fillStyle = '#ef4444';
    fillRoundedRect(ctx, x, y + 1, w, h - 1, 6);

    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    fillRoundedRect(ctx, x + 2, y + 3, Math.max(4, w * 0.35), Math.max(6, h * 0.55), 5);

    // handle outline + hole
    const handleW = Math.max(6, w * 0.38);
    const handleH = Math.max(6, h * 0.28);
    ctx.fillStyle = 'rgba(11,18,32,0.55)';
    fillRoundedRect(ctx, x + 2, y + 2, handleW, handleH, 4);
    ctx.fillStyle = '#1f2937';
    fillRoundedRect(ctx, x + 4, y + 4, Math.max(2, handleW - 4), Math.max(2, handleH - 4), 3);

    // nozzle
    ctx.fillStyle = 'rgba(11,18,32,0.75)';
    fillRoundedRect(ctx, x + w - 6, y + 2, 6, 5, 2);

    // label
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    fillRoundedRect(ctx, x + w * 0.35, y + h * 0.45, w * 0.4, h * 0.28, 4);

    ctx.restore();
  };

  const drawCarHead = (
    ctx: CanvasRenderingContext2D,
    cellX: number,
    cellY: number,
    dir: { x: number; y: number }
  ) => {
    const px = cellX * CELL_SIZE;
    const py = cellY * CELL_SIZE;
    const cx = px + CELL_SIZE / 2;
    const cy = py + CELL_SIZE / 2;

    let rot = 0;
    if (dir.x === 0 && dir.y === -1) rot = -Math.PI / 2;
    else if (dir.x === -1 && dir.y === 0) rot = Math.PI;
    else if (dir.x === 0 && dir.y === 1) rot = Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);

    const inset = 2;
    const w = CELL_SIZE - inset * 2;
    const h = CELL_SIZE - inset * 2;
    const x = px + inset;
    const y = py + inset;

    ctx.fillStyle = '#2563eb';
    fillRoundedRect(ctx, x, y, w, h, 6);

    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    fillRoundedRect(ctx, x + 4, y + 4, w - 8, 7, 4);

    ctx.fillStyle = 'rgba(11,18,32,0.9)';
    fillRoundedRect(ctx, x + 5, y + 12, w - 10, 8, 4);

    ctx.fillStyle = '#0b1220';
    ctx.beginPath();
    ctx.arc(x + 6, y + h - 4, 3.2, 0, Math.PI * 2);
    ctx.arc(x + w - 6, y + h - 4, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + w - 2, y + 6, 2, 4);

    ctx.restore();
  };

  // Генерировать еду
  const generateFood = () => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (snake.some(s => s.x === newFood.x && s.y === newFood.y));
    return newFood;
  };

  // Начало игры
  const startGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood());
    setScore(0);
    setDirection({ x: 1, y: 0 });
    setNextDirection({ x: 1, y: 0 });
    setGameStarted(true);
    setGameOver(false);
  };

  // Механика игры
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const gameLoop = setInterval(() => {
      setSnake(prevSnake => {
        setDirection(nextDirection);

        const head = prevSnake[0];
        const newHead = {
          x: (head.x + nextDirection.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + nextDirection.y + GRID_SIZE) % GRID_SIZE
        };

        // Проверить столкновение с телом
        if (prevSnake.some(s => s.x === newHead.x && s.y === newHead.y)) {
          setGameOver(true);
          setGameStarted(false);
          onGameOver?.();
          return prevSnake;
        }

        let newSnake = [newHead, ...prevSnake];

        // Проверить еду
        if (newHead.x === food.x && newHead.y === food.y) {
          const newScore = score + 10;
          setScore(newScore);
          onScore?.(newScore);
          setFood(generateFood());
        } else {
          newSnake = newSnake.slice(0, -1);
        }

        return newSnake;
      });
    }, 200);

    return () => clearInterval(gameLoop);
  }, [gameStarted, gameOver, nextDirection, food, score]);

  // Управление
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === 'arrowup' || key === 'w') {
        e.preventDefault();
        if (direction.y === 0) setNextDirection({ x: 0, y: -1 });
      } else if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
        if (direction.y === 0) setNextDirection({ x: 0, y: 1 });
      } else if (key === 'arrowleft' || key === 'a') {
        e.preventDefault();
        if (direction.x === 0) setNextDirection({ x: -1, y: 0 });
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault();
        if (direction.x === 0) setNextDirection({ x: 1, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction]);

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

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
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

  // Рисование
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    syncCanvasSize(canvas, ctx);

    // Fill full canvas background (outside the square too)
    const t = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

    // Фон
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    // Сетка
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, WORLD_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(WORLD_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Змейка
    for (let idx = snake.length - 1; idx >= 0; idx--) {
      const segment = snake[idx];
      if (!segment) continue;

      if (idx === 0) {
        drawCarHead(ctx, segment.x, segment.y, direction);
        continue;
      }

      const prev = snake[idx - 1];
      const next = snake[idx + 1];
      const x = segment.x * CELL_SIZE + 1;
      const y = segment.y * CELL_SIZE + 1;
      const size = CELL_SIZE - 2;
      const color = idx % 2 === 0 ? '#10b981' : '#22c55e';
      ctx.fillStyle = color;
      fillRoundedRect(ctx, x, y, size, size, 7);

      // Connect to previous/next segment to look "solid" (avoid wrap-around connections).
      const connect = (other?: Position) => {
        if (!other) return;
        const dx = other.x - segment.x;
        const dy = other.y - segment.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) return;

        const cx = segment.x * CELL_SIZE;
        const cy = segment.y * CELL_SIZE;
        const midX = cx + CELL_SIZE / 2;
        const midY = cy + CELL_SIZE / 2;
        const half = CELL_SIZE / 2;

        let rx = midX;
        let ry = midY;
        let rw = half;
        let rh = CELL_SIZE - 2;
        if (dx === -1) {
          rx = cx - 1;
          ry = cy + 1;
          rw = half + 2;
          rh = CELL_SIZE - 2;
        } else if (dx === 1) {
          rx = midX - 1;
          ry = cy + 1;
          rw = half + 2;
          rh = CELL_SIZE - 2;
        } else if (dy === -1) {
          rx = cx + 1;
          ry = cy - 1;
          rw = CELL_SIZE - 2;
          rh = half + 2;
        } else if (dy === 1) {
          rx = cx + 1;
          ry = midY - 1;
          rw = CELL_SIZE - 2;
          rh = half + 2;
        }

        ctx.fillStyle = color;
        fillRoundedRect(ctx, rx, ry, rw, rh, 7);
      };

      connect(prev);
      connect(next);
    }

    // Fuel (food)
    drawFuel(ctx, food.x, food.y);

  }, [snake, food, score, direction]);

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood());
    setScore(0);
    setDirection({ x: 1, y: 0 });
    setNextDirection({ x: 1, y: 0 });
    setGameStarted(false);
    setGameOver(false);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      <h2 className="sr-only">Змейка</h2>

      <canvas
        ref={canvasRef}
        width={1}
        height={1}
        className="absolute inset-0 touch-none block w-full h-full select-none bg-slate-950"
      />

      <div className="pointer-events-none absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] rounded-2xl bg-black/40 px-4 py-2 text-white font-extrabold backdrop-blur-sm">
        Очки: <span className="tabular-nums">{score}</span>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] -translate-x-1/2 rounded-2xl bg-black/40 px-4 py-2 text-white font-extrabold backdrop-blur-sm">
        Змейка
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] inline-flex items-center justify-center rounded-2xl bg-black/35 p-2.5 text-white/90 backdrop-blur-sm hover:bg-black/45 transition disabled:opacity-40"
        aria-label="Закрыть игру"
        disabled={!onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {!gameStarted && !gameOver ? (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="text-center">
            <button
              type="button"
              onClick={startGame}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-500 text-white font-extrabold text-lg rounded-2xl hover:bg-green-600 transition-colors"
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
            <div className="text-red-400 text-3xl font-extrabold mb-4">ИГРА ОКОНЧЕНА!</div>
            <div className="text-white text-2xl font-extrabold mb-6">Очки: {score}</div>
            <button
              type="button"
              onClick={resetGame}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-500 text-white font-extrabold text-lg rounded-2xl hover:bg-green-600 transition-colors"
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
