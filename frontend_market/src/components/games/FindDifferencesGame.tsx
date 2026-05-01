import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface DifferencesGameProps {
  theme?: 1 | 2 | 3 | 4;
  onScore?: (score: number) => void;
  onComplete?: () => void;
}

type Diff = { id: number; x: number; y: number; r: number; desc: string };

const THEMES: Record<1 | 2 | 3 | 4, { title: string; subtitle: string; body: string; accent: string; bg: string }> = {
  1: { title: 'Найди отличия: Город', subtitle: '2 картинки, 5 отличий', body: '#3b82f6', accent: '#f97316', bg: '#e0f2fe' },
  2: { title: 'Найди отличия: Пожарная', subtitle: '2 картинки, 5 отличий', body: '#ef4444', accent: '#fde047', bg: '#fee2e2' },
  3: { title: 'Найди отличия: Скорая', subtitle: '2 картинки, 5 отличий', body: '#ffffff', accent: '#22c55e', bg: '#ecfeff' },
  4: { title: 'Найди отличия: Зверушки', subtitle: '2 картинки, 5 отличий', body: '#a78bfa', accent: '#22c55e', bg: '#f5f3ff' },
};

const DIFFERENCES: Diff[] = [
  { id: 0, x: 112, y: 88, r: 22, desc: 'Зеркало' },
  { id: 1, x: 300, y: 128, r: 20, desc: 'Фара' },
  { id: 2, x: 132, y: 194, r: 20, desc: 'Колесо' },
  { id: 3, x: 238, y: 176, r: 22, desc: 'Бампер' },
  { id: 4, x: 198, y: 92, r: 24, desc: 'Крыша' },
];

const CarScene: React.FC<{
  theme: 1 | 2 | 3 | 4;
  variant: 1 | 2;
  found: number[];
}> = ({ theme, variant, found }) => {
  const t = THEMES[theme];
  const show = (id: number) => found.includes(id);

  const mirror = variant === 2 ? null : <rect x="96" y="82" width="14" height="10" rx="5" fill="#111827" opacity={0.9} />;
  const headlight = (
    <circle cx="304" cy="126" r={variant === 2 ? 8 : 6} fill={variant === 2 ? t.accent : '#fde047'} stroke="#111827" strokeWidth="2" />
  );
  const wheel = (
    <circle cx="132" cy="194" r={variant === 2 ? 14 : 16} fill="#0f172a" />
  );
  const bumper = (
    <rect x="210" y="166" width="70" height="10" rx="5" fill={variant === 2 ? t.accent : '#9ca3af'} stroke="#111827" strokeWidth="2" />
  );
  const roof = (
    <path
      d={variant === 2 ? 'M130 118 C144 92, 180 82, 218 92 C232 96, 246 104, 258 118 Z' : 'M122 118 C140 88, 180 76, 226 88 C244 94, 262 104, 272 118 Z'}
      fill={variant === 2 ? '#93c5fd' : '#bfdbfe'}
      stroke="#111827"
      strokeWidth="3"
      opacity={0.95}
    />
  );

  return (
    <svg viewBox="0 0 400 250" className="w-full border-2 border-gray-300 rounded-2xl bg-white">
      <rect x="0" y="0" width="400" height="250" fill={t.bg} />
      <rect x="0" y="184" width="400" height="66" fill="#e2e8f0" />
      <rect x="0" y="198" width="400" height="10" fill="#cbd5e1" />

      {/* simple background */}
      {theme === 1 ? (
        <>
          <rect x="26" y="74" width="54" height="110" rx="10" fill="#c7d2fe" />
          <rect x="92" y="48" width="70" height="136" rx="10" fill="#bae6fd" />
          <rect x="174" y="64" width="54" height="120" rx="10" fill="#bbf7d0" />
        </>
      ) : theme === 2 ? (
        <path d="M50 170 C90 120, 150 120, 190 170" fill="none" stroke="#fb7185" strokeWidth="10" opacity={0.35} />
      ) : theme === 3 ? (
        <path d="M70 140 C110 100, 170 100, 210 140" fill="none" stroke="#22c55e" strokeWidth="10" opacity={0.28} />
      ) : (
        <>
          <circle cx="56" cy="72" r="18" fill="#bbf7d0" />
          <circle cx="88" cy="70" r="14" fill="#a7f3d0" />
          <circle cx="78" cy="52" r="12" fill="#86efac" />
        </>
      )}

      {/* car body */}
      <path
        d="M72 168 C86 132, 120 112, 162 112 H224 C266 112, 300 132, 314 168 L340 168 C354 168, 366 180, 366 194 V202 C366 214, 356 224, 344 224 H56 C44 224, 34 214, 34 202 V194 C34 180, 46 168, 60 168 Z"
        fill={t.body}
        stroke="#111827"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {roof}
      <rect x="132" y="150" width="52" height="36" rx="12" fill="rgba(255,255,255,0.65)" stroke="#111827" strokeWidth="3" />
      <rect x="194" y="150" width="52" height="36" rx="12" fill="rgba(255,255,255,0.65)" stroke="#111827" strokeWidth="3" />
      {mirror}
      {headlight}
      <circle cx="132" cy="194" r="16" fill="#0f172a" />
      {wheel}
      <circle cx="260" cy="194" r="16" fill="#0f172a" />
      <circle cx="260" cy="194" r="7" fill="#e5e7eb" />
      <circle cx="132" cy="194" r="7" fill="#e5e7eb" />
      {bumper}

      {/* overlays for found diffs */}
      {DIFFERENCES.map((d) =>
        show(d.id) ? (
          <circle key={d.id} cx={d.x} cy={d.y} r={d.r} fill="rgba(16,185,129,0.18)" stroke="#10b981" strokeWidth="3" />
        ) : null
      )}
    </svg>
  );
};

