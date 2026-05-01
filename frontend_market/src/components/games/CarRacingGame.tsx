import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Car {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  isPlayer?: boolean;
}

const CANVAS_W = 400;
const CANVAS_H = 600;
const ROAD_PADDING = 50;
const LANE_COUNT = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

type CarRacingGameProps = {
  onClose?: () => void;
};

const CarRacingGame: React.FC<CarRacingGameProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const prevKeysPressed = useRef<{ [key: string]: boolean }>({});

  const gameRef = useRef({
    playerCar: {
      x: 0,
      y: 0,
      width: 50,
      height: 70,
      speed: 0,
      color: '#FF5733',
      isPlayer: true,
    } as Car,
    enemyCars: [] as Car[],
    score: 0,
    gameRunning: false,
    playerLane: 1,
  });

  const playSound = (_frequency: number, _duration: number) => {};

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const mql = window.matchMedia?.('(pointer: coarse)');
    if (!mql) return;

    const update = () => setIsCoarsePointer(Boolean(mql.matches));
    update();

    mql.addEventListener?.('change', update);
    return () => mql.removeEventListener?.('change', update);
  }, []);

  const setPressed = (key: string, pressed: boolean) => {
    keysPressed.current[key] = pressed;
  };

  useEffect(() => {
    if (!started || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameState = gameRef.current;
    gameState.gameRunning = true;

    let animationId: number;
    let spawnTimer = 0;
    let scrollOffset = 0;
    const W = CANVAS_W;
    const H = CANVAS_H;

    const laneWidth = (canvas.width - ROAD_PADDING * 2) / LANE_COUNT;
    const laneX = (lane: number, carWidth: number) =>
      ROAD_PADDING + lane * laneWidth + (laneWidth - carWidth) / 2;

    // Reset player to center lane for each run.
    gameState.playerLane = clamp(gameState.playerLane ?? 1, 0, LANE_COUNT - 1);
    gameState.playerCar.x = laneX(gameState.playerLane, gameState.playerCar.width);
    gameState.playerCar.y = H - gameState.playerCar.height - 30;

    const gameLoop = () => {
      // Background + road
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, ROAD_PADDING, H);
      ctx.fillRect(W - ROAD_PADDING, 0, ROAD_PADDING, H);

      ctx.fillStyle = '#1f2937';
      ctx.fillRect(ROAD_PADDING, 0, W - ROAD_PADDING * 2, H);

      // Road edges
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(ROAD_PADDING + 1, 1, W - ROAD_PADDING * 2 - 2, H - 2);

      // Lane markers
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 8;
      ctx.lineCap = 'butt';
      ctx.setLineDash([26, 26]);
      const dashOffset = (scrollOffset % 52) * -1;
      ctx.lineDashOffset = dashOffset;
      for (let i = 1; i < LANE_COUNT; i++) {
        const x = ROAD_PADDING + laneWidth * i;
        ctx.beginPath();
        ctx.moveTo(x, -H);
        ctx.lineTo(x, H * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Player car controls
      const player = gameState.playerCar;
      const leftDown = Boolean(keysPressed.current['arrowleft'] || keysPressed.current['a']);
      const rightDown = Boolean(keysPressed.current['arrowright'] || keysPressed.current['d']);
      const leftPrev = Boolean(prevKeysPressed.current['arrowleft'] || prevKeysPressed.current['a']);
      const rightPrev = Boolean(prevKeysPressed.current['arrowright'] || prevKeysPressed.current['d']);

      const leftPressed = leftDown && !leftPrev;
      const rightPressed = rightDown && !rightPrev;

      if (leftPressed) gameState.playerLane = clamp(gameState.playerLane - 1, 0, LANE_COUNT - 1);
      if (rightPressed) gameState.playerLane = clamp(gameState.playerLane + 1, 0, LANE_COUNT - 1);

      player.x = laneX(gameState.playerLane, player.width);

      // Spawn enemy cars
      spawnTimer++;
      const spawnEvery = Math.max(35, Math.round(80 - gameState.score * 0.25));
      if (spawnTimer > spawnEvery) {
        const randomLane = Math.floor(Math.random() * LANE_COUNT);
        gameState.enemyCars.push({
          x: laneX(randomLane, 50),
          y: -70,
          width: 50,
          height: 70,
          speed: 4 + Math.min(8, gameState.score * 0.04),
          color: ['#FF1744', '#00BCD4', '#4CAF50', '#FFC107'][Math.floor(Math.random() * 4)],
        });
        spawnTimer = 0;
      }

      // Update and draw enemy cars
      let passedThisFrame = 0;
      gameState.enemyCars = gameState.enemyCars.filter((car) => {
        car.y += car.speed;

        // Draw enemy car (simple rounded style)
        roundedRect(ctx, car.x, car.y, car.width, car.height, 10);
        ctx.fillStyle = car.color;
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        roundedRect(ctx, car.x + 8, car.y + 10, car.width - 16, 18, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(car.x + 6, car.y + car.height - 12, 12, 6);
        ctx.fillRect(car.x + car.width - 18, car.y + car.height - 12, 12, 6);

        if (car.y >= H) {
          passedThisFrame += 1;
          return false;
        }

        return true;
      });

      // Draw player car
      roundedRect(ctx, player.x, player.y, player.width, player.height, 12);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      roundedRect(ctx, player.x + 8, player.y + 10, player.width - 16, 22, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(player.x + 6, player.y + player.height - 12, 12, 6);
      ctx.fillRect(player.x + player.width - 18, player.y + player.height - 12, 12, 6);

      // Collision detection
      for (const enemyCar of gameState.enemyCars) {
        if (
          player.x < enemyCar.x + enemyCar.width &&
          player.x + player.width > enemyCar.x &&
          player.y < enemyCar.y + enemyCar.height &&
          player.y + player.height > enemyCar.y
        ) {
          playSound(200, 0.2);
          setGameOver(true);
          gameState.gameRunning = false;
          return;
        }
      }

      // Update score
      if (passedThisFrame > 0) {
        gameState.score += passedThisFrame;
        setScore(gameState.score);
        playSound(620, 0.03);
      }

      scrollOffset += 2;
      prevKeysPressed.current = { ...keysPressed.current };

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
      gameState.gameRunning = false;
    };
  }, [started, gameOver]);

  const startGame = () => {
    setStarted(true);
    setGameOver(false);
    setScore(0);
    gameRef.current = {
      playerCar: {
        x: 0,
        y: 0,
        width: 50,
        height: 70,
        speed: 0,
        color: '#FF5733',
        isPlayer: true,
      },
      enemyCars: [],
      score: 0,
      gameRunning: true,
      playerLane: 1,
    };

  };

  const restartGame = () => {
    startGame();
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      <h2 className="sr-only">Road Fighter</h2>

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="touch-none block w-full h-full select-none bg-slate-950"
        onPointerDown={(e) => {
          if (!isCoarsePointer) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width / 2) setPressed('arrowleft', true);
          else setPressed('arrowright', true);
        }}
        onPointerUp={() => {
          if (!isCoarsePointer) return;
          setPressed('arrowleft', false);
          setPressed('arrowright', false);
        }}
        onPointerCancel={() => {
          if (!isCoarsePointer) return;
          setPressed('arrowleft', false);
          setPressed('arrowright', false);
        }}
        onPointerLeave={() => {
          if (!isCoarsePointer) return;
          setPressed('arrowleft', false);
          setPressed('arrowright', false);
        }}
      />

      <div className="pointer-events-none absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] rounded-2xl bg-black/40 px-4 py-2 text-white font-extrabold backdrop-blur-sm">
        Очки: <span className="tabular-nums">{score}</span>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] -translate-x-1/2 rounded-2xl bg-black/40 px-4 py-2 text-white font-extrabold backdrop-blur-sm">
        Road Fighter
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

      {!started && !gameOver && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="text-center">
            <button
              type="button"
              onClick={startGame}
              className="px-8 py-4 bg-green-500 text-white font-extrabold text-lg rounded-2xl hover:bg-green-600 transition-colors"
            >
              НАЧАТЬ ИГРУ
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-red-400 text-3xl font-extrabold mb-4">СТОЛКНОВЕНИЕ!</div>
            <div className="text-white text-2xl font-extrabold mb-6">Очки: {score}</div>
            <button
              type="button"
              onClick={restartGame}
              className="px-8 py-4 bg-green-500 text-white font-extrabold text-lg rounded-2xl hover:bg-green-600 transition-colors"
            >
              ЗАНОВО
            </button>
          </div>
        </div>
      )}

      {isCoarsePointer ? (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="mx-auto w-full max-w-[520px] rounded-2xl bg-black/40 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-3 w-full select-none">
              <button
                type="button"
                className="flex-1 py-3 rounded-2xl bg-white/10 text-white font-extrabold border border-white/10 active:scale-[0.99]"
                onPointerDown={() => setPressed('arrowleft', true)}
                onPointerUp={() => setPressed('arrowleft', false)}
                onPointerCancel={() => setPressed('arrowleft', false)}
                onPointerLeave={() => setPressed('arrowleft', false)}
              >
                Влево
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-2xl bg-white/10 text-white font-extrabold border border-white/10 active:scale-[0.99]"
                onPointerDown={() => setPressed('arrowright', true)}
                onPointerUp={() => setPressed('arrowright', false)}
                onPointerCancel={() => setPressed('arrowright', false)}
                onPointerLeave={() => setPressed('arrowright', false)}
              >
                Вправо
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CarRacingGame;
export { CarRacingGame };
