import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Play } from 'lucide-react';
import carSpriteUrl from '../../assets/sprites/flappy-car-sprite.svg';

interface FlappyCarGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
  onComplete?: () => void;
}

interface Obstacle {
  x: number;
  gap: number;
  scored: boolean;
  type: 'building' | 'cloud';
}

export const FlappyCarGame: React.FC<FlappyCarGameProps & { onComplete?: () => void }> = ({ onScore, onGameOver, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carImageRef = useRef<HTMLImageElement | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    try {
      return Number(localStorage.getItem('flappy-car-best') || 0) || 0;
    } catch {
      return 0;
    }
  });
  const gameStateRef = useRef({
    carY: 150,
    carVelocity: 0,
    carRotation: 0,
    obstacles: [] as Obstacle[],
    score: 0
  });

  const WORLD_WIDTH = 600;
  const WORLD_HEIGHT = 400;
  const CAR_WIDTH = 44;
  const CAR_HEIGHT = 28;
  const CAR_X = 40;
  const GRAVITY = 0.35;
  const FLAP_STRENGTH = -9;
  const OBSTACLE_WIDTH = 90;
  const GAP_HEIGHT = 130;
  const OBSTACLE_SPEED = 3.5;

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const syncCanvasSize = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, carYForCamera?: number) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
    const nextHeight = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;

    const sx = canvas.width / WORLD_WIDTH;
    const sy = canvas.height / WORLD_HEIGHT;
    // "Cover" fit: fills the whole block without distortion, cropping overflow if needed.
    const scale = Math.max(sx, sy);

    const visibleWorldWidth = canvas.width / scale;
    const visibleWorldHeight = canvas.height / scale;

    // Camera: keep the car visible horizontally; keep ground visible vertically.
    const targetCarX = CAR_X + CAR_WIDTH / 2;
    const desiredCameraX = targetCarX - visibleWorldWidth * 0.2;
    const maxCameraX = Math.max(0, WORLD_WIDTH - visibleWorldWidth);
    const cameraX = clamp(desiredCameraX, 0, maxCameraX);

    const maxCameraY = Math.max(0, WORLD_HEIGHT - visibleWorldHeight);
    const cameraY = maxCameraY;

    ctx.setTransform(scale, 0, 0, scale, -cameraX * scale, -cameraY * scale);
  };

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    const clampedRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    ctx.beginPath();
    ctx.moveTo(x + clampedRadius, y);
    ctx.lineTo(x + width - clampedRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
    ctx.lineTo(x + width, y + height - clampedRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
    ctx.lineTo(x + clampedRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
    ctx.lineTo(x, y + clampedRadius);
    ctx.quadraticCurveTo(x, y, x + clampedRadius, y);
    ctx.closePath();
  };

  // Рисование машины (более «машинка», без обрезанных деталей)
  const drawCar = (ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number) => {
    const carImage = carImageRef.current;
    if (carImage && carImage.complete && carImage.naturalWidth > 0) {
      ctx.save();
      ctx.translate(x + CAR_WIDTH / 2, y + CAR_HEIGHT / 2);
      ctx.rotate(rotation);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(carImage, -CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(x + CAR_WIDTH / 2, y + CAR_HEIGHT / 2);
    ctx.rotate(rotation);

    const width = CAR_WIDTH;
    const height = CAR_HEIGHT;
    const wheelRadius = Math.max(3, Math.round(height * 0.22));
    const wheelCenterY = height / 2 - wheelRadius + 0.5;

    const bodyTop = -height / 2 + 6;
    const bodyBottom = wheelCenterY + wheelRadius - 1.25;
    const bodyHeight = Math.max(8, bodyBottom - bodyTop);

    // Тень под машинкой
    ctx.fillStyle = 'rgba(15, 23, 42, 0.10)';
    drawRoundedRect(ctx, -width / 2 + 2, wheelCenterY + wheelRadius - 2, width - 4, 4, 2);
    ctx.fill();

    // Корпус (основание)
    ctx.fillStyle = '#ef4444';
    drawRoundedRect(ctx, -width / 2, bodyTop, width, bodyHeight, 6);
    ctx.fill();

    // Тень снизу корпуса
    ctx.fillStyle = '#dc2626';
    drawRoundedRect(ctx, -width / 2, bodyTop + bodyHeight * 0.5, width, bodyHeight * 0.5, 6);
    ctx.fill();

    // Кабина (верх)
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 8, bodyTop + 2);
    ctx.lineTo(-width / 2 + 14, -height / 2 + 2);
    ctx.lineTo(width / 2 - 10, -height / 2 + 2);
    ctx.quadraticCurveTo(width / 2 - 4, -height / 2 + 3, width / 2 - 3, bodyTop + 8);
    ctx.lineTo(-width / 2 + 8, bodyTop + 8);
    ctx.closePath();
    ctx.fill();

    // Окна
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 15, bodyTop + 3);
    ctx.lineTo(-width / 2 + 18, -height / 2 + 4);
    ctx.lineTo(width / 2 - 12, -height / 2 + 4);
    ctx.quadraticCurveTo(width / 2 - 7, -height / 2 + 4.5, width / 2 - 7, bodyTop + 6.5);
    ctx.lineTo(-width / 2 + 15, bodyTop + 6.5);
    ctx.closePath();
    ctx.fill();

    // Блик на окне
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    drawRoundedRect(ctx, -width / 2 + 18, bodyTop + 4, 7, 2.5, 1.5);
    ctx.fill();

    // Бампер и фара (впереди)
    ctx.fillStyle = '#991b1b';
    drawRoundedRect(ctx, width / 2 - 6, bodyTop + bodyHeight * 0.55, 5.5, 5.5, 2.5);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(width / 2 - 4.5, bodyTop + bodyHeight * 0.55 + 2.75, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Колёса
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-width / 2 + 10, wheelCenterY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width / 2 - 10, wheelCenterY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();

    // Диски
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.arc(-width / 2 + 10, wheelCenterY, Math.max(1.5, wheelRadius - 2.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width / 2 - 10, wheelCenterY, Math.max(1.5, wheelRadius - 2.2), 0, Math.PI * 2);
    ctx.fill();

    // Лёгкий контур для читаемости
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, -width / 2, bodyTop, width, bodyHeight, 6);
    ctx.stroke();

    ctx.restore();
  };

  useEffect(() => {
    const img = new Image();
    img.decoding = 'async';
    img.src = carSpriteUrl;
    carImageRef.current = img;
    return () => {
      if (carImageRef.current === img) carImageRef.current = null;
    };
  }, []);

  // Рисование здания-препятствия
  const drawBuilding = (ctx: CanvasRenderingContext2D, x: number, topHeight: number, bottomHeight: number) => {
    // Верхнее здание
    ctx.fillStyle = '#4A5568';
    ctx.fillRect(x, 0, OBSTACLE_WIDTH, topHeight);

    // Окна верхнего здания
    ctx.fillStyle = '#FFE082';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < Math.ceil(topHeight / 20); j++) {
        ctx.fillRect(x + 10 + i * 24, 10 + j * 18, 12, 10);
        // Свет в окне
        if (Math.random() > 0.3) {
          ctx.fillStyle = '#FFF8DC';
          ctx.fillRect(x + 11 + i * 24, 11 + j * 18, 10, 8);
          ctx.fillStyle = '#FFE082';
        }
      }
    }

    // Крыша верхнего здания
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x, topHeight - 4, OBSTACLE_WIDTH, 4);

    // Нижнее здание
    ctx.fillStyle = '#36404F';
    ctx.fillRect(x, WORLD_HEIGHT - bottomHeight, OBSTACLE_WIDTH, bottomHeight);

    // Окна нижнего здания
    ctx.fillStyle = '#FFE082';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < Math.ceil(bottomHeight / 20); j++) {
        ctx.fillRect(x + 10 + i * 24, WORLD_HEIGHT - bottomHeight + 10 + j * 18, 12, 10);
        if (Math.random() > 0.2) {
          ctx.fillStyle = '#FFF8DC';
          ctx.fillRect(x + 11 + i * 24, WORLD_HEIGHT - bottomHeight + 11 + j * 18, 10, 8);
          ctx.fillStyle = '#FFE082';
        }
      }
    }

    // Крыша нижнего здания
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x, WORLD_HEIGHT - bottomHeight - 4, OBSTACLE_WIDTH, 4);
  };

  // Рисование облака-препятствия
  const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(x + 15, y, 15, 0, Math.PI * 2);
    ctx.arc(x + 35, y - 5, 18, 0, Math.PI * 2);
    ctx.arc(x + 55, y, 15, 0, Math.PI * 2);
    ctx.arc(x + 25, y + 10, 12, 0, Math.PI * 2);
    ctx.fill();

    // Тень облака
    ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
    ctx.fillRect(x, y + 8, OBSTACLE_WIDTH, 8);
  };

  const handleFlap = () => {
    if (gameStarted && !gameOver) {
      gameStateRef.current.carVelocity = FLAP_STRENGTH;
      playSound();
    } else if (!gameStarted) {
      startGame();
    }
  };

  const playSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Звук не поддерживается
    }
  };

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    gameStateRef.current = {
      carY: 150,
      carVelocity: 0,
      carRotation: 0,
      obstacles: [],
      score: 0
    };
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setScore(0);
    gameStateRef.current = {
      carY: 150,
      carVelocity: 0,
      carRotation: 0,
      obstacles: [],
      score: 0
    };
  };
  useEffect(() => {
    if (gameOver && score > 0) {
      onComplete?.();
    }
  }, [gameOver, score, onComplete]);

  // Начальное рисование canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    syncCanvasSize(canvas, ctx, 150);
    const t = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

    // Рисование фона
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Облака на фоне
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(50, 40, 20, 0, Math.PI * 2);
    ctx.arc(80, 35, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(400, 80, 22, 0, Math.PI * 2);
    ctx.arc(435, 75, 18, 0, Math.PI * 2);
    ctx.fill();

    // Земля
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(0, WORLD_HEIGHT - 25, WORLD_WIDTH, 25);

    // Декоративные кусты на земле
    ctx.fillStyle = '#228B22';
    ctx.fillRect(100, WORLD_HEIGHT - 30, 15, 8);
    ctx.fillRect(250, WORLD_HEIGHT - 30, 15, 8);
    ctx.fillRect(380, WORLD_HEIGHT - 30, 15, 8);

    // Рисовать машину в начальной позиции
    drawCar(ctx, CAR_X, 150, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = setInterval(() => {
      if (!gameStarted) return;

      syncCanvasSize(canvas, ctx, gameStateRef.current.carY);
      const t = ctx.getTransform();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

      const state = gameStateRef.current;

      // Применить гравитацию
      state.carVelocity += GRAVITY;
      state.carY += state.carVelocity;

      // Обновить ротацию машины
      state.carRotation = (state.carVelocity / 10) * 0.15;

      // Проверить столкновение с границами
      if (state.carY <= 0 || state.carY + CAR_HEIGHT >= WORLD_HEIGHT) {
        setGameOver(true);
        setGameStarted(false);
        playSound();
        onGameOver?.();
        return;
      }

      // Добавить препятствие
      if (state.obstacles.length === 0 || state.obstacles[state.obstacles.length - 1].x < WORLD_WIDTH - 250) {
        const gapStart = Math.random() * (WORLD_HEIGHT - GAP_HEIGHT - 150) + 75;
        const type = Math.random() > 0.6 ? 'cloud' : 'building';
        state.obstacles.push({
          x: WORLD_WIDTH,
          gap: gapStart,
          scored: false,
          type
        });
      }

      // Обновить препятствия
      state.obstacles = state.obstacles.filter(obs => {
        obs.x -= OBSTACLE_SPEED;

        // Проверка столкновения
        if (obs.type === 'building') {
          if (
            state.carY < obs.gap ||
            state.carY + CAR_HEIGHT > obs.gap + GAP_HEIGHT
          ) {
            if (obs.x < 60 && obs.x + OBSTACLE_WIDTH > 20) {
              setGameOver(true);
              setGameStarted(false);
              playSound();
              onGameOver?.();
            }
          }
        }

        // Добавить очки
        if (!obs.scored && obs.x + OBSTACLE_WIDTH < 60) {
          obs.scored = true;
          state.score++;
          setScore(state.score);
          setBestScore((prev) => {
            const next = Math.max(prev, state.score);
            try {
              localStorage.setItem('flappy-car-best', String(next));
            } catch {
              // ignore
            }
            return next;
          });
          playSound();
          onScore?.(state.score);
        }

        return obs.x > -OBSTACLE_WIDTH;
      });

      // Рисование фона
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Облака на фоне
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(50, 40, 20, 0, Math.PI * 2);
      ctx.arc(80, 35, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(400, 80, 22, 0, Math.PI * 2);
      ctx.arc(435, 75, 18, 0, Math.PI * 2);
      ctx.fill();

      // Земля
      ctx.fillStyle = '#90EE90';
      ctx.fillRect(0, WORLD_HEIGHT - 25, WORLD_WIDTH, 25);

      // Декоративные кусты на земле
      ctx.fillStyle = '#228B22';
      ctx.fillRect(100, WORLD_HEIGHT - 30, 15, 8);
      ctx.fillRect(250, WORLD_HEIGHT - 30, 15, 8);
      ctx.fillRect(380, WORLD_HEIGHT - 30, 15, 8);

      // Рисовать машину
      drawCar(ctx, CAR_X, state.carY, state.carRotation);

      // Рисовать препятствия
      state.obstacles.forEach(obs => {
        if (obs.type === 'building') {
          const topHeight = obs.gap;
          const bottomHeight = WORLD_HEIGHT - obs.gap - GAP_HEIGHT;
          drawBuilding(ctx, obs.x, topHeight, bottomHeight);
        } else {
          drawCloud(ctx, obs.x, obs.gap - 30);
        }
      });

      // HUD рисуется поверх canvas (в React), чтобы не было наслоений
    }, 1000 / 60);

    return () => clearInterval(gameLoop);
  }, [gameStarted]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleFlap();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver]);

  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-3xl bg-white">
        <canvas
          ref={canvasRef}
          width={WORLD_WIDTH}
          height={WORLD_HEIGHT}
          onClick={handleFlap}
          className="absolute inset-0 w-full h-full cursor-pointer"
        />

        {/* HUD */}
        <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+5.25rem)] z-10 flex -translate-x-1/2 flex-wrap justify-center gap-2 px-4 sm:top-[calc(env(safe-area-inset-top)+5.75rem)]">
          <div className="pointer-events-none flex items-center gap-2 bg-white/95 rounded-2xl px-4 py-2 shadow-md backdrop-blur-sm">
            <span className="text-gray-700 font-bold">Очки:</span>
            <span className="text-2xl font-bold text-red-600">{score}</span>
          </div>
          <div className="pointer-events-none flex items-center gap-2 bg-white/95 rounded-2xl px-4 py-2 shadow-md backdrop-blur-sm">
            <span className="text-gray-700 font-bold">Рекорд:</span>
            <span className="text-2xl font-bold text-purple-600">{bestScore}</span>
          </div>
        </div>

        {/* CTA / Status */}
        {!gameStarted && !gameOver ? (
          <div className="absolute inset-0 z-10 flex items-end justify-center pb-6">
            <button
              type="button"
              onClick={handleFlap}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transform hover:scale-105 transition shadow-md"
            >
              <Play className="w-5 h-5" />
              Начать игру
            </button>
          </div>
        ) : gameOver ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/10 backdrop-blur-[1px]">
            <div className="text-center text-gray-900 font-extrabold text-xl">
              Игра окончена!
            </div>
            <button
              type="button"
              onClick={resetGame}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transform hover:scale-105 transition shadow-md"
            >
              <RotateCcw className="w-5 h-5" />
              Заново
            </button>
          </div>
        ) : (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-center text-white/95 font-extrabold text-sm md:text-base bg-black/35 px-4 py-2 rounded-xl backdrop-blur-sm">
            Тап или SPACE для взлёта
          </div>
        )}
      </div>
    </div>
  );
};
