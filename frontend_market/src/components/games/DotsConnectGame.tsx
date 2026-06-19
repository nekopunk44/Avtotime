import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { RotateCcw, Shuffle, Trophy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DOT_TEMPLATES, VIRTUAL_W, VIRTUAL_H } from '../../constants/dotsTemplates';

interface DotsGameProps {
  onScore?: (score: number) => void;
  onComplete?: () => void;
}

type Dot = { x: number; y: number };

type GameState = {
  connected: number[];
  score: number;
  completed: boolean;
};

type GameAction = { type: 'reset' } | { type: 'hit'; index: number; dotCount: number };

const HIT_RADIUS = 18; // in virtual coords
const DOT_RADIUS = 7;
const DOT_COLOR = '#1F2937';
const DOT_DONE_COLOR = '#10B981';
const DOT_NEXT_COLOR = '#2563EB';
const SILHOUETTE_COLOR = 'rgba(37, 99, 235, 0.18)';

const drawSmoothPolyline = (ctx: CanvasRenderingContext2D, points: Dot[]) => {
  if (points.length < 2) return;
  if (points.length === 2) {
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i];
    const next = points[i + 1];
    const midX = (prev.x + next.x) / 2;
    const midY = (prev.y + next.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
};

const reducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'reset':
      return { connected: [], score: 0, completed: false };
    case 'hit': {
      if (state.completed) return state;
      const connected = state.connected;
      const last = connected.length > 0 ? connected[connected.length - 1] : null;
      if (connected.length === action.index) {
        const next = [...connected, action.index];
        return { connected: next, score: next.length, completed: next.length === action.dotCount };
      }
      if (last === action.index) {
        const next = connected.slice(0, -1);
        return { connected: next, score: next.length, completed: false };
      }
      return state;
    }
    default:
      return state;
  }
};

