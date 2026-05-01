import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';

interface CarPuzzleGameProps {
  level?: 1 | 2 | 3;
  onScore?: (score: number) => void;
  onComplete?: () => void;
}

const toSvgDataUrl = (svg: string) => {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, '')
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
    .replace(/%22/g, "'");
  return `data:image/svg+xml,${encoded}`;
};

const getPuzzleConfig = (level: 1 | 2 | 3) => {
  if (level === 1) return { cols: 3, rows: 2, title: 'Пазл: Машина (6 деталей)' };
  if (level === 2) return { cols: 3, rows: 3, title: 'Пазл: Машина (9 деталей)' };
  return { cols: 4, rows: 3, title: 'Пазл: Машина (12 деталей)' };
};

const getCarSvg = (seed: number) => {
  const body = seed % 3 === 0 ? '#ef4444' : seed % 3 === 1 ? '#3b82f6' : '#22c55e';
  const accent = seed % 2 === 0 ? '#9333ea' : '#f97316';
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f5f3ff"/>
        <stop offset="100%" stop-color="#ffffff"/>
      </linearGradient>
      <linearGradient id="car" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${body}"/>
        <stop offset="100%" stop-color="${accent}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="450" fill="url(#bg)"/>
    <rect x="0" y="325" width="800" height="125" fill="#e2e8f0"/>
    <rect x="0" y="350" width="800" height="20" fill="#cbd5e1"/>

    <path d="M160 290 C200 210, 310 175, 405 175 H510 C595 175, 655 215, 700 290 L730 290 C750 290, 765 305, 765 325 V338 C765 356, 750 370, 730 370 H150 C130 370, 115 356, 115 338 V325 C115 305, 130 290, 150 290 Z"
      fill="url(#car)" stroke="#111827" stroke-width="8" stroke-linejoin="round"/>

    <path d="M250 285 C275 235, 330 210, 400 210 H490 C530 210, 565 225, 595 285 Z"
      fill="#93c5fd" opacity="0.9" stroke="#0f172a" stroke-width="6" stroke-linejoin="round"/>

    <circle cx="250" cy="370" r="54" fill="#0f172a"/>
    <circle cx="250" cy="370" r="28" fill="#e5e7eb"/>
    <circle cx="600" cy="370" r="54" fill="#0f172a"/>
    <circle cx="600" cy="370" r="28" fill="#e5e7eb"/>

    <circle cx="150" cy="315" r="16" fill="#fde047" stroke="#111827" stroke-width="6"/>
    <rect x="690" y="310" width="42" height="22" rx="10" fill="#f87171" stroke="#111827" stroke-width="6"/>
  </svg>
  `;
};

const shuffle = (arr: number[]) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const CarPuzzleGame: React.FC<CarPuzzleGameProps> = ({ level = 1, onScore, onComplete }) => {
  const { cols, rows, title } = useMemo(() => getPuzzleConfig(level), [level]);
  const totalPieces = cols * rows;

  const imageUrl = useMemo(() => toSvgDataUrl(getCarSvg(level)), [level]);

  const [pieces, setPieces] = useState<number[]>(() => shuffle([...Array(totalPieces)].map((_, i) => i)));
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [completed, setCompleted] = useState(false);

  const isSolved = useMemo(() => pieces.every((v, i) => v === i), [pieces]);

  useEffect(() => {
    if (!isSolved) return;
    if (completed) return;
    setCompleted(true);
    onComplete?.();
  }, [completed, isSolved, onComplete]);

  const resetGame = () => {
    setPieces(shuffle([...Array(totalPieces)].map((_, i) => i)));
    setSelectedPos(null);
    setMoves(0);
    setCompleted(false);
    onScore?.(0);
  };

  const handleClick = (pos: number) => {
    if (completed) return;
    if (selectedPos === null) {
      setSelectedPos(pos);
      return;
    }
    if (selectedPos === pos) {
      setSelectedPos(null);
      return;
    }
    setPieces((prev) => {
      const next = prev.slice();
      [next[selectedPos], next[pos]] = [next[pos], next[selectedPos]];
      return next;
    });
    setSelectedPos(null);
    setMoves((m) => {
      const nextMoves = m + 1;
      const score = Math.max(0, 1000 - nextMoves * 10);
      onScore?.(score);
      return nextMoves;
    });
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-gray-600 mt-2">Нажимай на две детали, чтобы поменять их местами.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2">
          <div className="rounded-3xl border border-gray-100 bg-slate-50 p-4 sm:p-6">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {pieces.map((pieceIndex, pos) => {
                const px = pieceIndex % cols;
                const py = Math.floor(pieceIndex / cols);
                const xPct = cols === 1 ? 0 : (px / (cols - 1)) * 100;
                const yPct = rows === 1 ? 0 : (py / (rows - 1)) * 100;
                const selected = selectedPos === pos;

                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handleClick(pos)}
                    className={`relative aspect-[4/3] rounded-2xl border overflow-hidden transition-all ${
                      selected ? 'border-[#9333ea] ring-2 ring-purple-200 scale-[1.02]' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{
                      backgroundImage: `url("${imageUrl}")`,
                      backgroundSize: `${cols * 100}% ${rows * 100}%`,
                      backgroundPosition: `${xPct}% ${yPct}%`,
                      backgroundRepeat: 'no-repeat',
                      backgroundColor: '#ffffff',
                    }}
                    aria-label={`Деталь ${pos + 1}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-100 bg-white p-5">
            <div className="text-sm text-gray-500">Ходы</div>
            <div className="text-3xl font-bold text-gray-900">{moves}</div>
            <div className="mt-4 text-sm text-gray-500">Подсказка</div>
            <div className="text-gray-700 leading-relaxed">
              Сначала собери колёса, потом крышу и кузов.
            </div>
          </div>

          <button
            type="button"
            onClick={resetGame}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Перемешать
          </button>

          {completed ? (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 font-bold text-emerald-700">
                <Trophy className="w-5 h-5" />
                Отлично!
              </div>
              <div className="text-emerald-700/90 mt-2">
                Пазл собран за <span className="font-semibold">{moves}</span> ходов.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

