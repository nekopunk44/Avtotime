import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

interface BreakoutGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
  onComplete?: () => void;
}

type Brick = {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export const BreakoutGame: React.FC<BreakoutGameProps> = ({ onScore, onGameOver, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastMsRef = useRef<number>(0);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);

  const W = 520;
  const H = 380;

  const config = useMemo(
    () => ({
      paddleW: 92,
      paddleH: 12,
      ballR: 7,
      ballSpeed: 260,
      rows: 6,
      cols: 10,
      gap: 8,
      marginTop: 52,
      marginSide: 20,
      brickH: 18,
    }),
    []
  );

  const stateRef = useRef({
    paddleX: (W - config.paddleW) / 2,
    ballX: W / 2,
    ballY: H * 0.68,
    ballVX: config.ballSpeed,
    ballVY: -config.ballSpeed,
    bricks: [] as Brick[],
    input: 0 as -1 | 0 | 1,
    pointerX: null as number | null,
  });

  const initBricks = () => {
    const { cols, rows, gap, marginSide, marginTop, brickH } = config;
    const totalGap = gap * (cols - 1);
    const brickW = (W - marginSide * 2 - totalGap) / cols;
    const bricks: Brick[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: marginSide + c * (brickW + gap),
          y: marginTop + r * (brickH + gap),
          w: brickW,
          h: brickH,
          hp: r < 2 ? 2 : 1,
        });
      }
    }
    return bricks;
  };

  const reset = () => {
    stateRef.current = {
      paddleX: (W - config.paddleW) / 2,
      ballX: W / 2,
      ballY: H * 0.68,
      ballVX: config.ballSpeed,
      ballVY: -config.ballSpeed,
      bricks: initBricks(),
      input: 0,
      pointerX: null,
    };
    setScore(0);
    setLives(3);
    setGameOver(false);
    setWon(false);
    setRunning(false);
    lastMsRef.current = 0;
    onScore?.(0);
  };

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') stateRef.current.input = -1;
      if (key === 'arrowright' || key === 'd') stateRef.current.input = 1;
      if (key === ' ' && !running && !gameOver && !won) start();
      if (key === 'r') reset();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        if (stateRef.current.input === -1) stateRef.current.input = 0;
      }
      if (key === 'arrowright' || key === 'd') {
        if (stateRef.current.input === 1) stateRef.current.input = 0;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameOver, running, won]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, W, H);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1220');
    g.addColorStop(1, '#111827');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillText(`Счёт: ${score}`, 16, 28);
    ctx.fillText(`Жизни: ${lives}`, W - 110, 28);

    for (const b of stateRef.current.bricks) {
      if (b.hp <= 0) continue;
      ctx.fillStyle = b.hp === 2 ? 'rgba(59,130,246,0.95)' : 'rgba(236,72,153,0.95)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(b.x, b.y, b.w, 4);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(stateRef.current.paddleX, H - 22, config.paddleW, config.paddleH);

    ctx.beginPath();
    ctx.arc(stateRef.current.ballX, stateRef.current.ballY, config.ballR, 0, Math.PI * 2);
    ctx.fill();

    if (!running && !gameOver && !won) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Нажми Пробел или «Старт». Управление: ←/→ или мышка/палец.', 16, H - 48);
    }
  };

  const bounceOffPaddle = () => {
    const s = stateRef.current;
    const paddleY = H - 22;
    const paddleX = s.paddleX;
    if (s.ballY + config.ballR < paddleY) return;
    if (s.ballY - config.ballR > paddleY + config.paddleH) return;
    if (s.ballX < paddleX || s.ballX > paddleX + config.paddleW) return;

    s.ballY = paddleY - config.ballR - 0.5;
    const hit = (s.ballX - (paddleX + config.paddleW / 2)) / (config.paddleW / 2);
    const angle = hit * 0.85;
    const speed = Math.hypot(s.ballVX, s.ballVY);
    s.ballVX = speed * Math.sin(angle);
    s.ballVY = -Math.abs(speed * Math.cos(angle));
  };

  const step = (ms: number) => {
    if (!running) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (!lastMsRef.current) lastMsRef.current = ms;
    const dt = clamp((ms - lastMsRef.current) / 1000, 0, 0.033);
    lastMsRef.current = ms;

    const s = stateRef.current;

    if (typeof s.pointerX === 'number') {
      s.paddleX = clamp(s.pointerX - config.paddleW / 2, 0, W - config.paddleW);
    } else if (s.input !== 0) {
      s.paddleX = clamp(s.paddleX + s.input * 420 * dt, 0, W - config.paddleW);
    }

    s.ballX += s.ballVX * dt;
    s.ballY += s.ballVY * dt;

    if (s.ballX - config.ballR < 0) {
      s.ballX = config.ballR;
      s.ballVX *= -1;
    } else if (s.ballX + config.ballR > W) {
      s.ballX = W - config.ballR;
      s.ballVX *= -1;
    }
    if (s.ballY - config.ballR < 42) {
      s.ballY = 42 + config.ballR;
      s.ballVY *= -1;
    }

    bounceOffPaddle();

    for (const b of s.bricks) {
      if (b.hp <= 0) continue;
      const bx1 = b.x;
      const by1 = b.y;
      const bx2 = b.x + b.w;
      const by2 = b.y + b.h;
      const x = s.ballX;
      const y = s.ballY;
      if (x + config.ballR < bx1 || x - config.ballR > bx2 || y + config.ballR < by1 || y - config.ballR > by2) continue;

      const left = Math.abs(x - bx1);
      const right = Math.abs(bx2 - x);
      const top = Math.abs(y - by1);
      const bottom = Math.abs(by2 - y);
      const min = Math.min(left, right, top, bottom);
      if (min === left || min === right) s.ballVX *= -1;
      else s.ballVY *= -1;

      b.hp -= 1;
      const add = b.hp === 1 ? 10 : 15;
      const nextScore = score + add;
      setScore(nextScore);
      onScore?.(nextScore);
      break;
    }

    if (s.ballY - config.ballR > H) {
      setLives((prev) => {
        const nextLives = prev - 1;
        if (nextLives <= 0) {
          setRunning(false);
          setGameOver(true);
          setTimeout(() => onGameOver?.(), 0);
        } else {
          s.ballX = W / 2;
          s.ballY = H * 0.68;
          s.ballVX = config.ballSpeed * (Math.random() > 0.5 ? 1 : -1);
          s.ballVY = -config.ballSpeed;
        }
        return nextLives;
      });
    }

    if (s.bricks.every((b) => b.hp <= 0)) {
      setRunning(false);
      setWon(true);
      setTimeout(() => onComplete?.(), 0);
    }

    draw(ctx);
    rafRef.current = requestAnimationFrame(step);
  };

  const start = () => {
    if (running) return;
    if (gameOver || won) reset();
    setRunning(true);
    lastMsRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    draw(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, lives, running, gameOver, won]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Breakout</h2>

      <div className="flex flex-col items-center gap-6">
        <div className="rounded-2xl overflow-hidden border border-gray-200 bg-slate-950">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              stateRef.current.pointerX = ((e.clientX - rect.left) / rect.width) * W;
            }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (!t) return;
              const rect = e.currentTarget.getBoundingClientRect();
              stateRef.current.pointerX = ((t.clientX - rect.left) / rect.width) * W;
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (!t) return;
              const rect = e.currentTarget.getBoundingClientRect();
              stateRef.current.pointerX = ((t.clientX - rect.left) / rect.width) * W;
            }}
            onTouchEnd={() => {
              stateRef.current.pointerX = null;
            }}
            onMouseLeave={() => {
              stateRef.current.pointerX = null;
            }}
            className="select-none touch-none"
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {!running ? (
            <button
              type="button"
              onClick={start}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-7 py-3 rounded-xl font-bold hover:bg-blue-700 transition"
            >
              <Play className="w-5 h-5" fill="currentColor" />
              Старт
            </button>
          ) : null}

          <button
            type="button"
            onClick={reset}
            className="flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition"
          >
            <RotateCcw className="w-5 h-5" />
            Заново
          </button>
        </div>

        {won ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-emerald-800 font-semibold">
            Победа! Счёт: <span className="font-black">{score}</span>
          </div>
        ) : null}
        {gameOver ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-red-800 font-semibold">
            Игра окончена. Счёт: <span className="font-black">{score}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
