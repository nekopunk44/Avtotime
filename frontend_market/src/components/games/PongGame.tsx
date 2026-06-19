import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

interface PongGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
  onComplete?: () => void;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const WIN_SCORE = 7;

export const PongGame: React.FC<PongGameProps> = ({ onScore, onGameOver, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastMsRef = useRef<number>(0);
  const playerScoreRef = useRef(0);
  const aiScoreRef = useRef(0);
  const runningRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);

  const W = 560;
  const H = 360;
  const paddleW = 10;
  const paddleH = 76;
  const ballR = 8;

  const stateRef = useRef({
    playerY: (H - paddleH) / 2,
    aiY: (H - paddleH) / 2,
    ballX: W / 2,
    ballY: H / 2,
    ballVX: 240,
    ballVY: 140,
  });

  const resetBall = (dir: 1 | -1) => {
    const s = stateRef.current;
    s.ballX = W / 2;
    s.ballY = H / 2;
    const speed = 240;
    s.ballVX = speed * dir;
    s.ballVY = (Math.random() * 220 - 110) || 120;
  };

  const reset = () => {
    runningRef.current = false;
    playerScoreRef.current = 0;
    aiScoreRef.current = 0;
    setRunning(false);
    setPlayerScore(0);
    setAiScore(0);
    setWinner(null);
    lastMsRef.current = 0;
    stateRef.current.playerY = (H - paddleH) / 2;
    stateRef.current.aiY = (H - paddleH) / 2;
    resetBall(1);
    onScore?.(0);
  };

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

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(99,102,241,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (H / 8) * i + 0.5);
      ctx.lineTo(W, (H / 8) * i + 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(34,211,238,0.05)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 56, 0, Math.PI * 2);
    ctx.stroke();

    const playerGrad = ctx.createLinearGradient(0, stateRef.current.playerY, 0, stateRef.current.playerY + paddleH);
    playerGrad.addColorStop(0, '#A5F3FC');
    playerGrad.addColorStop(1, '#22D3EE');
    ctx.fillStyle = playerGrad;
    roundRect(ctx, 18, stateRef.current.playerY, paddleW, paddleH, 4);
    ctx.fill();

    const aiGrad = ctx.createLinearGradient(0, stateRef.current.aiY, 0, stateRef.current.aiY + paddleH);
    aiGrad.addColorStop(0, '#FECACA');
    aiGrad.addColorStop(1, '#F87171');
    ctx.fillStyle = aiGrad;
    roundRect(ctx, W - 18 - paddleW, stateRef.current.aiY, paddleW, paddleH, 4);
    ctx.fill();

    const bx = stateRef.current.ballX;
    const by = stateRef.current.ballY;
    ctx.fillStyle = 'rgba(250,204,21,0.25)';
    ctx.beginPath();
    ctx.arc(bx, by, ballR + 4, 0, Math.PI * 2);
    ctx.fill();
    const ballGrad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, ballR);
    ballGrad.addColorStop(0, '#FFFFFF');
    ballGrad.addColorStop(1, '#FACC15');
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(bx, by, ballR, 0, Math.PI * 2);
    ctx.fill();
  };

  const step = (ms: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (!lastMsRef.current) lastMsRef.current = ms;
    const dt = clamp((ms - lastMsRef.current) / 1000, 0, 0.04);
    lastMsRef.current = ms;

    if (runningRef.current) {
      const s = stateRef.current;
      s.ballX += s.ballVX * dt;
      s.ballY += s.ballVY * dt;

      if (s.ballY - ballR < 0) {
        s.ballY = ballR;
        s.ballVY *= -1;
      }
      if (s.ballY + ballR > H) {
        s.ballY = H - ballR;
        s.ballVY *= -1;
      }

      // AI follows ball with slight lag for fairness
      const aiTarget = s.ballY - paddleH / 2;
      const aiSpeed = 220;
      s.aiY += clamp(aiTarget - s.aiY, -aiSpeed * dt, aiSpeed * dt);
      s.aiY = clamp(s.aiY, 0, H - paddleH);

      const playerX = 18 + paddleW;
      if (s.ballX - ballR < playerX && s.ballX > 10) {
        if (s.ballY > s.playerY && s.ballY < s.playerY + paddleH) {
          s.ballX = playerX + ballR;
          s.ballVX = Math.abs(s.ballVX) * 1.04;
          const rel = (s.ballY - (s.playerY + paddleH / 2)) / (paddleH / 2);
          s.ballVY = rel * 260;
        }
      }

      const aiX = W - 18 - paddleW;
      if (s.ballX + ballR > aiX && s.ballX < W - 10) {
        if (s.ballY > s.aiY && s.ballY < s.aiY + paddleH) {
          s.ballX = aiX - ballR;
          s.ballVX = -Math.abs(s.ballVX) * 1.04;
          const rel = (s.ballY - (s.aiY + paddleH / 2)) / (paddleH / 2);
          s.ballVY = rel * 260;
        }
      }

      if (s.ballX < -40) {
        aiScoreRef.current += 1;
        setAiScore(aiScoreRef.current);
        if (aiScoreRef.current >= WIN_SCORE) {
          runningRef.current = false;
          setRunning(false);
          setWinner('ai');
          onGameOver?.();
        } else {
          resetBall(1);
        }
      }
      if (s.ballX > W + 40) {
        playerScoreRef.current += 1;
        setPlayerScore(playerScoreRef.current);
        onScore?.(playerScoreRef.current);
        if (playerScoreRef.current >= WIN_SCORE) {
          runningRef.current = false;
          setRunning(false);
          setWinner('player');
          onComplete?.();
        } else {
          resetBall(-1);
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
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { runningRef.current = running; }, [running]);

  const handlePointerMove = (clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = ((clientY - rect.top) / rect.height) * H;
    stateRef.current.playerY = clamp(y - paddleH / 2, 0, H - paddleH);
  };

  const start = () => {
    if (winner) reset();
    setRunning(true);
    lastMsRef.current = 0;
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#1E1B4B] to-[#020617] flex flex-col">
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 flex justify-center px-3 pointer-events-none">
        <div className="flex items-center gap-3">
          <ScoreBox label="ВЫ" value={playerScore} accent="#22D3EE" />
          <div className="text-white/40 font-bold text-sm">до {WIN_SCORE}</div>
          <ScoreBox label="БОТ" value={aiScore} accent="#F87171" />
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full flex items-center justify-center pt-[calc(env(safe-area-inset-top)+9rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)] px-3">
        <div className="relative w-full max-w-[600px] aspect-[560/360]">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%' }}
            className="rounded-2xl shadow-2xl shadow-indigo-900/60 border border-indigo-500/20 select-none touch-none"
            onMouseMove={(e) => handlePointerMove(e.clientY)}
            onTouchMove={(e) => { const t = e.touches[0]; if (t) handlePointerMove(t.clientY); }}
            onTouchStart={(e) => { const t = e.touches[0]; if (t) handlePointerMove(t.clientY); }}
          />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-10 flex justify-center gap-3 px-4">
        {!running ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-600 px-7 py-3 text-white font-extrabold hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-purple-900/40"
          >
            <Play className="w-5 h-5" fill="currentColor" /> {winner ? 'Снова' : 'Старт'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md px-5 py-3 text-white font-bold hover:bg-white/20 transition border border-white/15"
        >
          <RotateCcw className="w-4 h-4" /> Сброс
        </button>
      </div>

      {winner ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm p-6 text-center">
          <div className={`text-3xl font-extrabold mb-2 ${winner === 'player' ? 'text-emerald-300' : 'text-red-400'}`}>
            {winner === 'player' ? 'ВЫ ВЫИГРАЛИ!' : 'ВЫ ПРОИГРАЛИ'}
          </div>
          <div className="text-white text-base mb-5">
            <span className="text-cyan-300 font-bold">{playerScore}</span>
            <span className="text-white/50 mx-2">:</span>
            <span className="text-red-300 font-bold">{aiScore}</span>
          </div>
          <button onClick={start} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-600 px-7 py-3 text-white font-bold hover:scale-[1.02] transition">
            <RotateCcw className="w-5 h-5" /> Сыграть ещё раз
          </button>
        </div>
      ) : null}

      {!running && !winner ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 text-center text-white/70 text-xs">
          Двигай ракетку мышкой или пальцем
        </div>
      ) : null}
    </div>
  );
};

const ScoreBox: React.FC<{ label: string; value: number; accent: string }> = ({ label, value, accent }) => (
  <div className="pointer-events-none rounded-2xl bg-slate-900/70 backdrop-blur-md border border-white/10 px-4 py-2 text-center min-w-[64px]">
    <div className="text-[9px] font-bold tracking-[0.15em] text-white/55 leading-none mb-1">{label}</div>
    <div className="font-extrabold leading-none tabular-nums text-2xl" style={{ color: accent }}>{value}</div>
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