export const FindDifferencesGame: React.FC<DifferencesGameProps> = ({ theme = 1, onScore, onComplete }) => {
  const [found, setFound] = useState<number[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [completed, setCompleted] = useState(false);

  const t = THEMES[theme];

  useEffect(() => {
    if (completed) return;
    const timer = setInterval(() => setGameTime((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [completed]);

  useEffect(() => {
    if (found.length === DIFFERENCES.length) {
      setCompleted(true);
      onComplete?.();
    }
  }, [found, onComplete]);

  const handleClick = (x: number, y: number) => {
    if (completed) return;
    for (const d of DIFFERENCES) {
      const dist = Math.hypot(x - d.x, y - d.y);
      if (dist < d.r && !found.includes(d.id)) {
        const next = [...found, d.id];
        setFound(next);
        onScore?.(next.length);
        break;
      }
    }
  };

  const reset = () => {
    setFound([]);
    setGameTime(0);
    setCompleted(false);
  };

  const remaining = DIFFERENCES.length - found.length;

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
        <p className="text-gray-600 mt-2">{t.subtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <h3 className="font-bold text-gray-700 mb-2">Картинка 1 (нажимай здесь)</h3>
          <div
            className="cursor-crosshair"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 400;
              const y = ((e.clientY - rect.top) / rect.height) * 250;
              handleClick(x, y);
            }}
          >
            <CarScene theme={theme} variant={1} found={found} />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-gray-700 mb-2">Картинка 2</h3>
          <CarScene theme={theme} variant={2} found={found} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <div className="flex-1 bg-blue-50 rounded-2xl p-4">
          <div className="text-sm text-gray-600">Найдено</div>
          <div className="text-3xl font-black text-blue-600">{found.length}/5</div>
        </div>
        <div className="flex-1 bg-amber-50 rounded-2xl p-4">
          <div className="text-sm text-gray-600">Время</div>
          <div className="text-3xl font-black text-amber-600">{gameTime}с</div>
        </div>
        <div className="flex-1 bg-emerald-50 rounded-2xl p-4">
          <div className="text-sm text-gray-600">Осталось</div>
          <div className="text-3xl font-black text-emerald-600">{remaining}</div>
        </div>
      </div>

      {completed ? (
        <div className="mt-8 text-center bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
          <div className="text-5xl mb-2">🎉</div>
          <p className="text-xl font-black text-emerald-700">Отлично! Все отличия найдены.</p>
          <p className="text-gray-600 mt-1">Время: {gameTime} сек.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Ещё раз
          </button>
        </div>
      ) : (
        <div className="mt-8 text-center text-gray-600">
          Нажимай на левую картинку там, где видишь отличия. Найди все 5.
        </div>
      )}
    </div>
  );
};

