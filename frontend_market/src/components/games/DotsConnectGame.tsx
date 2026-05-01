import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { RotateCcw, Shuffle } from 'lucide-react';
import { DOT_TEMPLATES } from '../../constants/dotsTemplates';

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

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 250;
const HIT_RADIUS = 16;
const DOT_RADIUS = 6;
const DOT_COLOR = '#111827'; // gray-900
const DOT_DONE_COLOR = '#10b981'; // emerald-500
const DOT_NEXT_COLOR = '#111827';
const SILHOUETTE_COLOR = 'rgba(17, 24, 39, 0.10)';

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

      // Next expected dot
      if (connected.length === action.index) {
        const nextConnected = [...connected, action.index];
        const nextScore = nextConnected.length;
        return { connected: nextConnected, score: nextScore, completed: nextScore === action.dotCount };
      }

      // Tap last dot to undo
      if (last === action.index) {
        const nextConnected = connected.slice(0, -1);
        return { connected: nextConnected, score: nextConnected.length, completed: false };
      }

      return state;
    }
    default:
      return state;
  }
};

export const DotsConnectGame: React.FC<DotsGameProps> = ({ onScore, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completedNotifiedRef = useRef(false);

  const templates = DOT_TEMPLATES;
  const [templateIndex, setTemplateIndex] = useState(() => Math.floor(Math.random() * templates.length));
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [state, dispatch] = useReducer(reducer, { connected: [], score: 0, completed: false });

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

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (dots.length === 0) return;

    // Connected line
    if (state.connected.length > 1) {
      ctx.strokeStyle = state.completed ? '#10b981' : '#3b82f6';
      ctx.lineWidth = state.completed ? 3 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const connectedPoints = state.connected.map((idx) => dots[idx]).filter(Boolean);
      drawSmoothPolyline(ctx, connectedPoints);
      ctx.stroke();
    }

    // Faint silhouette of the full car outline
    if (!state.completed && dots.length > 2) {
      ctx.save();
      ctx.strokeStyle = SILHOUETTE_COLOR;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      drawSmoothPolyline(ctx, dots);
      // close back to start to make the silhouette continuous
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

      ctx.fillStyle = isConnected ? DOT_DONE_COLOR : isNext ? DOT_NEXT_COLOR : DOT_COLOR;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Arial';
      ctx.fillText((idx + 1).toString(), dot.x, dot.y);
    });
  }, [dots, state.connected, state.completed]);

  const mapEventToCanvasPoint = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const hitTestDotIndex = (x: number, y: number) => {
    if (dots.length === 0) return null;

    const nextIndex = state.connected.length;
    const lastIndex = state.connected.length > 0 ? state.connected[state.connected.length - 1] : null;

    // Prefer "next" dot when multiple dots are close to each other.
    if (nextIndex >= 0 && nextIndex < dots.length) {
      const nextDot = dots[nextIndex];
      if (Math.hypot(x - nextDot.x, y - nextDot.y) < HIT_RADIUS) return nextIndex;
    }

    // Then allow undo by tapping the last connected dot.
    if (lastIndex !== null && lastIndex >= 0 && lastIndex < dots.length) {
      const lastDot = dots[lastIndex];
      if (Math.hypot(x - lastDot.x, y - lastDot.y) < HIT_RADIUS) return lastIndex;
    }

    // Otherwise ignore taps near "wrong" dots (prevents accidental jumps).
    return null;
  };

  const hitAtEvent = (e: { clientX: number; clientY: number }) => {
    const point = mapEventToCanvasPoint(e);
    if (!point) return;
    const index = hitTestDotIndex(point.x, point.y);
    if (index === null) return;
    dispatch({ type: 'hit', index, dotCount: dots.length });
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

  const handlePointerUp = () => {
    setIsPointerDown(false);
  };

  const resetGame = () => {
    completedNotifiedRef.current = false;
    dispatch({ type: 'reset' });
  };

  const nextTemplate = () => {
    if (templates.length <= 1) return;
    const next = Math.floor(Math.random() * templates.length);
    setTemplateIndex(next === templateIndex ? (next + 1) % templates.length : next);
  };

  const hintText = useMemo(() => {
    if (state.completed) return null;
    return '👆 Нажимай (или веди пальцем) по точкам по порядку: 1, 2, 3…';
  }, [state.completed]);

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 text-center">
      <div className="flex items-center justify-between gap-3 mb-2 flex-shrink-0">
        <div className="text-left min-w-0">
          <p className="text-sm text-gray-500">
            Картинка: <span className="font-semibold text-gray-700">{template.title}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={nextTemplate}
            className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-600 disabled:opacity-40"
            title="Другая картинка"
            aria-label="Другая картинка"
            disabled={templates.length <= 1}
          >
            <Shuffle className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-600"
            title="Заново"
            aria-label="Заново"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col min-h-0 flex-1">
        <div className="w-full flex-shrink-0 mb-4">
          <div className="text-sm font-bold text-gray-900 mb-1">
            Прогресс: <span className="text-blue-600">{state.score}/{progressTotal}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${(state.score / Math.max(1, progressTotal)) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-end pb-4 min-h-0">
          <div className="w-full max-w-[720px] border-2 border-gray-300 rounded-2xl overflow-hidden bg-gray-50">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onClick={handleCanvasClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-auto cursor-crosshair touch-none"
            />
          </div>

          {state.completed ? (
            <div className="text-center mt-4">
              <div className="text-5xl mb-2">🎉</div>
              <p className="text-xl font-bold text-green-600">Отлично!</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
