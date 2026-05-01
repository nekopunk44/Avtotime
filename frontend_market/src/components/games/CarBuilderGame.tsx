import React, { useMemo, useState } from 'react';
import { Dice5, Download } from 'lucide-react';

interface CarBuilderGameProps {
  onComplete?: () => void;
}

type WheelStyle = 'classic' | 'sport' | 'offroad';

const BODY_COLORS = [
  { name: 'Красный', value: '#ef4444' },
  { name: 'Синий', value: '#3b82f6' },
  { name: 'Зелёный', value: '#22c55e' },
  { name: 'Жёлтый', value: '#eab308' },
  { name: 'Фиолетовый', value: '#9333ea' },
  { name: 'Чёрный', value: '#111827' },
  { name: 'Белый', value: '#ffffff' },
];

const WHEEL_STYLES: Array<{ id: WheelStyle; label: string }> = [
  { id: 'classic', label: 'Классика' },
  { id: 'sport', label: 'Спорт' },
  { id: 'offroad', label: 'Внедорожные' },
];

export const CarBuilderGame: React.FC<CarBuilderGameProps> = ({ onComplete }) => {
  const [bodyColor, setBodyColor] = useState('#ef4444');
  const [wheelStyle, setWheelStyle] = useState<WheelStyle>('classic');
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [hasRoofRack, setHasRoofRack] = useState(false);

  const wheelFill = useMemo(() => {
    if (wheelStyle === 'sport') return '#111827';
    if (wheelStyle === 'offroad') return '#0f172a';
    return '#1f2937';
  }, [wheelStyle]);

  const rimFill = useMemo(() => {
    if (wheelStyle === 'sport') return '#e5e7eb';
    if (wheelStyle === 'offroad') return '#cbd5e1';
    return '#d1d5db';
  }, [wheelStyle]);

  const randomize = () => {
    const randomBody = BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)]?.value || '#ef4444';
    const randomWheel = WHEEL_STYLES[Math.floor(Math.random() * WHEEL_STYLES.length)]?.id || 'classic';
    setBodyColor(randomBody);
    setWheelStyle(randomWheel);
    setHasSpoiler(Math.random() > 0.5);
    setHasRoofRack(Math.random() > 0.5);
    onComplete?.();
  };

  const downloadSvg = () => {
    const svgElement = document.getElementById('car-builder-svg');
    if (!svgElement) return;
    const xml = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-car.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Конструктор машины</h2>
        <p className="text-gray-600 mt-2">Выбери цвет, колёса и собери свою машинку.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="rounded-3xl border border-gray-100 bg-slate-50 p-6 flex items-center justify-center">
            <svg
              id="car-builder-svg"
              viewBox="0 0 520 260"
              className="w-full max-w-xl"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="bodyGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={bodyColor} stopOpacity="1" />
                  <stop offset="100%" stopColor={bodyColor} stopOpacity="0.85" />
                </linearGradient>
              </defs>

              <rect x="40" y="140" width="440" height="60" rx="26" fill="url(#bodyGradient)" stroke="#111827" strokeWidth="3" />
              <path
                d="M120 140 C150 95, 210 78, 270 78 H330 C380 78, 420 104, 450 140 Z"
                fill="url(#bodyGradient)"
                stroke="#111827"
                strokeWidth="3"
              />

              <path
                d="M160 132 C180 104, 220 96, 260 96 H310 C342 96, 370 110, 392 132 Z"
                fill="#93c5fd"
                opacity="0.9"
                stroke="#0f172a"
                strokeWidth="2"
              />

              {hasRoofRack ? (
                <>
                  <rect x="190" y="86" width="160" height="8" rx="4" fill="#111827" opacity="0.85" />
                  <rect x="205" y="76" width="10" height="20" rx="5" fill="#111827" opacity="0.85" />
                  <rect x="325" y="76" width="10" height="20" rx="5" fill="#111827" opacity="0.85" />
                </>
              ) : null}

              {hasSpoiler ? (
                <>
                  <rect x="408" y="122" width="46" height="10" rx="5" fill="#111827" opacity="0.9" />
                  <rect x="434" y="112" width="10" height="24" rx="5" fill="#111827" opacity="0.9" />
                </>
              ) : null}

              <circle cx="150" cy="205" r="34" fill={wheelFill} stroke="#0b1220" strokeWidth="4" />
              <circle cx="150" cy="205" r="18" fill={rimFill} stroke="#111827" strokeWidth="3" />
              <circle cx="370" cy="205" r="34" fill={wheelFill} stroke="#0b1220" strokeWidth="4" />
              <circle cx="370" cy="205" r="18" fill={rimFill} stroke="#111827" strokeWidth="3" />

              {wheelStyle === 'sport' ? (
                <>
                  <path d="M150 187 L156 205 L150 223 L144 205 Z" fill="#111827" opacity="0.8" />
                  <path d="M132 205 L150 211 L168 205 L150 199 Z" fill="#111827" opacity="0.8" />
                  <path d="M370 187 L376 205 L370 223 L364 205 Z" fill="#111827" opacity="0.8" />
                  <path d="M352 205 L370 211 L388 205 L370 199 Z" fill="#111827" opacity="0.8" />
                </>
              ) : wheelStyle === 'offroad' ? (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <rect
                      key={i}
                      x={150 - 2}
                      y={171}
                      width={4}
                      height={10}
                      rx={2}
                      fill="#0b1220"
                      transform={`rotate(${i * 45} 150 205)`}
                    />
                  ))}
                  {Array.from({ length: 8 }).map((_, i) => (
                    <rect
                      key={i}
                      x={370 - 2}
                      y={171}
                      width={4}
                      height={10}
                      rx={2}
                      fill="#0b1220"
                      transform={`rotate(${i * 45} 370 205)`}
                    />
                  ))}
                </>
              ) : null}

              <circle cx="72" cy="170" r="8" fill="#fde047" stroke="#111827" strokeWidth="2" />
              <rect x="444" y="162" width="18" height="10" rx="4" fill="#f87171" stroke="#111827" strokeWidth="2" />
            </svg>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-gray-100 bg-white p-5">
            <div className="font-bold text-gray-900 mb-3">Цвет кузова</div>
            <div className="grid grid-cols-4 gap-2">
              {BODY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setBodyColor(c.value)}
                  className={`h-11 rounded-2xl border transition-all ${
                    bodyColor === c.value ? 'border-gray-900 ring-2 ring-black/10' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-5">
            <div className="font-bold text-gray-900 mb-3">Колёса</div>
            <div className="flex flex-wrap gap-2">
              {WHEEL_STYLES.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWheelStyle(w.id)}
                  className={`px-4 py-2 rounded-2xl border text-sm font-bold transition-colors ${
                    wheelStyle === w.id
                      ? 'bg-[#9333ea] text-white border-transparent'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-5">
            <div className="font-bold text-gray-900 mb-3">Детали</div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={hasSpoiler}
                  onChange={(e) => setHasSpoiler(e.target.checked)}
                />
                <span className="font-semibold text-gray-800">Спойлер</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={hasRoofRack}
                  onChange={(e) => setHasRoofRack(e.target.checked)}
                />
                <span className="font-semibold text-gray-800">Багажник</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={randomize}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#9333ea] text-white px-4 py-3 font-bold hover:bg-[#7e22ce] transition-colors"
            >
              <Dice5 className="w-5 h-5" />
              Случайно
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-5 h-5" />
              Скачать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

