import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface RoadDriveGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
}

type Lane = 0 | 1 | 2;

type Obstacle = {
  lane: Lane;
  y: number;
  passed: boolean;
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export const RoadDriveGame: React.FC<RoadDriveGameProps> = ({ onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastMsRef = useRef<number>(0);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [lane, setLane] = useState<Lane>(1);
  const [score, setScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const stateRef = useRef({
    lane: 1 as Lane,
    obstacles: [] as Obstacle[],
    speed: 220, // px/sec
    distance: 0,
    spawnTimer: 0,
  });

  const width = 520;
  const height = 420;
  const lanesX = useMemo(() => [width * 0.28, width * 0.5, width * 0.72] as const, [width]);

  const beep = (frequency: number, durationMs = 80) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, durationMs);
    } catch {
      // ignore
    }
  };

  const reset = () => {
    stateRef.current = {
      lane: 1,
      obstacles: [],
      speed: 220,
      distance: 0,
      spawnTimer: 0,
    };
    setLane(1);
    setScore(0);
    setGameOver(false);
    setRunning(false);
    lastMsRef.current = 0;
  };

  const toggleLane = () => {
    setLane((prev) => {
      const next = ((prev + 1) % 3) as Lane;
      stateRef.current.lane = next;
      beep(650, 40);
      return next;
    });
  };

  const start = () => {
    if (running) return;
    if (gameOver) reset();
    setRunning(true);
    beep(880, 70);
  };

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width, height);

    // background
    const grd = ctx.createLinearGradient(0, 0, 0, height);
    grd.addColorStop(0, '#f5f3ff');
    grd.addColorStop(1, '#ffffff');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    // road
    ctx.fillStyle = '#111827';
    ctx.fillRect(width * 0.18, 0, width * 0.64, height);

    // lane lines
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(width * 0.39, 0);
    ctx.lineTo(width * 0.39, height);
    ctx.moveTo(width * 0.61, 0);
    ctx.lineTo(width * 0.61, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // obstacles
    const obstacles = stateRef.current.obstacles;
    for (const o of obstacles) {
      const x = lanesX[o.lane];
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(x - 26, o.y - 22, 52, 44, 12);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x - 18, o.y - 6, 36, 6);
    }

    // player car
    const carX = lanesX[stateRef.current.lane];
    const carY = height - 60;
    ctx.fillStyle = '#9333ea';
    ctx.beginPath();
    ctx.roundRect(carX - 28, carY - 20, 56, 40, 14);
    ctx.fill();
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.roundRect(carX - 16, carY - 17, 32, 14, 8);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(carX - 18, carY + 22, 6, 0, Math.PI * 2);
    ctx.arc(carX + 18, carY + 22, 6, 0, Math.PI * 2);
    ctx.fill();

    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 170, 44, 14);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillText(`Очки: ${score}`, 26, 40);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(width - 182, 12, 170, 44, 14);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.fillText(`Полоса: ${lane + 1}`, width - 158, 40);

    if (!running) {
      ctx.fillStyle = 'rgba(17,24,39,0.75)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(gameOver ? 'Игра окончена' : 'Нажми, чтобы начать', width / 2, height / 2 - 6);
      ctx.font = '500 14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Одна кнопка: тап = смена полосы', width / 2, height / 2 + 22);
      ctx.textAlign = 'left';
    }
  };

  const step = (ms: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (!lastMsRef.current) lastMsRef.current = ms;
    const dt = clamp((ms - lastMsRef.current) / 1000, 0, 0.04);
    lastMsRef.current = ms;

    if (running && !gameOver) {
      const state = stateRef.current;
      state.distance += dt * state.speed;
      state.spawnTimer -= dt;
      state.speed = Math.min(420, state.speed + dt * 6);

      if (state.spawnTimer <= 0) {
        state.spawnTimer = 0.65 + Math.random() * 0.55;
        const nextLane = Math.floor(Math.random() * 3) as Lane;
        state.obstacles.push({ lane: nextLane, y: -30, passed: false });
      }

      for (const o of state.obstacles) {
        o.y += dt * state.speed;

        if (!o.passed && o.y > height - 60) {
          o.passed = true;
          const nextScore = Math.floor(state.distance / 110);
          setScore(nextScore);
          onScore?.(nextScore);
        }
      }

      state.obstacles = state.obstacles.filter((o) => o.y < height + 60);

      // collision
      const carY = height - 60;
      for (const o of state.obstacles) {
        if (o.lane !== state.lane) continue;
        const dy = Math.abs(o.y - carY);
        if (dy < 34) {
          setGameOver(true);
          setRunning(false);
          onGameOver?.();
          beep(180, 140);
          break;
        }
      }
    }

    draw(ctx);
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    draw(ctx);
    rafRef.current = requestAnimationFrame(step);
    return () => stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stateRef.current.lane = lane;
  }, [lane]);

  useEffect(() => {
    if (!gameOver) return;
    setTimeout(() => {
      // keep score visible
    }, 0);
  }, [gameOver]);

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-gray-900">Едь по дороге</h2>
        <p className="text-gray-600 mt-2">Одна кнопка: нажми, чтобы сменить полосу и не врезаться.</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="rounded-3xl border border-gray-100 shadow-sm bg-white cursor-pointer w-full max-w-[520px]"
            onClick={() => {
              if (!running) start();
              else toggleLane();
            }}
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {!running ? (
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#9333ea] text-white px-5 py-3 font-bold hover:bg-[#7e22ce] transition-colors"
            >
              <Play className="w-5 h-5" fill="currentColor" />
              Старт
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleLane}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#9333ea] text-white px-5 py-3 font-bold hover:bg-[#7e22ce] transition-colors"
            >
              Сменить полосу
            </button>
          )}

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Сброс
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            Звук
          </button>
        </div>
      </div>
    </div>
  );
};

