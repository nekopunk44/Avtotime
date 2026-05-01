import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RotateCcw, ChevronLeft, Download, X, Sparkles, Car, Truck, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ColoringTemplate, ColoringCategory } from '../../types/coloring';
import { fetchColoringTemplateList, loadColoringTemplate, buildPublicSvgUrl, type ColoringCollection, type ColoringTemplateListItem } from '../../utils/coloringLoader';
import { ColoringCanvas } from './ColoringCanvas';
import { API_URL } from '../../utils/config';

interface ColoringGameV2Props {
  category?: ColoringCategory;
  showAllTemplates?: boolean;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onScore?: (score: number) => void;
  onClose?: () => void;
}

type Part = { id: string; name: string; path?: string };

// Standard color palette with basic colors
const PALETTE = [
  '#FF0000', // red
  '#FFA500', // orange
  '#FFFF00', // yellow
  '#00FF00', // green
  '#0000FF', // blue
  '#800080', // purple
  '#FFC0CB', // pink
  '#A52A2A', // brown
  '#000000', // black
  '#808080', // gray
  '#FFFFFF', // white
  '#FFD700', // gold
];

const CATEGORY_INFO: Record<ColoringCategory, { title: string; emoji: string; color: string; icon: React.ReactNode }> = {
  cars: { title: 'Машинки', emoji: '🚗', color: 'from-blue-50 to-blue-100', icon: <Car className="w-5 h-5" /> },
  special: { title: 'Спецтехника', emoji: '🚒', color: 'from-red-50 to-red-100', icon: <Shield className="w-5 h-5" /> },
  racing: { title: 'Гоночные', emoji: '🏁', color: 'from-amber-50 to-amber-100', icon: <Sparkles className="w-5 h-5" /> },
  trucks: { title: 'Грузовики', emoji: '🛻', color: 'from-green-50 to-green-100', icon: <Truck className="w-5 h-5" /> },
  cartoons: { title: 'Герои мультиков', emoji: '🎬', color: 'from-purple-50 to-purple-100', icon: <Sparkles className="w-5 h-5" /> },
};

