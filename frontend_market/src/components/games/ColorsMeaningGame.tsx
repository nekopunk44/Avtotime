import React, { useMemo, useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';

interface ColorsMeaningGameProps {
  onComplete?: () => void;
}

type ColorKey =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'black'
  | 'white'
  | 'gray';

const COLORS: Array<{
  key: ColorKey;
  name: string;
  hex: string;
  meaning: string;
  examples: string[];
}> = [
  {
    key: 'red',
    name: 'Красный',
    hex: '#ef4444',
    meaning: 'Стоп, опасность, внимание.',
    examples: ['Стоп-сигнал', 'Красный сигнал светофора', 'Знак «Стоп»'],
  },
  {
    key: 'orange',
    name: 'Оранжевый',
    hex: '#f97316',
    meaning: 'Предупреждение и осторожность.',
    examples: ['Дорожные конусы', 'Сигнальные жилеты', 'Предупреждающие огни'],
  },
  {
    key: 'yellow',
    name: 'Жёлтый',
    hex: '#eab308',
    meaning: 'Внимание, приготовься.',
    examples: ['Жёлтый сигнал светофора', 'Предупреждающие знаки', 'Школьный автобус'],
  },
  {
    key: 'green',
    name: 'Зелёный',
    hex: '#22c55e',
    meaning: 'Можно, безопасно, движение.',
    examples: ['Зелёный сигнал светофора', 'Разрешающие указатели', 'Парки и природа'],
  },
  {
    key: 'blue',
    name: 'Синий',
    hex: '#3b82f6',
    meaning: 'Спокойствие, информация.',
    examples: ['Информационные дорожные знаки', 'Вода', 'Небо'],
  },
  {
    key: 'purple',
    name: 'Фиолетовый',
    hex: '#8b5cf6',
    meaning: 'Фантазия, творчество.',
    examples: ['Украшения', 'Фейерверки', 'Космос'],
  },
  {
    key: 'black',
    name: 'Чёрный',
    hex: '#111827',
    meaning: 'Контраст, серьёзность, тень.',
    examples: ['Асфальт', 'Колёса', 'Ночь'],
  },
  {
    key: 'white',
    name: 'Белый',
    hex: '#ffffff',
    meaning: 'Чистота, безопасность, заметность.',
    examples: ['Разметка на дороге', 'Снег', 'Облака'],
  },
  {
    key: 'gray',
    name: 'Серый',
    hex: '#9ca3af',
    meaning: 'Нейтральность, металл.',
    examples: ['Металлические детали', 'Инструменты', 'Здания'],
  },
];

export const ColorsMeaningGame: React.FC<ColorsMeaningGameProps> = ({ onComplete }) => {
  const [selected, setSelected] = useState<ColorKey>('red');
  const [seen, setSeen] = useState<Set<ColorKey>>(() => new Set<ColorKey>(['red']));

  const current = useMemo(() => COLORS.find((c) => c.key === selected)!, [selected]);
  const progress = Math.round((seen.size / COLORS.length) * 100);

  const handleSelect = (key: ColorKey) => {
    setSelected(key);
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(key);
      if (next.size === COLORS.length) onComplete?.();
      return next;
    });
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Цвета и что они означают</h2>
        <p className="text-gray-600 mt-2">Нажми на цвет и прочитай значение.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => handleSelect(c.key)}
                className={`relative rounded-2xl border transition-all h-14 sm:h-16 ${
                  selected === c.key ? 'border-gray-900 ring-2 ring-black/10' : 'border-gray-200 hover:border-gray-300'
                }`}
                style={{ backgroundColor: c.hex }}
                aria-label={c.name}
                title={c.name}
              >
                {seen.has(c.key) ? (
                  <span className="absolute -top-2 -right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow border border-gray-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Прогресс: {progress}%</div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#9333ea] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-slate-50 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-500">Выбран цвет</div>
              <div className="text-xl font-bold text-gray-900">{current.name}</div>
            </div>
            <div className="h-12 w-12 rounded-2xl border border-gray-200" style={{ backgroundColor: current.hex }} />
          </div>

          <div className="mt-4 flex items-start gap-2 text-gray-700">
            <Info className="w-5 h-5 mt-0.5 text-gray-500" />
            <div className="leading-relaxed">{current.meaning}</div>
          </div>

          <div className="mt-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Примеры</div>
            <ul className="space-y-2 text-gray-700">
              {current.examples.map((e) => (
                <li key={e} className="rounded-2xl bg-white border border-gray-100 px-4 py-2">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

