import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Settings, X } from 'lucide-react';

interface CarJumpGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
  onComplete?: () => void;
  onClose?: () => void;
}

type SkinId = 'sedan' | 'sport' | 'taxi' | 'police' | 'retro';

type Platform = {
  x: number;
  y: number;
  w: number;
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const roundedRectPath = (
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

export const CarJumpGame: React.FC<CarJumpGameProps> = ({ onScore, onGameOver, onComplete, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastMsRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const uiScoreRef = useRef<number>(0);
  const runningRef = useRef<boolean>(false);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [carSkin, setCarSkin] = useState<SkinId>('sedan');
  const [showSettings, setShowSettings] = useState(false);
  const carSkinRef = useRef<SkinId>('sedan');

  // Keep the visible playfield square (matches the modal layout).
  const W = 520;
  const H = 520;

  const physics = useMemo(
    () => ({
      gravity: 1400, // px/sec^2
      jumpV: -560,
      maxVX: 260,
      accel: 1200,
      friction: 0.92,
      carW: 34,
      carH: 18,
      platH: 10,
    }),
    []
  );

  const skins = useMemo(
    () => ({
      sedan: {
        name: 'Седан',
        body: '#e5e7eb',
        roof: '#9ca3af',
        accent: '#0ea5e9',
        window: 'rgba(226,232,240,0.9)',
        wheel: '#0b1220',
        outline: 'rgba(2,6,23,0.45)',
      },
      sport: {
        name: 'Спорт',
        body: '#22c55e',
        roof: '#0f172a',
        accent: '#eab308',
        window: 'rgba(226,232,240,0.9)',
        wheel: '#0b1220',
        outline: 'rgba(2,6,23,0.45)',
      },
      taxi: {
        name: 'Такси',
        body: '#f59e0b',
        roof: '#111827',
        accent: '#0ea5e9',
        window: 'rgba(240,249,255,0.9)',
        wheel: '#0b1220',
        outline: 'rgba(2,6,23,0.45)',
      },
      police: {
        name: 'Полиция',
        body: '#1e3a8a',
        roof: '#0b1220',
        accent: '#ef4444',
        window: 'rgba(219,234,254,0.9)',
        wheel: '#0b1220',
        outline: 'rgba(2,6,23,0.55)',
      },
      retro: {
        name: 'Ретро',
        body: '#ef4444',
        roof: '#7c2d12',
        accent: '#fbbf24',
        window: 'rgba(254,249,195,0.9)',
        wheel: '#0b1220',
        outline: 'rgba(2,6,23,0.45)',
      },
    }),
    []
  );

  const skinIds = useMemo(() => ['sedan', 'sport', 'taxi', 'police', 'retro'] as const, []);

  const stateRef = useRef({
    carX: W * 0.5,
    carY: H * 0.65,
    carVX: 0,
    carVY: 0,
    input: 0 as -1 | 0 | 1,
    platforms: [] as Platform[],
    seed: Math.random() * 10000,
    cleared: false,
  });

  const createPlatforms = () => {
    const plats: Platform[] = [];
    const rows = 10;
    const gap = H / rows;
    for (let i = 0; i < rows; i++) {
      const w = 80 + Math.floor(Math.random() * 60);
      const x = 40 + Math.random() * (W - 80 - w);
      const y = 40 + i * gap + Math.random() * 10;
      plats.push({ x, y, w });
    }
    plats.sort((a, b) => a.y - b.y);
    return plats;
  };

  const reset = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    runningRef.current = false;
    stateRef.current = {
      carX: W * 0.5,
      carY: H * 0.65,
      carVX: 0,
      carVY: physics.jumpV,
      input: 0,
      platforms: createPlatforms(),
      seed: Math.random() * 10000,
      cleared: false,
    };
    setScore(0);
    scoreRef.current = 0;
    uiScoreRef.current = 0;
    setGameOver(false);
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
      if (key === ' ' && !running && !gameOver) start();
      if (key === 'r') reset();
      if (key === 'escape') setShowSettings(false);
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
  }, [gameOver, running]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    carSkinRef.current = carSkin;
  }, [carSkin]);

  const drawCarWithSkin = (ctx: CanvasRenderingContext2D, skinId: SkinId, x: number, y: number, scale = 1) => {
    const skin = skins[skinId];

    const s = (v: number) => v * scale;
    const baseW = physics.carW * scale;
    const baseH = physics.carH * scale;

    const variant = {
      sedan: { width: 1.1, height: 1, roofX: 13, roofY: 3, roofW: 26, roofH: 10, nose: 6, tail: 7, wheelX1: 15, wheelX2: 33, wheelR: 5.5, yLift: 6 },
      sport: { width: 1.28, height: 0.88, roofX: 22, roofY: 4.5, roofW: 23, roofH: 7, nose: 10, tail: 5, wheelX1: 18, wheelX2: 42, wheelR: 5.3, yLift: 8 },
      taxi: { width: 1.16, height: 1, roofX: 14, roofY: 3, roofW: 27, roofH: 10, nose: 7, tail: 7, wheelX1: 15, wheelX2: 35, wheelR: 5.6, yLift: 6 },
      police: { width: 1.14, height: 1.14, roofX: 11, roofY: 2, roofW: 28, roofH: 12, nose: 6, tail: 6, wheelX1: 15, wheelX2: 34, wheelR: 6.3, yLift: 5 },
      retro: { width: 1.12, height: 1.05, roofX: 12, roofY: 4, roofW: 24, roofH: 10, nose: 5, tail: 8, wheelX1: 14, wheelX2: 33, wheelR: 5.8, yLift: 6 },
    }[skinId];

    const carW = baseW * variant.width;
    const carH = baseH * variant.height;
    const vx = x + (baseW - carW) / 2;
    const vy = y + s(variant.yLift);
    const wheelY = vy + carH + s(2.8);
    const wheelR = s(variant.wheelR);

    ctx.save();

    const bodyGradient = ctx.createLinearGradient(vx, vy, vx, vy + carH);
    bodyGradient.addColorStop(0, skin.body);
    bodyGradient.addColorStop(1, skinId === 'police' ? '#1d4ed8' : skinId === 'retro' ? '#dc2626' : skin.body);

    ctx.fillStyle = 'rgba(15,23,42,0.18)';
    ctx.beginPath();
    ctx.ellipse(vx + carW / 2, wheelY + s(5), carW * 0.34, s(4.4), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.moveTo(vx + s(variant.tail), vy + carH);
    ctx.quadraticCurveTo(vx + s(3), vy + carH, vx + s(2), vy + carH - s(5));
    ctx.lineTo(vx + s(5), vy + carH - s(10));
    ctx.quadraticCurveTo(vx + carW * 0.24, vy + s(1.5), vx + carW * 0.42, vy + s(1));
    ctx.lineTo(vx + carW * 0.68, vy + s(1));
    ctx.quadraticCurveTo(vx + carW * 0.82, vy + s(1.5), vx + carW - s(variant.nose + 4), vy + carH - s(11));
    ctx.lineTo(vx + carW - s(variant.nose), vy + carH - s(9));
    ctx.quadraticCurveTo(vx + carW - s(2), vy + carH - s(7), vx + carW - s(2), vy + carH - s(2));
    ctx.quadraticCurveTo(vx + carW - s(2), vy + carH, vx + carW - s(variant.nose), vy + carH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(vx + s(10), vy + carH - s(10));
    ctx.quadraticCurveTo(vx + carW * 0.32, vy + carH - s(15), vx + carW * 0.54, vy + carH - s(14));
    ctx.lineTo(vx + carW - s(12), vy + carH - s(11));
    ctx.lineTo(vx + carW - s(12), vy + carH - s(8));
    ctx.lineTo(vx + s(9), vy + carH - s(8));
    ctx.closePath();
    ctx.fill();

    const roofGradient = ctx.createLinearGradient(vx, vy, vx, vy + carH);
    roofGradient.addColorStop(0, 'rgba(255,255,255,0.18)');
    roofGradient.addColorStop(1, skin.roof);
    ctx.fillStyle = roofGradient;
    roundedRectPath(ctx, vx + s(variant.roofX), vy + s(variant.roofY), s(variant.roofW), s(variant.roofH), s(6));
    ctx.fill();

    ctx.fillStyle = skin.window;
    roundedRectPath(ctx, vx + s(variant.roofX + 2.4), vy + s(variant.roofY + 1.8), s(variant.roofW - 5), s(variant.roofH - 3.8), s(4));
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, s(1.2));
    ctx.beginPath();
    ctx.moveTo(vx + s(variant.roofX + 8), vy + s(variant.roofY + 2));
    ctx.lineTo(vx + s(variant.roofX + 8), vy + s(variant.roofY + variant.roofH - 1.2));
    ctx.stroke();

    ctx.fillStyle = skin.accent;
    if (skinId === 'sport') {
      roundedRectPath(ctx, vx + s(9), vy + carH - s(8.3), carW - s(18), s(2.8), s(2));
      ctx.fill();
      ctx.fillRect(vx + s(13), vy + carH - s(11.5), s(3), s(6));
      ctx.fillRect(vx + s(18), vy + carH - s(11.5), s(1.8), s(6));
    } else if (skinId === 'police') {
      roundedRectPath(ctx, vx + s(5), vy + carH - s(8.2), carW - s(10), s(3.4), s(2));
      ctx.fill();
    } else if (skinId === 'taxi') {
      roundedRectPath(ctx, vx + s(8), vy + carH - s(7.6), carW - s(16), s(3), s(2));
      ctx.fill();
    } else if (skinId === 'retro') {
      roundedRectPath(ctx, vx + s(7), vy + carH - s(7.3), carW - s(14), s(2.4), s(2));
      ctx.fill();
    } else {
      roundedRectPath(ctx, vx + s(8), vy + carH - s(7.8), s(5), s(3), s(2));
      ctx.fill();
    }

    if (skinId === 'taxi') {
      ctx.fillStyle = '#111827';
      roundedRectPath(ctx, vx + carW * 0.43, vy - s(1.5), s(12), s(5.6), s(2.4));
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.font = `900 ${Math.max(4, Math.round(s(4.4)))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText('TAXI', vx + carW * 0.43 + s(1.2), vy + s(2.2));
      ctx.fillStyle = 'rgba(17,24,39,0.85)';
      for (let i = 0; i < 6; i++) {
        if (i % 2 === 0) {
          ctx.fillRect(vx + s(10 + i * 3.4), vy + carH - s(12), s(2), s(2));
        }
      }
    }

    if (skinId === 'police') {
      ctx.fillStyle = '#0f172a';
      roundedRectPath(ctx, vx + carW * 0.42, vy - s(1.5), s(14), s(5.8), s(2.4));
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
      roundedRectPath(ctx, vx + carW * 0.42 + s(0.8), vy - s(0.8), s(5.8), s(4.2), s(2));
      ctx.fill();
      ctx.fillStyle = '#fb7185';
      roundedRectPath(ctx, vx + carW * 0.42 + s(7.1), vy - s(0.8), s(5.8), s(4.2), s(2));
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(vx + s(8.5), vy + carH - s(8.6), s(2.8), 0, Math.PI * 2);
      ctx.fill();
    }

    if (skinId === 'sport') {
      ctx.fillStyle = 'rgba(15,23,42,0.7)';
      roundedRectPath(ctx, vx + s(1), vy + carH - s(11), s(7), s(2.8), s(1.8));
      ctx.fill();
      ctx.fillRect(vx + s(3), vy + carH - s(8.5), s(1.5), s(3.8));
    }

    if (skinId === 'retro') {
      ctx.fillStyle = 'rgba(255,248,220,0.9)';
      roundedRectPath(ctx, vx + s(3), vy + carH - s(6.8), s(4), s(2.6), s(1.4));
      ctx.fill();
      roundedRectPath(ctx, vx + carW - s(7), vy + carH - s(6.8), s(4), s(2.6), s(1.4));
      ctx.fill();
    }

    ctx.fillStyle = skin.wheel;
    ctx.beginPath();
    ctx.arc(vx + s(variant.wheelX1), wheelY, wheelR, 0, Math.PI * 2);
    ctx.arc(vx + s(variant.wheelX2), wheelY, wheelR, 0, Math.PI * 2);
    ctx.fill();

    if (skinId === 'retro') {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(1.1, s(1.5));
      ctx.beginPath();
      ctx.arc(vx + s(variant.wheelX1), wheelY, wheelR - s(1.6), 0, Math.PI * 2);
      ctx.arc(vx + s(variant.wheelX2), wheelY, wheelR - s(1.6), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(vx + s(variant.wheelX1), wheelY, s(2.1), 0, Math.PI * 2);
    ctx.arc(vx + s(variant.wheelX2), wheelY, s(2.1), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, s(0.9));
    ctx.beginPath();
    ctx.arc(vx + s(variant.wheelX1), wheelY, wheelR - s(0.8), 0, Math.PI * 2);
    ctx.arc(vx + s(variant.wheelX2), wheelY, wheelR - s(0.8), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(239,68,68,0.85)';
    roundedRectPath(ctx, vx + s(1.8), vy + carH - s(8), s(2.8), s(3.4), s(1.2));
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundedRectPath(ctx, vx + carW - s(4.8), vy + carH - s(8), s(2.8), s(3.4), s(1.2));
    ctx.fill();

    ctx.strokeStyle = skin.outline;
    ctx.lineWidth = Math.max(1.2, s(1.7));
    ctx.beginPath();
    ctx.moveTo(vx + s(variant.tail), vy + carH);
    ctx.quadraticCurveTo(vx + s(3), vy + carH, vx + s(2), vy + carH - s(5));
    ctx.lineTo(vx + s(5), vy + carH - s(10));
    ctx.quadraticCurveTo(vx + carW * 0.24, vy + s(1.5), vx + carW * 0.42, vy + s(1));
    ctx.lineTo(vx + carW * 0.68, vy + s(1));
    ctx.quadraticCurveTo(vx + carW * 0.82, vy + s(1.5), vx + carW - s(variant.nose + 4), vy + carH - s(11));
    ctx.lineTo(vx + carW - s(variant.nose), vy + carH - s(9));
    ctx.quadraticCurveTo(vx + carW - s(2), vy + carH - s(7), vx + carW - s(2), vy + carH - s(2));
    ctx.quadraticCurveTo(vx + carW - s(2), vy + carH, vx + carW - s(variant.nose), vy + carH);
    ctx.closePath();
    ctx.stroke();

    roundedRectPath(ctx, vx + s(variant.roofX), vy + s(variant.roofY), s(variant.roofW), s(variant.roofH), s(6));
    ctx.stroke();
    ctx.restore();
  };

  const drawCarModel = (ctx: CanvasRenderingContext2D, skinId: SkinId, x: number, y: number, scale = 1) => {
    const skin = skins[skinId];
    const s = (v: number) => v * scale;
    const baseW = physics.carW * scale;
    const variant = {
      sedan: { width: 1.14, wheelX1: 15, wheelX2: 33, wheelR: 4.7 },
      sport: { width: 1.3, wheelX1: 18, wheelX2: 42, wheelR: 4.5 },
      taxi: { width: 1.18, wheelX1: 15, wheelX2: 35, wheelR: 4.8 },
      police: { width: 1.22, wheelX1: 16, wheelX2: 36, wheelR: 5.1 },
      retro: { width: 1.2, wheelX1: 15, wheelX2: 35, wheelR: 4.9 },
    }[skinId];

    const carW = baseW * variant.width;
    const vx = x + (baseW - carW) / 2;
    const vy = y + s(3.5);
    const wheelY = vy + s(20.2);
    const wheelXs = [vx + s(variant.wheelX1), vx + s(variant.wheelX2)];
    const wheelR = s(variant.wheelR);

    const drawShape = (points: Array<[number, number]>, fill: string, stroke = skin.outline) => {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1, s(1.25));
      ctx.stroke();
    };

    const drawWindow = (wx: number, wy: number, ww: number, wh: number, radius: number) => {
      roundedRectPath(ctx, wx, wy, ww, wh, radius);
      ctx.fillStyle = skin.window;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(0.8, s(0.9));
      ctx.stroke();
    };

    ctx.save();

    ctx.fillStyle = 'rgba(15,23,42,0.15)';
    ctx.beginPath();
    ctx.ellipse(vx + carW / 2, wheelY + s(4), carW * 0.34, s(3.1), 0, 0, Math.PI * 2);
    ctx.fill();

    if (skinId === 'sedan') {
      drawShape(
        [
          [vx + s(4), vy + s(18)],
          [vx + s(10), vy + s(11)],
          [vx + s(20), vy + s(7)],
          [vx + carW - s(16), vy + s(7)],
          [vx + carW - s(8), vy + s(11)],
          [vx + carW - s(4), vy + s(18)],
          [vx + carW - s(10), vy + s(20)],
          [vx + s(10), vy + s(20)],
        ],
        skin.body
      );
      drawWindow(vx + s(15), vy + s(8.6), carW - s(30), s(6.2), s(3));
      ctx.strokeStyle = 'rgba(15,23,42,0.2)';
      ctx.lineWidth = Math.max(0.8, s(0.9));
      ctx.beginPath();
      ctx.moveTo(vx + carW / 2, vy + s(9));
      ctx.lineTo(vx + carW / 2, vy + s(15.8));
      ctx.stroke();
      ctx.fillStyle = skin.accent;
      roundedRectPath(ctx, vx + s(6), vy + s(14), s(4.2), s(5.4), s(1.7));
      ctx.fill();
    } else if (skinId === 'sport') {
      drawShape(
        [
          [vx + s(3), vy + s(18)],
          [vx + s(14), vy + s(16.5)],
          [vx + s(26), vy + s(8.5)],
          [vx + carW - s(22), vy + s(6.8)],
          [vx + carW - s(10), vy + s(11.5)],
          [vx + carW - s(4), vy + s(18)],
          [vx + carW - s(10), vy + s(20)],
          [vx + s(10), vy + s(20)],
        ],
        skin.body
      );
      drawWindow(vx + s(24), vy + s(8.5), carW - s(43), s(5), s(2.6));
      ctx.fillStyle = skin.accent;
      roundedRectPath(ctx, vx + s(15), vy + s(15.4), carW - s(30), s(2.2), s(1.1));
      ctx.fill();
      ctx.fillRect(vx + s(19), vy + s(10.4), s(2.1), s(7.2));
      ctx.fillRect(vx + s(23.2), vy + s(10.4), s(1.5), s(7.2));
      ctx.fillStyle = 'rgba(2,6,23,0.6)';
      roundedRectPath(ctx, vx + s(0.6), vy + s(12.8), s(7), s(2.2), s(1.2));
      ctx.fill();
      ctx.fillRect(vx + s(2.2), vy + s(14.8), s(1.2), s(2.8));
    } else if (skinId === 'taxi') {
      drawShape(
        [
          [vx + s(4), vy + s(18)],
          [vx + s(11), vy + s(10.5)],
          [vx + s(22), vy + s(7)],
          [vx + carW - s(15), vy + s(7)],
          [vx + carW - s(7), vy + s(11.3)],
          [vx + carW - s(4), vy + s(18)],
          [vx + carW - s(9), vy + s(20)],
          [vx + s(9), vy + s(20)],
        ],
        skin.body
      );
      drawWindow(vx + s(15), vy + s(8.4), carW - s(29), s(6.2), s(3));
      ctx.fillStyle = 'rgba(17,24,39,0.85)';
      for (let i = 0; i < 5; i += 1) {
        if (i % 2 === 0) ctx.fillRect(vx + s(11 + i * 3), vy + s(15.3), s(1.7), s(1.7));
      }
      ctx.fillStyle = '#111827';
      roundedRectPath(ctx, vx + carW / 2 - s(6), vy + s(1.4), s(12), s(4.4), s(1.8));
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.font = `900 ${Math.max(3.6, Math.round(s(3.8)))}px Inter, Segoe UI, Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TAXI', vx + carW / 2, vy + s(3.7));
    } else if (skinId === 'police') {
      drawShape(
        [
          [vx + s(4), vy + s(18)],
          [vx + s(8), vy + s(10)],
          [vx + s(18), vy + s(6.7)],
          [vx + carW - s(18), vy + s(6.7)],
          [vx + carW - s(8), vy + s(10)],
          [vx + carW - s(4), vy + s(18)],
          [vx + carW - s(7), vy + s(20.5)],
          [vx + s(7), vy + s(20.5)],
        ],
        skin.body
      );
      drawWindow(vx + s(13.5), vy + s(8), carW - s(27), s(6.8), s(2.6));
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundedRectPath(ctx, vx + s(7), vy + s(14.1), carW - s(14), s(3.1), s(1.5));
      ctx.fill();
      ctx.fillStyle = skin.accent;
      roundedRectPath(ctx, vx + s(7), vy + s(15.8), carW - s(14), s(1.7), s(0.8));
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      roundedRectPath(ctx, vx + carW / 2 - s(6.7), vy + s(1.2), s(13.4), s(4.2), s(1.8));
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
      roundedRectPath(ctx, vx + carW / 2 - s(5.8), vy + s(1.7), s(5), s(3), s(1.2));
      ctx.fill();
      ctx.fillStyle = '#fb7185';
      roundedRectPath(ctx, vx + carW / 2 + s(0.8), vy + s(1.7), s(5), s(3), s(1.2));
      ctx.fill();
    } else {
      drawShape(
        [
          [vx + s(4), vy + s(18)],
          [vx + s(9), vy + s(11)],
          [vx + s(18), vy + s(7)],
          [vx + carW - s(18), vy + s(7)],
          [vx + carW - s(9), vy + s(11)],
          [vx + carW - s(4), vy + s(18)],
          [vx + carW - s(8), vy + s(20.5)],
          [vx + s(8), vy + s(20.5)],
        ],
        skin.body
      );
      drawWindow(vx + s(14.5), vy + s(8.5), carW - s(29), s(5.8), s(3.4));
      ctx.fillStyle = 'rgba(124,45,18,0.9)';
      roundedRectPath(ctx, vx + s(13), vy + s(6.5), carW - s(26), s(3.3), s(1.7));
      ctx.fill();
      ctx.fillStyle = skin.accent;
      roundedRectPath(ctx, vx + s(7), vy + s(15.6), carW - s(14), s(1.8), s(0.9));
      ctx.fill();
      ctx.fillStyle = 'rgba(226,232,240,0.9)';
      roundedRectPath(ctx, vx + s(3), vy + s(15.4), s(4.5), s(2.2), s(1));
      ctx.fill();
      roundedRectPath(ctx, vx + carW - s(7.5), vy + s(15.4), s(4.5), s(2.2), s(1));
      ctx.fill();
    }

    for (const wheelX of wheelXs) {
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(wheelX, wheelY, wheelR, 0, Math.PI * 2);
      ctx.fill();

      if (skinId === 'retro') {
        ctx.strokeStyle = 'rgba(255,255,255,0.82)';
        ctx.lineWidth = Math.max(0.9, s(1));
        ctx.beginPath();
        ctx.arc(wheelX, wheelY, wheelR - s(1.1), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(226,232,240,0.55)';
      ctx.beginPath();
      ctx.arc(wheelX, wheelY, Math.max(s(1.4), wheelR * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,248,220,0.95)';
    roundedRectPath(ctx, vx + carW - s(4.6), vy + s(14.1), s(2.6), s(2.9), s(1));
    ctx.fill();
    ctx.fillStyle = 'rgba(248,113,113,0.95)';
    roundedRectPath(ctx, vx + s(2), vy + s(14.1), s(2.4), s(2.9), s(1));
    ctx.fill();

    ctx.restore();
  };

  const CarSkinPreview: React.FC<{ skinId: SkinId; active: boolean; width?: number; height?: number }> = ({
    skinId,
    active,
    width = 140,
    height = 64,
  }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const ctx = el.getContext('2d');
      if (!ctx) return;

      const w = el.width;
      const h = el.height;
      const previewScale = Math.min(w / 140, h / 64);
      const px = (value: number) => value * previewScale;
      const py = (value: number) => value * previewScale;

      ctx.clearRect(0, 0, w, h);

      const previewGradient = ctx.createLinearGradient(0, 0, 0, h);
      previewGradient.addColorStop(0, active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.98)');
      previewGradient.addColorStop(1, active ? 'rgba(148,163,184,0.16)' : 'rgba(241,245,249,0.96)');
      ctx.fillStyle = previewGradient;
      roundedRectPath(ctx, 0, 0, w, h, py(16));
      ctx.fill();

      ctx.strokeStyle = active ? 'rgba(255,255,255,0.18)' : 'rgba(148,163,184,0.20)';
      ctx.lineWidth = 1;
      roundedRectPath(ctx, 0.5, 0.5, w - 1, h - 1, py(16));
      ctx.stroke();

      ctx.fillStyle = active ? 'rgba(255,255,255,0.22)' : 'rgba(148,163,184,0.12)';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h - py(7), px(46), py(4.8), 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(px(18), py(10));
      ctx.scale(previewScale, previewScale);

      let bodyPath = new Path2D();
      let roofPath = new Path2D();
      let accentRects: Array<[number, number, number, number]> = [];

      if (skinId === 'sport') {
        bodyPath = new Path2D('M 6 23 Q 12 12 24 12 L 44 5 Q 57 1 71 6 L 88 16 Q 98 17 104 23 L 100 29 L 14 29 Q 8 28 6 23 Z');
        roofPath = new Path2D('M 37 16 L 47 8 Q 57 4 65 8 L 74 15 L 66 19 L 42 19 Z');
        accentRects = [
          [16, 20, 11, 2.5],
          [31, 20, 8, 2.5],
          [18, 23.5, 8, 1.8],
        ];
      } else if (skinId === 'taxi') {
        bodyPath = new Path2D('M 6 23 Q 12 11 22 11 L 33 5 L 76 5 L 88 11 L 100 11 Q 104 13 104 19 L 101 29 L 14 29 Q 8 28 6 23 Z');
        roofPath = new Path2D('M 33 16 L 42 8 L 70 8 L 79 16 L 72 20 L 40 20 Z');
      } else if (skinId === 'police') {
        bodyPath = new Path2D('M 6 24 Q 9 10 19 10 L 27 4 L 78 4 L 88 10 L 100 10 Q 104 12 104 18 L 102 29 L 13 29 Q 7 28 6 24 Z');
        roofPath = new Path2D('M 31 16 L 31 8 Q 31 5 34 5 L 70 5 Q 74 5 74 8 L 74 16 L 67 20 L 38 20 Z');
      } else if (skinId === 'retro') {
        bodyPath = new Path2D('M 7 24 Q 11 9 25 9 L 36 4 Q 52 -1 69 3 L 86 10 Q 102 12 104 24 L 100 29 L 14 29 Q 8 28 7 24 Z');
        roofPath = new Path2D('M 36 17 Q 39 6 48 5 L 63 5 Q 72 6 75 17 L 68 20 L 42 20 Z');
        accentRects = [[18, 21.5, 68, 1.7]];
      } else {
        bodyPath = new Path2D('M 6 23 Q 10 12 20 12 L 31 6 L 80 6 L 91 12 L 100 12 Q 104 14 104 20 L 101 29 L 14 29 Q 8 28 6 23 Z');
        roofPath = new Path2D('M 31 17 L 39 8 L 70 8 L 78 17 L 72 20 L 37 20 Z');
        accentRects = [
          [17, 20, 8, 3],
          [28, 20, 5, 3],
        ];
      }

      ctx.fillStyle = skins[skinId].body;
      ctx.fill(bodyPath);
      ctx.strokeStyle = active ? 'rgba(15,23,42,0.18)' : 'rgba(15,23,42,0.14)';
      ctx.lineWidth = 1.4;
      ctx.stroke(bodyPath);

      ctx.fillStyle = skins[skinId].roof;
      ctx.fill(roofPath);

      ctx.fillStyle = skins[skinId].window;
      ctx.fill(new Path2D('M 41 9 L 53 9 L 56 17 L 42 17 Z'));
      ctx.fill(new Path2D('M 57 9 L 69 9 L 72 17 L 59 17 Z'));

      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(56.5, 9.5);
      ctx.lineTo(57.5, 17.2);
      ctx.stroke();

      ctx.fillStyle = skins[skinId].accent;
      accentRects.forEach(([ax, ay, aw, ah]) => ctx.fillRect(ax, ay, aw, ah));

      if (skinId === 'taxi') {
        for (let index = 0; index < 5; index += 1) {
          ctx.fillStyle = index % 2 === 0 ? '#111827' : '#f8fafc';
          ctx.fillRect(26 + index * 4.2, 20.5, 3.2, 3.2);
        }
        ctx.fillStyle = '#111827';
        roundedRectPath(ctx, 47, 1.5, 18, 7, 3);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.font = '900 5.8px system-ui, -apple-system, Segoe UI, Roboto, Arial';
        ctx.fillText('TAXI', 49.4, 6.8);
      }

      if (skinId === 'police') {
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(19, 19.8, 24, 3.2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(43, 19.8, 29, 3.2);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(72, 19.8, 18, 3.2);

        ctx.fillStyle = '#0f172a';
        roundedRectPath(ctx, 47, 1, 17, 6.5, 3);
        ctx.fill();
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(49, 2.2, 6.5, 3.6);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(56, 2.2, 6.5, 3.6);
      }

      if (skinId === 'sport') {
        ctx.fillStyle = 'rgba(15,23,42,0.72)';
        ctx.beginPath();
        ctx.moveTo(8, 20);
        ctx.lineTo(2.5, 16);
        ctx.lineTo(8, 16.4);
        ctx.closePath();
        ctx.fill();
      }

      if (skinId === 'retro') {
        ctx.fillStyle = 'rgba(255,248,220,0.9)';
        roundedRectPath(ctx, 5, 21, 4.2, 2.4, 1.2);
        ctx.fill();
        roundedRectPath(ctx, 96, 21, 4.2, 2.4, 1.2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(239,68,68,0.88)';
      roundedRectPath(ctx, 4.5, 18.4, 3.2, 4.1, 1.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundedRectPath(ctx, 99.2, 18.4, 3.2, 4.1, 1.2);
      ctx.fill();

      ctx.fillStyle = skins[skinId].wheel;
      ctx.beginPath();
      ctx.arc(30, 28, 8.5, 0, Math.PI * 2);
      ctx.arc(80, 28, 8.5, 0, Math.PI * 2);
      ctx.fill();

      if (skinId === 'retro') {
        ctx.strokeStyle = 'rgba(255,248,220,0.82)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(30, 28, 5.5, 0, Math.PI * 2);
        ctx.arc(80, 28, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.74)';
      ctx.beginPath();
      ctx.arc(30, 28, 2.2, 0, Math.PI * 2);
      ctx.arc(80, 28, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = active ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.54)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px(10), py(12));
      ctx.quadraticCurveTo(px(48), py(-3), px(96), py(10));
      ctx.stroke();
    }, [skinId, active, width, height]);

    return (
      <canvas
        ref={ref}
        width={width}
        height={height}
        className="block rounded-xl"
        aria-hidden="true"
      />
    );
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, W, H);

    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#0b1220');
    grd.addColorStop(1, '#111827');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 22; i++) {
      const x = ((i * 97.3 + stateRef.current.seed) % W + W) % W;
      const y = ((i * 53.7 + stateRef.current.seed * 0.7) % H + H) % H;
      ctx.beginPath();
      ctx.arc(x, y, (i % 3) + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // platforms
    for (const p of stateRef.current.platforms) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(p.x, p.y, p.w, physics.platH);
      ctx.fillStyle = 'rgba(147,197,253,0.35)';
      ctx.fillRect(p.x, p.y, p.w, 3);
    }

    // car
    const { carX, carY } = stateRef.current;
    const x = carX - physics.carW / 2;
    const y = carY - physics.carH / 2;

    drawCarModel(ctx, carSkinRef.current, x, y);
  };

  const ensurePlatforms = () => {
    const plats = stateRef.current.platforms;
    plats.sort((a, b) => a.y - b.y);
    while (plats.length < 14) {
      const topY = plats[0]?.y ?? 40;
      const w = 75 + Math.floor(Math.random() * 70);
      const x = 30 + Math.random() * (W - 60 - w);
      const y = topY - (38 + Math.random() * 45);
      plats.unshift({ x, y, w });
    }
  };

  const step = (ms: number) => {
    if (!runningRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (!lastMsRef.current) lastMsRef.current = ms;
    const dt = clamp((ms - lastMsRef.current) / 1000, 0, 0.033);
    lastMsRef.current = ms;

    const s = stateRef.current;

    // input -> acceleration
    const target = s.input * physics.maxVX;
    const delta = target - s.carVX;
    s.carVX += clamp(delta, -physics.accel * dt, physics.accel * dt);
    if (s.input === 0) s.carVX *= physics.friction;

    s.carVY += physics.gravity * dt;
    s.carX += s.carVX * dt;
    s.carY += s.carVY * dt;

    // wrap X
    if (s.carX < -physics.carW / 2) s.carX = W + physics.carW / 2;
    if (s.carX > W + physics.carW / 2) s.carX = -physics.carW / 2;

    // collisions (only when falling)
    if (s.carVY > 0) {
      const carLeft = s.carX - physics.carW / 2;
      const carRight = s.carX + physics.carW / 2;
      const carBottom = s.carY + physics.carH / 2;
      const prevBottom = carBottom - s.carVY * dt;
      for (const p of s.platforms) {
        const pTop = p.y;
        const withinX = carRight > p.x && carLeft < p.x + p.w;
        const crosses = prevBottom <= pTop && carBottom >= pTop;
        if (withinX && crosses && carBottom <= pTop + 18) {
          s.carY = pTop - physics.carH / 2;
          s.carVY = physics.jumpV;
          break;
        }
      }
    }

    // camera shift
    const lockY = H * 0.45;
    if (s.carY < lockY) {
      const dy = lockY - s.carY;
      s.carY = lockY;
      for (const p of s.platforms) p.y += dy;
      scoreRef.current += dy;
      const next = Math.floor(scoreRef.current / 10);
      if (next !== uiScoreRef.current) {
        uiScoreRef.current = next;
        setScore(next);
        onScore?.(next);
      }
    }

    // cleanup
    s.platforms = s.platforms.filter((p) => p.y < H + 60);
    ensurePlatforms();

    // win condition (just for fun)
    if (!s.cleared && uiScoreRef.current >= 500) {
      s.cleared = true;
      onComplete?.();
    }

    // game over
    if (s.carY > H + 80) {
      runningRef.current = false;
      setRunning(false);
      setGameOver(true);
      setTimeout(() => onGameOver?.(), 0);
    }

    draw(ctx);
    if (runningRef.current) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      rafRef.current = null;
    }
  };

  const start = () => {
    if (runningRef.current) return;
    if (gameOver) reset();
    runningRef.current = true;
    setRunning(true);
    lastMsRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    draw(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, running, gameOver]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleTouch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (showSettings) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.33) stateRef.current.input = -1;
    else if (x > rect.width * 0.66) stateRef.current.input = 1;
    else stateRef.current.input = 0;
  };

  const handleTouchEnd = () => {
    stateRef.current.input = 0;
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      <h2 className="sr-only">Car Jump</h2>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={handleTouch}
        onPointerMove={(e) => running && handleTouch(e)}
        onPointerUp={handleTouchEnd}
        onPointerLeave={handleTouchEnd}
        className="touch-none block w-full h-full select-none"
      />

      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-2xl bg-black/40 px-4 py-2 text-white font-extrabold backdrop-blur-sm">
        Высота: <span className="tabular-nums">{score}</span> м
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute left-4 top-4 inline-flex items-center justify-center rounded-2xl bg-black/35 p-2.5 text-white/90 backdrop-blur-sm hover:bg-black/45 transition disabled:opacity-40"
        aria-label="Закрыть игру"
        disabled={!onClose}
      >
        <X className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className="absolute right-4 top-4 inline-flex items-center justify-center rounded-2xl bg-black/35 p-2.5 text-white/90 backdrop-blur-sm hover:bg-black/45 transition"
        aria-label="Настройки"
      >
        <Settings className="w-5 h-5" />
      </button>

      {gameOver ? (
        <div className="absolute inset-x-4 top-4 rounded-2xl border border-red-100 bg-red-50/95 px-5 py-4 text-red-700 font-semibold shadow-sm">
          Игра окончена. Высота: <span className="font-black tabular-nums">{score}</span> м
        </div>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 pointer-events-none">
        <div className="mx-auto w-full max-w-[520px] rounded-2xl bg-black/40 p-3 backdrop-blur-sm pointer-events-auto">
          {!running ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={start}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-extrabold hover:bg-blue-700 transition"
              >
                <Play className="w-5 h-5" fill="currentColor" />
                Старт
              </button>

              <button
                type="button"
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-extrabold hover:bg-black transition"
              >
                <RotateCcw className="w-5 h-5" />
                Сброс
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={reset}
                className="w-[min(320px,100%)] flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-extrabold hover:bg-black transition"
              >
                <RotateCcw className="w-5 h-5" />
                Сброс
              </button>
            </div>
          )}
        </div>
      </div>

      {showSettings ? (
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[560px] rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="text-lg font-extrabold text-gray-900">Настройки</div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="inline-flex items-center justify-center rounded-2xl p-2 text-gray-600 hover:bg-gray-100 transition"
                aria-label="Закрыть настройки"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="text-sm font-extrabold text-gray-900 mb-2">Выбор машинки</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {skinIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCarSkin(id)}
                      className={`rounded-[22px] p-3.5 text-left transition border ${
                        carSkin === id
                          ? 'bg-gray-900 text-white border-gray-900 shadow-md shadow-gray-900/15'
                          : 'bg-white text-gray-900 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                      aria-pressed={carSkin === id}
                    >
                      <div className={`rounded-2xl px-2 py-2.5 min-h-[82px] flex items-center justify-center ${carSkin === id ? 'bg-white/10' : 'bg-slate-50'}`}>
                        <CarSkinPreview skinId={id} active={carSkin === id} width={152} height={72} />
                      </div>
                      <div className="mt-2.5 text-[15px] font-extrabold tracking-[-0.01em]">{skins[id].name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-extrabold text-gray-900 mb-2">Правила</div>
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-[14px] leading-relaxed text-gray-700">
                  Нажми <span className="font-extrabold">Пробел</span> или кнопку <span className="font-extrabold">Старт</span>, чтобы начать.
                  Управление: <span className="font-extrabold">←/→</span> или <span className="font-extrabold">A/D</span>. На телефоне — тап по краям экрана.
                  Чем выше поднимаешься, тем больше высота.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