export const ColoringGameV2: React.FC<ColoringGameV2Props> = ({ category, showAllTemplates = false, onProgress, onComplete, onScore, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<ColoringCategory | null>(showAllTemplates ? null : (category ?? null));
  const [selectedTemplate, setSelectedTemplate] = useState<ColoringTemplate | null>(null);
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [templateItems, setTemplateItems] = useState<ColoringTemplateListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [canvasProgress, setCanvasProgress] = useState(0);
  const canvasRef = useRef<{ resetCanvas: () => void }>(null);

  const collection: ColoringCollection = useMemo(() => {
    if (showAllTemplates) return 'coloring';
    if ((category ?? selectedCategory) === 'cartoons') return 'coloring_mult';
    return 'coloring';
  }, [showAllTemplates, category, selectedCategory]);

  // Load templates from manifest
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoading(true);
        
        const list = await fetchColoringTemplateList(collection);
        setTemplateItems(list);
        setLoadError(null);
      } catch (error) {
        console.error('Error loading templates:', error);
        setLoadError(`Не удалось загрузить раскраски: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [collection]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<ColoringCategory, ColoringTemplateListItem[]> = {
      cars: [],
      special: [],
      racing: [],
      trucks: [],
      cartoons: [],
    };

    templateItems.forEach((item) => {
      if (grouped[item.category]) grouped[item.category].push(item);
    });

    return grouped;
  }, [templateItems]);

  const visibleItems = useMemo(() => {
    if (showAllTemplates) return templateItems;
    if (!selectedCategory) return [];
    return itemsByCategory[selectedCategory] || [];
  }, [showAllTemplates, templateItems, selectedCategory, itemsByCategory]);

  const selectionTitle = showAllTemplates
    ? 'Машинки'
    : selectedCategory
      ? CATEGORY_INFO[selectedCategory].title
      : 'Выбери категорию';

  const progress = canvasProgress;


  // Call onScore when progress changes
  useEffect(() => {
    onScore?.(progress);
  }, [progress, onScore]);

  // Prevent body scroll when game is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollBarCompensation = window.innerWidth - document.body.offsetWidth;

    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollBarCompensation}px`;

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  useEffect(() => {
    if (progress === 100 && !showCompletion) {
      setShowCompletion(true);
      onComplete?.();
    }
    onProgress?.(progress / 100);
  }, [progress, showCompletion, onComplete, onProgress]);

  const reset = () => {
    setShowCompletion(false);
    setCanvasProgress(0);
    // Reset only canvas, not entire template
    if (canvasRef.current) {
      canvasRef.current.resetCanvas();
    }
  };

  const handleDownload = () => {
    // Find the canvas element
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `раскраска-${selectedTemplate?.id || 'машинка'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Save user's drawing to backend API
  const saveDrawing = async () => {
    console.log('🎨 Начинаю сохранение рисунка...');
    
    const canvas = document.querySelector('canvas');
    if (!canvas || !selectedTemplate) {
      console.error('❌ Canvas или шаблон не найдены');
      return;
    }

    console.log('📸 Получаю данные canvas...');
    const imageData = canvas.toDataURL('image/png', 0.7); // Сжимаем качество до 70%
    console.log('📏 Размер изображения после сжатия:', imageData.length, 'символов (было:', imageData.length * 1.43, ')');
    
    const drawingData = {
      templateId: selectedTemplate.id,
      title: selectedTemplate.title,
      imageData: imageData,
      progress: canvasProgress,
      brushSize: brushSize,
      colorsUsed: [selectedColor]
    };

    console.log('📦 Данные для сохранения:', {
      templateId: drawingData.templateId,
      title: drawingData.title,
      progress: drawingData.progress,
      brushSize: drawingData.brushSize,
      colorsUsed: drawingData.colorsUsed,
      imageDataLength: drawingData.imageData.length
    });

    try {
      console.log('📡 Отправляю запрос на /api/coloring/save...');
      
      // Auth on backend is via httpOnly cookie `token`; localStorage token is not used for saving (kept only for legacy/debug logs).
      const token = localStorage.getItem('token');
      console.log('🔑 Токен авторизации:', token ? `${token.substring(0, 20)}...` : 'отсутствует');
      
      const response = await fetch(`${API_URL}/coloring/save`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(drawingData)
      });

      console.log('📡 Статус ответа:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Рисунок успешно сохранен:', result);
        console.log('🆔 ID сохранения:', result.drawing?.id);
        console.log('⏰ Время сохранения:', result.drawing?.savedAt);
      } else {
        const errorText = await response.text();
        console.error('❌ Ошибка при сохранении рисунка:', response.status, response.statusText);
        console.error('❌ Текст ошибки:', errorText);
        
        // Если ошибка авторизации, перенаправляем на страницу входа
        if (response.status === 401) {
          console.log('🔐 Ошибка авторизации! Перенаправление на страницу входа...');
          // Здесь можно добавить редирект или показать модальное окно входа
          // window.location.href = '/login';
        }
      }
    } catch (error) {
      console.error('💥 Исключение при отправке рисунка:', error);
      console.error('💥 Stack trace:', error.stack);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🎨</div>
          <p className="text-gray-600">Загрузка раскрасок...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-gray-600">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Category selection screen
  if (!selectedCategory && !showAllTemplates) {
    return (
      <div className="w-full h-full flex flex-col p-4 md:p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">🎨 Выбери категорию</h2>
            <p className="text-gray-600">Какие машинки хочешь раскрасить?</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4 flex-1">
          {(Object.keys(CATEGORY_INFO) as ColoringCategory[]).map((cat) => {
            const info = CATEGORY_INFO[cat];
            const count = itemsByCategory[cat]?.length || 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex flex-col items-center justify-center gap-2 p-4 md:p-6 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all bg-gradient-to-br ${info.color} active:scale-95`}
              >
                <span className="text-3xl md:text-4xl">{info.emoji}</span>
                <span className="font-bold text-gray-900 text-sm md:text-base">{info.title}</span>
                <span className="text-gray-500 text-xs">{count} раскрасок</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }



  // Template selection screen
  if (!selectedTemplate) {
    const categoryItems = visibleItems;

    return (
      <div className="w-full h-full flex flex-col p-4 md:p-6">
        <div className="grid grid-cols-[40px_1fr_40px] items-center mb-4 md:mb-5">
          <button
            type="button"
            onClick={() => {
              if (showAllTemplates || category) {
                onClose?.();
                return;
              }
              setSelectedCategory(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-xl transition justify-self-start"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="text-center">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{selectionTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition justify-self-end"
            aria-label="Закрыть"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {templateLoadError && (
          <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {templateLoadError}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-3 flex-1 overflow-y-auto content-start auto-rows-max pr-1 pb-2 items-start">
          {categoryItems.map((template) => (
            <button
              key={template.id}
              type="button"
              disabled={isLoadingTemplate}
              onClick={async () => {
                if (isLoadingTemplate) return;
                try {
                  setIsLoadingTemplate(true);
                  setTemplateLoadError(null);
                  const loaded = await loadColoringTemplate(template, {
                    id: template.id,
                    title: template.title,
                    subtitle: template.subtitle,
                    emoji: template.emoji,
                    category: template.category,
                  });
                  if (!loaded) {
                    setTemplateLoadError('Не удалось загрузить раскраску');
                    return;
                  }
                  setSelectedTemplate(loaded);
                } catch (e) {
                  console.error('Failed to load template:', e);
                  setTemplateLoadError('Не удалось загрузить раскраску');
                } finally {
                  setIsLoadingTemplate(false);
                }
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all bg-white active:scale-95 text-center min-h-[150px] h-full"
            >
              <div className="w-full h-[92px] rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center p-2">
                <img
                  src={buildPublicSvgUrl(template.collection, template.filename)}
                  alt={template.title}
                  loading="lazy"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <p className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">{template.title}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Main coloring interface
  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_auto] items-center p-3 md:p-4 border-b border-gray-100 bg-white flex-shrink-0 gap-2">
        <button
          type="button"
          onClick={() => {
            console.log('🔙 Нажата кнопка "Назад"');
            console.log('📸 Вызываю сохранение рисунка...');
            saveDrawing();
            console.log('📋 Перехожу к списку шаблонов');
            setSelectedTemplate(null);
            setShowCompletion(false);
          }}
          className="p-2 hover:bg-gray-100 rounded-xl transition justify-self-start"
          aria-label="Назад"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <div className="text-center min-w-0">
          <h2 className="text-base md:text-lg font-bold text-gray-900 truncate">{selectedTemplate.title}</h2>
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          <button
            type="button"
            onClick={reset}
            className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-600"
            title="Начать заново"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              console.log('❌ Нажата кнопка "Закрыть"');
              console.log('📸 Вызываю сохранение рисунка...');
              saveDrawing();
              console.log('🚪 Закрываю приложение...');
              onClose();
            }}
            className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-600"
            title="Закрыть"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>


      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Controls panel */}
        <div className="w-full bg-white border-b border-gray-200 flex-shrink-0">
          {/* Mobile (compact) */}
          <div className="sm:hidden py-2.5 px-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Размер кисти:</span>
                <div className="relative">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-32 h-2.5 appearance-none bg-gray-200 rounded-full outline-none cursor-pointer shadow-inner"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #8b5cf6 ${((brushSize - 5) / 45) * 100}%, #e5e7eb ${((brushSize - 5) / 45) * 100}%, #e5e7eb 100%)`,
                    }}
                    aria-label="Размер кисти"
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg bg-gradient-to-br from-blue-500 to-purple-500 pointer-events-none transition-all duration-200"
                    style={{ left: `calc(${((brushSize - 5) / 45) * 100}% - 10px)` }}
                  />
                </div>
              </div>

              <div className="relative w-12 h-12 shrink-0 overflow-visible">
                <div className="w-12 h-12 rounded-full border-2 border-gray-200 bg-white shadow-sm flex items-center justify-center overflow-hidden">
                  <div
                    className="rounded-full transition-all duration-300 shadow-inner"
                    style={{
                      width: `${Math.max(2, Math.min(brushSize, 40))}px`,
                      height: `${Math.max(2, Math.min(brushSize, 40))}px`,
                      backgroundColor: selectedColor,
                      boxShadow: `0 2px 4px rgba(0,0,0,0.1) inset`,
                    }}
                  />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[11px] font-bold text-gray-700 leading-none tabular-nums">
                  {brushSize}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className="sr-only">Цвет</span>
              <div className="flex items-center gap-2 min-w-0 overflow-x-auto -mx-1 px-1 py-1">
                {PALETTE.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full transition-all duration-200 ${
                        isSelected ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'ring-1 ring-gray-300 hover:scale-105'
                      } shrink-0`}
                      style={{ backgroundColor: color }}
                      title={color}
                      aria-label={`Choose color ${color}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Desktop (original-ish) */}
          <div className="hidden sm:block py-3 px-4">
            <div className="max-w-6xl mx-auto flex items-center justify-center gap-x-10 gap-y-2 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Размер кисти:</span>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-32 h-3 appearance-none bg-gray-200 rounded-full outline-none cursor-pointer shadow-inner"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #8b5cf6 ${((brushSize - 5) / 45) * 100}%, #e5e7eb ${((brushSize - 5) / 45) * 100}%, #e5e7eb 100%)`,
                      }}
                      aria-label="Размер кисти"
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg bg-gradient-to-br from-blue-500 to-purple-500 pointer-events-none transition-all duration-200"
                      style={{ left: `calc(${((brushSize - 5) / 45) * 100}% - 10px)` }}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-2 border-gray-300 bg-white shadow-md flex items-center justify-center overflow-hidden">
                      <div
                        className="rounded-full transition-all duration-300 shadow-inner"
                        style={{
                          width: `${Math.max(2, Math.min(brushSize, 40))}px`,
                          height: `${Math.max(2, Math.min(brushSize, 40))}px`,
                          backgroundColor: selectedColor,
                          boxShadow: `0 2px 4px rgba(0,0,0,0.1) inset`,
                        }}
                      />
                    </div>
                    <span className="mt-1 text-xs font-bold text-gray-600 leading-none tabular-nums">{brushSize}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Цвет:</span>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {PALETTE.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full transition-all duration-200 ${
                          isSelected ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'ring-1 ring-gray-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                        aria-label={`Choose color ${color}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas area - now takes full width */}
        <div className="flex-1 flex items-center justify-center p-2 md:p-4 bg-gray-50 overflow-auto">
          <div className="relative bg-white rounded-2xl shadow-lg p-2 md:p-4 w-full max-w-6xl h-full flex items-start sm:items-center justify-center pt-10 sm:pt-0">
            {selectedTemplate.svgContent ? (
              <ColoringCanvas
                ref={canvasRef}
                svgContent={selectedTemplate.svgContent}
                viewBox={selectedTemplate.viewBox}
                width={selectedTemplate.width}
                height={selectedTemplate.height}
                brushColor={selectedColor}
                brushSize={brushSize}
                onProgress={setCanvasProgress}
              />
            ) : (
              <div className="flex items-center justify-center p-8 text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">🎨</div>
                  <p>Загрузка раскраски...</p>
                </div>
              </div>
            )}

            {/* Completion overlay */}
            <AnimatePresence>
              {showCompletion && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl"
                >
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="bg-white rounded-2xl p-6 shadow-2xl text-center"
                  >
                    <div className="text-5xl mb-3">🎉</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Отлично!</h3>
                    <p className="text-gray-600 text-sm mb-4">Ты раскрасил всю машинку!</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={reset}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition"
                      >
                        Ещё раз
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
