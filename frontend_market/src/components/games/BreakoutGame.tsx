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
  row: number;
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const ROW_COLORS = ['#F472B6', '#FB7185', '#FB923C', '#FACC15', '#22C55E', '#22D3EE'];

export const BreakoutGame: React.FC<BreakoutGameProps> = ({ onScore, onGameOver, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastMsRef = useRef<number>(0);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [bestScore, setBestScore] = useState<number>(() => {
    try { return Number(localStorage.getItem('breakout-best') || 0) || 0; } catch { return 0; }
  });

  const W = 520;
  const H = 380;

  const config = useMemo(
    () => ({
      paddleW: 92,
      paddleH: 12,
      ballR: 7,
      ballSpeed: 280,
      rows: 6,
      cols: 10,
      gap: 6,
      marginTop: 40,
      marginSide: 18,
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

  const initBricks = (): Brick[] => {
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
          row: r,
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
      if (key === ' ' && !running && !gameOver && !won) {
        e.preventDefault();
        start();
      }
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0F172A');
    g.addColorStop(1, '#020617');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo((W / 10) * i, 0);
      ctx.lineTo((W / 10) * i, H);
      ctx.stroke();
    }

    for (const b of stateRef.current.bricks) {
      if (b.hp <= 0) continue;
      const color = ROW_COLORS[b.row % ROW_COLORS.length];
      const grad = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      grad.addColorStop(0, color);
      grad.addColorStop(1, shade(color, -0.25));
      ctx.fillStyle = grad;
      roundRect(ctx, b.x, b.y, b.w, b.h, 3);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 2);

      if (b.hp === 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(b.x + b.w / 2 - 4, b.y + b.h / 2 - 1, 8, 2);
      }
    }

    const py = H - 24;
    const pg = ctx.createLinearGradient(0, py, 0, py + config.paddleH);
    pg.addColorStop(0, '#E0F2FE');
    pg.addColorStop(1, '#38BDF8');
    ctx.fillStyle = pg;
    roundRect(ctx, stateRef.current.paddleX, py, config.paddleW, config.paddleH, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(stateRef.current.paddleX + 4, py + 2, config.paddleW - 8, 2);

    const bx = stateRef.current.ballX;
    const by = stateRef.current.ballY;
    const rg = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, config.ballR);
    rg.addColorStop(0, '#FFFFFF');
    rg.addColorStop(1, '#FBBF24');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(bx, by, config.ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const bounceOffPaddle = () => {
    const s = stateRef.current;
    const paddleY = H - 24;
    const paddleX = s.paddleX;
    if (s.ballY + config.ballR < paddleY) return;
    if (s.ballY - config.ballR > paddleY + config.paddleH) return;
    if (s.ballX < paddleX || s.ballX > paddleX + config.paddleW) return;

    s.ballY = paddleY - config.ballR - 0.5;
    const hit = (s.ballX - (paddleX + config.paddleW / 2)) / (config.paddleW / 2);
    const angle = hit * 0.9;
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
      s.paddleX = clamp(s.paddleX + s.input * 460 * dt, 0, W - config.paddleW);
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
    if (s.ballY - config.ballR < 8) {
      s.ballY = 8 + config.ballR;
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
      const add = b.hp === 0 ? 10 : 5;
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
          setBestScore((b) => {
            const v = Math.max(b, score);
            try { localStorage.setItem('breakout-best', String(v)); } catch { /* ignore */ }
            return v;
          });
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
      setBestScore((b) => {
        const v = Math.max(b, score);
        try { localStorage.setItem('breakout-best', String(v)); } catch { /* ignore */ }
        return v;
      });
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

  const setPointerFromEvent = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    stateRef.current.pointerX = ((clientX - rect.left) / rect.width) * W;
  };

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#1E1B4B] to-[#020617] flex flex-col">
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 flex justify-center px-3 pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Pill label="СЧЁТ" value={String(score)} accent="#FACC15" />
          <Pill label="ЖИЗНИ" value={'♥'.repeat(Math.max(0, lives)) || '—'} accent="#F87171" />
          <Pill label="РЕКОРД" value={String(bestScore)} accent="#22D3EE" />
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full flex items-center justify-center pt-[calc(env(safe-area-inset-top)+9.5rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)] px-3">
        <div className="relative w-full max-w-[560px] aspect-[520/380]">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%' }}
            className="rounded-2xl shadow-2xl shadow-indigo-900/60 border border-indigo-500/20 select-none touch-none"
            onMouseMove={(e) => setPointerFromEvent(e.clientX)}
            onMouseLeave={() => { stateRef.current.pointerX = null; }}
            onTouchStart={(e) => { const t = e.touches[0]; if (t) setPointerFromEvent(t.clientX); }}
            onTouchMove={(e) => { const t = e.touches[0]; if (t) setPointerFromEvent(t.clientX); }}
            onTouchEnd={() => { stateRef.current.pointerX = null; }}
          />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-10 flex justify-center gap-3 px-4">
        {!running && !gameOver && !won ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 px-7 py-3 text-white font-extrabold hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-blue-900/40"
          >
            <Play className="w-5 h-5" fill="currentColor" /> Старт
          </button>
        ) : null}
        {(gameOver || won || running) ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md px-5 py-3 text-white font-bold hover:bg-white/20 transition border border-white/15"
          >
            <RotateCcw className="w-4 h-4" /> Заново
          </button>
        ) : null}
      </div>

      {won ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm p-6 text-center">
          <div className="text-emerald-300 text-2xl font-extrabold mb-2">ПОБЕДА!</div>
          <div className="text-white text-base mb-5">Счёт: <span className="font-extrabold text-yellow-300">{score}</span></div>
          <button onClick={reset} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 px-7 py-3 text-white font-bold hover:scale-[1.02] transition">
            <RotateCcw className="w-5 h-5" /> Сыграть ещё раз
          </button>
        </div>
      ) : null}
      {gameOver ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm p-6 text-center">
          <div className="text-red-400 text-2xl font-extrabold mb-2">ИГРА ОКОНЧЕНА</div>
          <div className="text-white text-base mb-5">Счёт: <span className="font-extrabold text-yellow-300">{score}</span></div>
          <button onClick={reset} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 px-7 py-3 text-white font-bold hover:scale-[1.02] transition">
            <RotateCcw className="w-5 h-5" /> Заново
          </button>
        </div>
      ) : null}
    </div>
  );
};

const Pill: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div className="pointer-events-none rounded-2xl bg-slate-900/70 backdrop-blur-md border border-white/10 px-3 py-1.5 text-center">
    <div className="text-[9px] font-bold tracking-[0.15em] text-white/55 leading-none mb-0.5">{label}</div>
    <div className="font-extrabold leading-none tabular-nums text-sm" style={{ color: accent }}>{value}</div>
  </div>
);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function shade(hex: string, percent: number): string {
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const R = f >> 16;
  const G = (f >> 8) & 0xff;
  const B = f & 0xff;
  const nr = Math.round((t - R) * p) + R;
  const ng = Math.round((t - G) * p) + G;
  const nb = Math.round((t - B) * p) + B;
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}
