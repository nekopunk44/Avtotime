import React, { useMemo, useState } from 'react';
import { RotateCcw, ChevronLeft } from 'lucide-react';
import { API_URL } from '../../utils/config';

type ColoringCategory =
  | 'cars'
  | 'special'
  | 'animals'
  | 'cartoons';

interface ColoringGameProps {
  category?: ColoringCategory;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

type Part = { id: string; name: string };
type Template = {
  title: string;
  subtitle: string;
  parts: Part[];
  imageUrl?: string;
  render: (colors: Record<string, string>, paint: (id: string) => void) => React.ReactNode;
};

const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#111827', '#9ca3af', '#ffffff'];
const stroke = '#111827';

// SVG URLs from  dylanh930/SVG-coloring-book GitHub repo
const COLORING_CATEGORIES = [
  { 
    id: 'cars' as const, 
    title: 'Машинки', 
    emoji: '🚗', 
    color: 'from-blue-50 to-blue-100',
    images: [
      { name: 'Животное', url: 'https://raw.githubusercontent.com/dylanh930/SVG-coloring-book/master/svgs/dino.svg' },
      { name: 'Одежда', url: 'https://raw.githubusercontent.com/dylanh930/SVG-coloring-book/master/svgs/clothing.svg' },
    ]
  },
  {
    id: 'special' as const,
    title: 'Спецтехника',
    emoji: '🚒',
    color: 'from-red-50 to-red-100',
    images: [
      { name: 'Варежки', url: 'https://raw.githubusercontent.com/dylanh930/SVG-coloring-book/master/svgs/mittens.svg' },
      { name: 'Коньки', url: 'https://raw.githubusercontent.com/dylanh930/SVG-coloring-book/master/svgs/skates.svg' },
    ]
  },
  {
    id: 'animals' as const,
    title: 'Животные',
    emoji: '😸',
    color: 'from-amber-50 to-amber-100',
    images: [
      { name: 'Динозавр', url: 'https://raw.githubusercontent.com/dylanh930/SVG-coloring-book/master/svgs/dino.svg' },
      { name: 'Праздник', url: 'https://raw.githubusercontent.com/dylanh930/SVG-coloring-book/master/svgs/streamers.svg' },
    ]
  },
  { 
    id: 'cartoons' as const, 
    title: 'Герои мультиков', 
    emoji: '🎬', 
    color: 'from-purple-50 to-purple-100',
    images: [
      { name: 'Молния МакКуин', url: `${API_URL}/public/coloring_mult/Молния МакКуин и Dok Хадсон.svg` },
      { name: 'Мэтр', url: `${API_URL}/public/coloring_mult/1.svg` },
      { name: 'Маршал Щенячий патруль', url: `${API_URL}/public/coloring_mult/2.svg` },
      { name: 'Скай и Эверест', url: `${API_URL}/public/coloring_mult/3.svg` },
      { name: 'Щенки на базе', url: `${API_URL}/public/coloring_mult/4.svg` },
      { name: 'Тачки на гонке', url: `${API_URL}/public/coloring_mult/5.svg` },
      { name: 'Скай и вертолет', url: `${API_URL}/public/coloring_mult/6.svg` },
      { name: 'Крепыш и бульдозер', url: `${API_URL}/public/coloring_mult/7.svg` },
      { name: 'Рокки и мусоровоз', url: `${API_URL}/public/coloring_mult/8.svg` },
      { name: 'Райдер и щенки', url: `${API_URL}/public/coloring_mult/9.svg` },
      { name: 'Тачка в наушниках', url: `${API_URL}/public/coloring_mult/10.svg` },
      { name: 'МакКуин и друзья', url: `${API_URL}/public/coloring_mult/11.svg` },
    ]
  },
];

const templateFor = (category: ColoringCategory): Template => {
  if (category === 'special') {
    const parts: Part[] = [
      { id: 'truck', name: 'Кузов' },
      { id: 'cabin', name: 'Кабина' },
      { id: 'ladder', name: 'Лестница' },
      { id: 'siren', name: 'Мигалка' },
      { id: 'stripe', name: 'Полоса' },
    ];
    return {
      title: 'Раскраска: спецтехника',
      subtitle: 'Пожарная машина — нажимай на детали и выбирай цвет.',
      parts,
      render: (colors, paint) => (
        <svg viewBox="0 0 320 220" className="w-full max-w-[620px]">
          <rect x="0" y="0" width="320" height="220" fill="#f8fafc" rx="18" />
          <rect x="0" y="160" width="320" height="60" fill="#e2e8f0" />

          <rect
            x="70"
            y="112"
            width="170"
            height="48"
            rx="14"
            fill={colors.truck || '#ffffff'}
            stroke={stroke}
            strokeWidth="4"
            onClick={() => paint('truck')}
            className="cursor-pointer"
          />
          <rect
            x="36"
            y="124"
            width="52"
            height="36"
            rx="12"
            fill={colors.cabin || '#ffffff'}
            stroke={stroke}
            strokeWidth="4"
            onClick={() => paint('cabin')}
            className="cursor-pointer"
          />
          <rect x="46" y="132" width="22" height="16" rx="5" fill="#93c5fd" stroke={stroke} strokeWidth="3" />

          <rect
            x="110"
            y="92"
            width="120"
            height="10"
            rx="5"
            fill={colors.ladder || '#ffffff'}
            stroke={stroke}
            strokeWidth="4"
            onClick={() => paint('ladder')}
            className="cursor-pointer"
          />
          <rect x="125" y="92" width="10" height="24" rx="5" fill={colors.ladder || '#ffffff'} stroke={stroke} strokeWidth="4" onClick={() => paint('ladder')} className="cursor-pointer" />
          <rect x="160" y="92" width="10" height="24" rx="5" fill={colors.ladder || '#ffffff'} stroke={stroke} strokeWidth="4" onClick={() => paint('ladder')} className="cursor-pointer" />
          <rect x="195" y="92" width="10" height="24" rx="5" fill={colors.ladder || '#ffffff'} stroke={stroke} strokeWidth="4" onClick={() => paint('ladder')} className="cursor-pointer" />

          <rect x="52" y="106" width="22" height="12" rx="6" fill={colors.siren || '#fde047'} stroke={stroke} strokeWidth="3" onClick={() => paint('siren')} className="cursor-pointer" />
          <rect x="88" y="138" width="140" height="10" rx="5" fill={colors.stripe || '#ef4444'} stroke={stroke} strokeWidth="3" onClick={() => paint('stripe')} className="cursor-pointer" />

          <circle cx="95" cy="166" r="18" fill="#0f172a" />
          <circle cx="95" cy="166" r="8" fill="#e5e7eb" />
          <circle cx="215" cy="166" r="18" fill="#0f172a" />
          <circle cx="215" cy="166" r="8" fill="#e5e7eb" />
        </svg>
      ),
    };
  }

  if (category === 'animals') {
    const parts: Part[] = [
      { id: 'head', name: 'Голова' },
      { id: 'ears', name: 'Ушки' },
      { id: 'body', name: 'Тело' },
      { id: 'tail', name: 'Хвост' },
      { id: 'bow', name: 'Бантик' },
    ];
    return {
      title: 'Раскраска: животные',
      subtitle: 'Котик — нажимай на части рисунка.',
      parts,
      render: (colors, paint) => (
        <svg viewBox="0 0 320 220" className="w-full max-w-[620px]">
          <rect x="0" y="0" width="320" height="220" fill="#f8fafc" rx="18" />
          <circle cx="160" cy="96" r="52" fill={colors.head || '#ffffff'} stroke={stroke} strokeWidth="4" onClick={() => paint('head')} className="cursor-pointer" />
          <path d="M124 55 L108 26 L142 42 Z" fill={colors.ears || '#ffffff'} stroke={stroke} strokeWidth="4" onClick={() => paint('ears')} className="cursor-pointer" />
          <path d="M196 55 L212 26 L178 42 Z" fill={colors.ears || '#ffffff'} stroke={stroke} strokeWidth="4" onClick={() => paint('ears')} className="cursor-pointer" />

          <ellipse cx="160" cy="162" rx="62" ry="44" fill={colors.body || '#ffffff'} stroke={stroke} strokeWidth="4" onClick={() => paint('body')} className="cursor-pointer" />
          <path d="M220 160 C258 152, 270 195, 232 196" fill="none" stroke={colors.tail || '#ffffff'} strokeWidth="10" strokeLinecap="round" onClick={() => paint('tail')} className="cursor-pointer" />

          <circle cx="148" cy="82" r="6" fill="#111827" />
          <circle cx="172" cy="82" r="6" fill="#111827" />

          <circle cx="160" cy="130" r="8" fill={colors.bow || '#ec4899'} stroke={stroke} strokeWidth="3" onClick={() => paint('bow')} className="cursor-pointer" />
        </svg>
      ),
    };
  }

  if (category === 'cars') {
    const parts: Part[] = [
      { id: 'body', name: 'Кузов' },
      { id: 'cabin', name: 'Кабина' },
      { id: 'wheels', name: 'Колёса' },
      { id: 'bumper', name: 'Бампер' },
      { id: 'lights', name: 'Фары' },
    ];
    return {
      title: 'Раскраска: машинки',
      subtitle: 'Автомобиль — нажимай на детали и выбирай цвет.',
      parts,
      render: (colors, paint) => (
        <svg viewBox="0 0 320 220" className="w-full max-w-[620px]">
          <rect x="0" y="0" width="320" height="220" fill="#f8fafc" rx="18" />

          <rect
            x="50"
            y="130"
            width="220"
            height="50"
            rx="12"
            fill={colors.body || '#ffffff'}
            stroke={stroke}
            strokeWidth="4"
            onClick={() => paint('body')}
            className="cursor-pointer"
          />

          <rect
            x="70"
            y="85"
            width="100"
            height="50"
            rx="8"
            fill={colors.cabin || '#ffffff'}
            stroke={stroke}
            strokeWidth="4"
            onClick={() => paint('cabin')}
            className="cursor-pointer"
          />

          <circle cx="90" cy="180" r="18" fill={colors.wheels || '#111827'} stroke={stroke} strokeWidth="3" onClick={() => paint('wheels')} className="cursor-pointer" />
          <circle cx="90" cy="180" r="8" fill="#e5e7eb" />

          <circle cx="230" cy="180" r="18" fill={colors.wheels || '#111827'} stroke={stroke} strokeWidth="3" onClick={() => paint('wheels')} className="cursor-pointer" />
          <circle cx="230" cy="180" r="8" fill="#e5e7eb" />

          <rect x="50" y="135" width="25" height="8" rx="4" fill={colors.bumper || '#111827'} stroke={stroke} strokeWidth="2" onClick={() => paint('bumper')} className="cursor-pointer" />

          <rect x="78" y="95" width="12" height="12" rx="3" fill={colors.lights || '#fde047'} stroke={stroke} strokeWidth="2" onClick={() => paint('lights')} className="cursor-pointer" />
          <rect x="95" y="95" width="12" height="12" rx="3" fill={colors.lights || '#fde047'} stroke={stroke} strokeWidth="2" onClick={() => paint('lights')} className="cursor-pointer" />
        </svg>
      ),
    };
  }

  // cartoons category - skip template, just show images
  return {
    title: 'Раскраска: мультики',
    subtitle: 'Выбери персонажа для раскраски',
    parts: [],
    render: () => null,
  };
};

export const ColoringGame: React.FC<ColoringGameProps> = ({ category, onProgress, onComplete }) => {
  const [selectedCategory, setSelectedCategory] = useState<ColoringCategory | null>(category ?? null);
  const [selectedImage, setSelectedImage] = useState<{ name: string; url: string } | null>(null);
  const tpl = useMemo(() => (selectedCategory ? templateFor(selectedCategory) : null), [selectedCategory]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState(PALETTE[0] as string);

  const filled = Object.keys(colors).length;

  const reset = () => {
    setColors({});
  };

  const paint = (id: string) => {
    const newColors = { ...colors, [id]: selectedColor };
    setColors(newColors);
    if (onProgress && tpl) {
      const progress = Object.keys(newColors).length / tpl.parts.length;
      onProgress(progress);
    }
  };

  const categoryData = COLORING_CATEGORIES.find((c) => c.id === selectedCategory);

  if (selectedCategory && !selectedImage && categoryData?.images && categoryData.images.length >= 1) {
    return (
      <div className="w-full h-full flex flex-col gap-4 p-6">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className="inline-flex items-center gap-2 mb-4 text-sm font-bold text-blue-600 hover:text-blue-800 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад к категориям
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{categoryData.title}</h2>
        <p className="text-gray-600 text-sm">Выбери картинку для раскраски:</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 overflow-y-auto">
          {categoryData.images.map((img) => (
            <button
              key={img.name}
              type="button"
              onClick={() => setSelectedImage(img)}
              className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition bg-white"
            >
              <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                <img 
                  src={img.url} 
                  alt={img.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      const text = document.createElement('div');
                      text.textContent = '❌';
                      text.style.fontSize = '2rem';
                      parent.appendChild(text);
                    }
                  }}
                />
              </div>
              <p className="text-xs font-medium text-gray-700 text-center">{img.name}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedCategory) {
    return (
      <div className="w-full h-full flex flex-col gap-4 p-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Выбери раскраску</h2>
        <p className="text-gray-600 text-sm mb-4">Нажми на категорию для начала:</p>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 flex-1 overflow-y-auto">
          {COLORING_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-gray-300 hover:border-blue-500 hover:scale-105 transition bg-gradient-to-br ${cat.color}`}
            >
              <span className="text-5xl">{cat.emoji}</span>
              <p className="font-bold text-gray-900 text-center text-sm">{cat.title}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        {selectedImage && (
          <button
            type="button"
            onClick={() => {
              setSelectedImage(null);
              if (categoryData && categoryData.images.length >= 1) {
                // stay in image selection
              } else {
                setSelectedCategory(null);
              }
            }}
            className="inline-flex items-center gap-2 mb-4 text-sm font-bold text-blue-600 hover:text-blue-800 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад
          </button>
        )}
        <h2 className="text-2xl font-bold text-gray-900">{tpl?.title}</h2>
        <p className="text-gray-600 text-sm mt-1">{tpl?.subtitle}</p>
        {selectedImage && <p className="text-xs text-gray-500 mt-1">📸 {selectedImage.name}</p>}
      </div>

      <div className="grid md:grid-cols-3 gap-4 w-full flex-1 overflow-hidden">
        <div className="md:col-span-2 flex flex-col items-center justify-center overflow-hidden">
          <div className="bg-gray-50 rounded-2xl p-4 w-full h-full border border-gray-200 flex flex-col items-center justify-center overflow-hidden">
            {selectedImage?.url ? (
              <img 
                src={selectedImage.url} 
                alt={selectedImage.name}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  console.error('Failed to load image:', selectedImage.url);
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'text-center text-gray-600';
                    errorDiv.innerHTML = `<p className="text-lg">❌ Не удалось загрузить изображение</p><p className="text-sm mt-2">${selectedImage.name}</p>`;
                    parent.appendChild(errorDiv);
                  }
                }}
              />
            ) : (
              tpl && tpl.render(colors, paint)
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900 text-sm">Палитра</h3>
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900 text-white font-bold text-xs hover:bg-black transition">
                <RotateCcw className="w-3 h-3" />
                Сброс
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-105 ${
                    selectedColor === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {tpl && (
            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-2">Детали ({filled}/{tpl.parts.length})</h3>
              <div className="flex flex-col gap-2">
                {tpl.parts.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => paint(part.id)}
                    className={`px-3 py-2 rounded-lg text-left text-xs font-medium transition ${
                      colors[part.id]
                        ? 'text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    style={{
                      backgroundColor: colors[part.id] || undefined,
                    }}
                  >
                    {part.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
