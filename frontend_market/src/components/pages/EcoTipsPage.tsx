import React, { useState, useEffect, useRef } from 'react';
import { Leaf, Calendar, ArrowRight, Plus, X, Send, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

interface EcoTip {
  id?: string | number;
  _id?: string;
  title: string;
  description: string;
  category: string;
  date: string;
  image: string;
  createdAt?: string;
}

export const EcoTipsPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tipText, setTipText] = useState('');
  const [tipCategory, setTipCategory] = useState('Вождение');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationError, setModerationError] = useState('');
  const [tips, setTips] = useState<EcoTip[]>([]);
  const [isTipsLoading, setIsTipsLoading] = useState(true);
  const [showFab, setShowFab] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const categories = ['Вождение', 'Обслуживание', 'Электромобили', 'Образ жизни', 'Другое'];

  // Load tips from backend (oldest -> newest)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsTipsLoading(true);
        const response = await fetch('/api/market/eco-tips', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load eco tips');

        const data = await response.json();
        const list: EcoTip[] = Array.isArray(data) ? data : data?.data || [];

        const sorted = [...list].sort((a: any, b: any) => {
          const at = new Date(a?.createdAt || 0).getTime() || 0;
          const bt = new Date(b?.createdAt || 0).getTime() || 0;
          return at - bt;
        });

        if (!cancelled) setTips(sorted);
      } catch (error) {
        console.error('Error loading eco tips:', error);
        if (!cancelled) setTips([]);
      } finally {
        if (!cancelled) setIsTipsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFab(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Отключаем прокрутку страницы при открытии модального окна
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  const handleSubmit = async () => {
    if (!tipText.trim()) return;
    
    setIsSubmitting(true);
    setModerationError('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Проверь этот текст пользователя: "${tipText}"`,
        config: {
          systemInstruction: "Ты — строгий модератор платформы для автомобилистов. Твоя задача — фильтровать токсичность, спам, рекламу, мошенничество, нецензурную лексику и бессмысленный набор букв. Верни ответ строго в формате JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isApproved: { type: Type.BOOLEAN, description: "Прошел ли текст модерацию" },
              reason: { type: Type.STRING, description: "Причина отклонения на русском языке (если isApproved = false)" },
              shouldBan: { type: Type.BOOLEAN, description: "Нужно ли заблокировать аккаунт за грубое нарушение" }
            },
            required: ["isApproved", "reason", "shouldBan"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      if (result.shouldBan) {
        setModerationError(`🚨 Ваш аккаунт заблокирован за нарушение правил: ${result.reason}`);
      } else if (!result.isApproved) {
        setModerationError(`❌ Отклонено: ${result.reason}`);
      } else {
        // Успех - отправляем совет на бэк
        try {
          const formData = new FormData();
          formData.append('title', tipText.substring(0, 50) || 'Совет по экологии');
          formData.append('description', tipText);
          formData.append('category', tipCategory);
          formData.append('date', new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
          
          const response = await fetch('/api/market/eco-tips', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error('Ошибка при сохранении совета');
          }

          // Append the created tip to the end (oldest -> newest)
          try {
            const createdTip = (await response.json()) as EcoTip;
            setTips((prev) => {
              const next = [...prev, createdTip];
              next.sort((a: any, b: any) => {
                const at = new Date(a?.createdAt || 0).getTime() || 0;
                const bt = new Date(b?.createdAt || 0).getTime() || 0;
                return at - bt;
              });
              return next;
            });
          } catch (e) {
            // ignore parse errors; list will refresh on next load
          }

          alert("Ваш совет успешно опубликован!");
          setIsModalOpen(false);
          setTipText('');
          setTipCategory('Вождение');
        } catch (error) {
          console.error("Ошибка сохранения:", error);
          setModerationError("Произошла ошибка при сохранении совета. Попробуйте позже.");
        }
      }
    } catch (error) {
      console.error("Ошибка модерации:", error);
      setModerationError("Произошла ошибка при проверке текста. Попробуйте позже.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Hero Section */}
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-50 rounded-2xl mb-6">
          <Leaf className="w-8 h-8 text-orange-600" />
        </div>
        <h1 className="text-[28px] sm:text-[48px] font-bold text-gray-900 font-serif mb-4">Советы по экологии</h1>
        <p className="text-[18px] text-gray-600 max-w-2xl mx-auto">
          Практические советы по экологичному вождению и обслуживанию автомобиля
        </p>
      </div>

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Featured Article */}
        <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm mb-16 flex flex-col lg:flex-row hover:shadow-md transition-shadow">
          <div className="lg:w-1/2 relative min-h-[300px] bg-gray-100">
            <img 
              src="https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=1200&auto=format&fit=crop" 
              alt="Featured" 
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-6 left-6">
              <span className="bg-orange-600 text-white px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider">
                Рекомендуемое
              </span>
            </div>
          </div>
          <div className="lg:w-1/2 p-6 sm:p-10 flex flex-col justify-center">
            <span className="text-gray-400 text-[14px] font-bold uppercase tracking-widest mb-3 sm:mb-4">Электромобили</span>
            <h2 className="text-[22px] sm:text-[32px] font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
              Полное руководство по владению электромобилем
            </h2>
            <p className="text-[15px] sm:text-[16px] text-gray-600 mb-5 sm:mb-8 leading-relaxed">
              Все, что вам нужно знать о переходе на электромобиль: от зарядной инфраструктуры до долгосрочной экономии и экологических преимуществ.
            </p>
            <div className="flex items-center gap-6 text-gray-400 text-[14px] mb-5 sm:mb-8">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>15 января 2024</span>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 text-orange-600 font-bold hover:gap-3 transition-all">
              Читать далее <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grid of Tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {isTipsLoading ? (
            <div className="col-span-full flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-3" />
              <span>Loading tips…</span>
            </div>
          ) : tips.length === 0 ? (
            <div className="col-span-full text-center py-16 text-gray-500">
              No tips yet.
            </div>
          ) : (
            tips.map((tip) => (
            <div key={tip._id ?? tip.id ?? tip.title} className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all group">
              <div className="h-56 relative overflow-hidden bg-gray-100">
                <img 
                  src={tip.image} 
                  alt={tip.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-orange-600 text-white px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider">
                    {tip.category}
                  </span>
                </div>
              </div>
              <div className="p-5 sm:p-8">
                <h3 className="text-[17px] sm:text-[20px] font-bold text-gray-900 mb-3 sm:mb-4 leading-tight group-hover:text-orange-600 transition-colors">
                  {tip.title}
                </h3>
                <p className="text-[14px] sm:text-[15px] text-gray-600 mb-4 sm:mb-6 leading-relaxed">
                  {tip.description}
                </p>
                <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-gray-400 text-[13px]">
                    <Calendar className="w-4 h-4" />
                    <span>{tip.date}</span>
                  </div>
                  <button className="text-orange-600 font-bold text-[14px] flex items-center gap-1 hover:gap-2 transition-all">
                    Читать далее <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
          )}
        </div>
      </div>

      {/* Sentinel: FAB hides when this div enters viewport (user reached bottom/footer) */}
      <div ref={sentinelRef} />

      {/* Floating Add Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-orange-700 hover:scale-105 active:scale-95 transition-all duration-300"
        style={{
          opacity: showFab && !isModalOpen ? 1 : 0,
          pointerEvents: showFab && !isModalOpen ? 'auto' : 'none',
        }}
        title="Добавить совет"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Tip Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 max-w-lg w-full relative">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-50 rounded-xl mb-6">
                <Leaf className="w-6 h-6 text-orange-600" />
              </div>
              
              <h2 className="text-[24px] font-bold text-gray-900 mb-2">Поделитесь своим эко-советом</h2>
              <p className="text-[15px] text-gray-600 mb-6">
                Ваш опыт может помочь другим сделать мир чище. Напишите свой совет по экологичному вождению или уходу за авто.
              </p>
              
              {moderationError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[14px] font-medium">
                  {moderationError}
                </div>
              )}
              
              <textarea 
                placeholder="Ваш совет..." 
                value={tipText}
                onChange={(e) => {
                  setTipText(e.target.value);
                  if (moderationError) setModerationError('');
                }}
                disabled={isSubmitting}
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-[15px] focus:outline-none focus:ring-2 focus:ring-orange-600/20 transition-all min-h-[120px] resize-none mb-4 disabled:opacity-50"
              />

              <div className="mb-6">
                <label className="block text-[14px] font-medium text-gray-700 mb-2">Тематика совета</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setTipCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-[14px] font-medium transition-all ${
                        tipCategory === cat 
                          ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' 
                          : 'bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100'
                      } border`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || !tipText.trim()}
                className="w-full bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold text-[15px] hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Отправить
                  </>
                )}
              </button>
            </div>
          </div>
          </div>
        )}
    </div>
  );
};