export const DotsConnectGame: React.FC<DotsGameProps> = ({ onScore, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const completedNotifiedRef = useRef(false);

  const templates = DOT_TEMPLATES;
  const [templateIndex, setTemplateIndex] = useState(() => Math.floor(Math.random() * templates.length));
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [state, dispatch] = useReducer(reducer, { connected: [], score: 0, completed: false });

  // Display scale: virtual coord -> CSS pixel
  const [scale, setScale] = useState(1);

  const template = templates[templateIndex % templates.length];
  const dots = template.dots;
  const progressTotal = dots.length;

  useEffect(() => {
    onScore?.(state.score);
  }, [state.score, onScore]);

  useEffect(() => {
    if (state.completed && !completedNotifiedRef.current) {
      completedNotifiedRef.current = true;
      onComplete?.();
    }
  }, [state.completed, onComplete]);

  useEffect(() => {
    completedNotifiedRef.current = false;
    dispatch({ type: 'reset' });
  }, [template.id]);

  // Responsive canvas: keep aspect ratio, scale internal resolution with DPR.
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const update = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = el.clientWidth;
      if (cssW <= 0) return;
      const cssH = Math.round(cssW * (VIRTUAL_H / VIRTUAL_W));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Combine DPR scale with virtual-coord scale so drawing code can use raw virtual coords.
        const s = cssW / VIRTUAL_W;
        ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      }
      setScale(cssW / VIRTUAL_W);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear in virtual coords (transform already applied)
    ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    // Background
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    if (dots.length === 0) return;

    // Faint silhouette of full outline
    if (!state.completed && dots.length > 2) {
      ctx.save();
      ctx.strokeStyle = SILHOUETTE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      drawSmoothPolyline(ctx, dots);
      ctx.lineTo(dots[0].x, dots[0].y);
      ctx.stroke();
      ctx.restore();
    }

    // Connected line
    if (state.connected.length > 1) {
      ctx.save();
      ctx.strokeStyle = state.completed ? '#10B981' : '#2563EB';
      ctx.lineWidth = state.completed ? 3.5 : 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = state.completed ? 'rgba(16,185,129,0.4)' : 'rgba(37,99,235,0.35)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      const pts = state.connected.map((i) => dots[i]).filter(Boolean);
      drawSmoothPolyline(ctx, pts);
      ctx.stroke();
      ctx.restore();
    }

    // Close the loop with a soft line if completed
    if (state.completed && state.connected.length === dots.length) {
      ctx.save();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(16,185,129,0.4)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(dots[dots.length - 1].x, dots[dots.length - 1].y);
      ctx.lineTo(dots[0].x, dots[0].y);
      ctx.stroke();
      ctx.restore();
    }

    // Dots + labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    dots.forEach((dot, idx) => {
      const isConnected = state.connected.includes(idx);
      const isNext = !state.completed && idx === state.connected.length;

      // Halo for "next" dot
      if (isNext) {
        ctx.save();
        ctx.fillStyle = 'rgba(37,99,235,0.16)';
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = isConnected ? DOT_DONE_COLOR : isNext ? DOT_NEXT_COLOR : DOT_COLOR;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${dots.length > 30 ? 8 : 9}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(String(idx + 1), dot.x, dot.y + 0.5);
    });
  }, [dots, state.connected, state.completed, scale]);

  const mapEventToVirtual = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIRTUAL_W,
      y: ((e.clientY - rect.top) / rect.height) * VIRTUAL_H,
    };
  };

  const hitTestDotIndex = (x: number, y: number) => {
    if (dots.length === 0) return null;
    const nextIndex = state.connected.length;
    const lastIndex = state.connected.length > 0 ? state.connected[state.connected.length - 1] : null;

    if (nextIndex >= 0 && nextIndex < dots.length) {
      const d = dots[nextIndex];
      if (Math.hypot(x - d.x, y - d.y) < HIT_RADIUS) return nextIndex;
    }
    if (lastIndex !== null && lastIndex >= 0 && lastIndex < dots.length) {
      const d = dots[lastIndex];
      if (Math.hypot(x - d.x, y - d.y) < HIT_RADIUS) return lastIndex;
    }
    return null;
  };

  const hitAtEvent = (e: { clientX: number; clientY: number }) => {
    const p = mapEventToVirtual(e);
    if (!p) return;
    const idx = hitTestDotIndex(p.x, p.y);
    if (idx === null) return;
    dispatch({ type: 'hit', index: idx, dotCount: dots.length });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (state.completed) return;
    hitAtEvent(e);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (state.completed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPointerDown(true);
    hitAtEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDown || state.completed) return;
    hitAtEvent(e);
  };

  const handlePointerUp = () => setIsPointerDown(false);

  const resetGame = () => {
    completedNotifiedRef.current = false;
    dispatch({ type: 'reset' });
  };

  const nextTemplate = () => {
    if (templates.length <= 1) return;
    const next = Math.floor(Math.random() * templates.length);
    setTemplateIndex(next === templateIndex ? (next + 1) % templates.length : next);
  };

  const progressPct = useMemo(
    () => Math.round((state.score / Math.max(1, progressTotal)) * 100),
    [state.score, progressTotal]
  );

  return (
    <div className="flex flex-col bg-white p-3 sm:p-4">
      {/* Compact header */}
      <div className="flex items-center gap-2 flex-shrink-0 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[11px] text-gray-500 font-medium">Картинка:</span>
            <span className="text-sm font-bold text-gray-900 truncate">{template.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  state.completed ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-gray-600 tabular-nums flex-shrink-0">
              {state.score}/{progressTotal}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={nextTemplate}
          className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition text-gray-600 flex-shrink-0"
          title="Другая картинка"
          aria-label="Другая картинка"
          disabled={templates.length <= 1}
        >
          <Shuffle className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={resetGame}
          className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition text-gray-600 flex-shrink-0"
          title="Заново"
          aria-label="Заново"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas container — width-driven aspect ratio = no leftover space */}
      <div
        ref={containerRef}
        className="relative w-full border border-gray-200 rounded-2xl overflow-hidden bg-slate-50 flex-shrink-0"
        style={{ aspectRatio: `${VIRTUAL_W} / ${VIRTUAL_H}` }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="block touch-none cursor-pointer w-full h-full"
        />

        <AnimatePresence>
          {state.completed && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
              <motion.div
                className="relative rounded-2xl bg-white shadow-xl border border-emerald-100 px-5 py-4 flex items-center gap-3"
                initial={{ scale: 0.85, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-base font-bold text-gray-900">Готово!</div>
                  <div className="text-xs text-gray-500">Картинка собрана</div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 text-center text-[10px] text-gray-400 flex-shrink-0">
        Нажимай точки по порядку: 1 → 2 → 3 …
      </div>
    </div>
  );
};
