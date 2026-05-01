import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

interface PongGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export const PongGame: React.FC<PongGameProps> = ({ onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastMsRef = useRef<number>(0);

  const [running, setRunning] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);

  const W = 520;
  const H = 360;
  const paddleW = 10;
  const paddleH = 70;
  const ballR = 7;

  const stateRef = useRef({
    playerY: (H - paddleH) / 2,
    aiY: (H - paddleH) / 2,
    ballX: W / 2,
    ballY: H / 2,
    ballVX: 220,
    ballVY: 120,
  });

  const resetBall = (dir: 1 | -1) => {
    stateRef.current.ballX = W / 2;
    stateRef.current.ballY = H / 2;
    stateRef.current.ballVX = 220 * dir;
    stateRef.current.ballVY = (Math.random() * 220 - 110) || 120;
  };

  const reset = () => {
    setRunning(false);
    setPlayerScore(0);
    setAiScore(0);
    lastMsRef.current = 0;
    stateRef.current.playerY = (H - paddleH) / 2;
    stateRef.current.aiY = (H - paddleH) / 2;
    resetBall(1);
    onScore?.(0);
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, W, H);

    // center line
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // paddles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(18, stateRef.current.playerY, paddleW, paddleH);
    ctx.fillRect(W - 18 - paddleW, stateRef.current.aiY, paddleW, paddleH);

    // ball
    ctx.beginPath();
    ctx.arc(stateRef.current.ballX, stateRef.current.ballY, ballR, 0, Math.PI * 2);
    ctx.fill();

    // score
    ctx.font = 'bold 22px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillText(String(playerScore), W / 2 - 60, 40);
    ctx.fillText(String(aiScore), W / 2 + 45, 40);

    if (!running) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Нажми «Старт»', W / 2, H / 2 - 8);
      ctx.font = '500 13px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Двигай ракетку мышкой/пальцем', W / 2, H / 2 + 18);
      ctx.textAlign = 'left';
    }
  };

  const step = (ms: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (!lastMsRef.current) lastMsRef.current = ms;
    const dt = clamp((ms - lastMsRef.current) / 1000, 0, 0.04);
    lastMsRef.current = ms;

    if (running) {
      const s = stateRef.current;
      s.ballX += s.ballVX * dt;
      s.ballY += s.ballVY * dt;

      // walls
      if (s.ballY - ballR < 0) {
        s.ballY = ballR;
        s.ballVY *= -1;
      }
      if (s.ballY + ballR > H) {
        s.ballY = H - ballR;
        s.ballVY *= -1;
      }

      // AI follow
      const aiTarget = s.ballY - paddleH / 2;
      const aiSpeed = 220;
      s.aiY += clamp(aiTarget - s.aiY, -aiSpeed * dt, aiSpeed * dt);
      s.aiY = clamp(s.aiY, 0, H - paddleH);

      // paddle collisions
      const playerX = 18 + paddleW;
      if (s.ballX - ballR < playerX && s.ballX > 10) {
        if (s.ballY > s.playerY && s.ballY < s.playerY + paddleH) {
          s.ballX = playerX + ballR;
          s.ballVX = Math.abs(s.ballVX) * 1.03;
          const rel = (s.ballY - (s.playerY + paddleH / 2)) / (paddleH / 2);
          s.ballVY = rel * 240;
        }
      }

      const aiX = W - 18 - paddleW;
      if (s.ballX + ballR > aiX && s.ballX < W - 10) {
        if (s.ballY > s.aiY && s.ballY < s.aiY + paddleH) {
          s.ballX = aiX - ballR;
          s.ballVX = -Math.abs(s.ballVX) * 1.03;
          const rel = (s.ballY - (s.aiY + paddleH / 2)) / (paddleH / 2);
          s.ballVY = rel * 240;
        }
      }

      // score
      if (s.ballX < -40) {
        setAiScore((v) => v + 1);
        resetBall(1);
        if (aiScore + 1 >= 7) {
          setRunning(false);
          onGameOver?.();
        }
      }
      if (s.ballX > W + 40) {
        setPlayerScore((v) => {
          const next = v + 1;
          onScore?.(next);
          return next;
        });
        resetBall(-1);
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
  }, [running, playerScore, aiScore]);

  const handlePointerMove = (clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = ((clientY - rect.top) / rect.height) * H;
    stateRef.current.playerY = clamp(y - paddleH / 2, 0, H - paddleH);
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-gray-900">Pong</h2>
        <p className="text-gray-600 mt-2">Победи компьютер до 7 очков.</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-3xl border border-gray-100 shadow-sm w-full max-w-[520px] bg-white"
          onMouseMove={(e) => handlePointerMove(e.clientY)}
          onTouchMove={(e) => handlePointerMove(e.touches[0]?.clientY || 0)}
        />

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={() => setRunning(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#9333ea] text-white px-5 py-3 font-bold hover:bg-[#7e22ce] transition-colors"
          >
            <Play className="w-5 h-5" fill="currentColor" />
            Старт
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Сброс
          </button>
        </div>
      </div>
    </div>
  );
};

