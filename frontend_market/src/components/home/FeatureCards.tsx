import React from 'react';
import { Rss } from 'lucide-react';

interface FeatureCardsProps {
  onOpenFeed?: () => void;
  onOpenDrivingCourses?: () => void;
  onOpenKids?: () => void;
}

export const FeatureCards: React.FC<FeatureCardsProps> = ({ onOpenFeed, onOpenDrivingCourses, onOpenKids }) => {
  const handleOpenFeed = () => {
    if (onOpenFeed) {
      onOpenFeed();
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };
  return (
    <section className="pb-12">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Your Feed */}
          <div className="bg-black rounded-[32px] p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="relative z-10">
              <div className="w-10 h-10 bg-[#FF0000] rounded-full flex items-center justify-center mb-4">
                <Rss className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white text-[22px] font-bold mb-1">Твоя лента</h3>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider max-w-[200px]">
                ОСТАВАЙТЕСЬ В КУРСЕ ПОСЛЕДНИХ ОБЪЯВЛЕНИЙ И НОВОСТЕЙ
              </p>
            </div>
            <div className="relative z-10 mt-4">
              <button onClick={handleOpenFeed} className="bg-[#FF0000] text-white px-6 py-2.5 rounded-xl text-[13px] font-bold hover:bg-red-700 transition-colors">
                СМОТРЕТЬ ЛЕНТУ
              </button>
            </div>
            {/* Large background icon */}
            <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-28 h-28 bg-[#FF0000] rounded-full flex items-center justify-center opacity-100">
              <Rss className="w-14 h-14 text-white" />
            </div>
          </div>

          {/* Card 2: Auto Courses */}
          <div className="bg-[#FF0000] rounded-[32px] p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="relative z-10">
              <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mb-4">
                <Rss className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white text-[22px] font-bold mb-1">Авто-курсы</h3>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider max-w-[200px]">
                ПОДГОТОВЬТЕСЬ К ЭКЗАМЕНУ ПО ВОЖДЕНИЮ С НАШИМИ ПРАКТИЧЕСКИМИ ТЕСТАМИ
              </p>
            </div>
            <div className="relative z-10 mt-4">
              <button onClick={onOpenDrivingCourses} className="bg-black text-white px-6 py-2.5 rounded-xl text-[13px] font-bold hover:bg-gray-900 transition-colors">
                НАЧАТЬ ИЗУЧЕНИЕ
              </button>
            </div>
            {/* Large background icon */}
            <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-28 h-28 bg-black rounded-full flex items-center justify-center opacity-100">
              <Rss className="w-14 h-14 text-white" />
            </div>
          </div>

          {/* Card 3: Kids Games */}
          <div className="bg-white border border-gray-200 rounded-[32px] p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="relative z-10">
              <div className="w-10 h-10 bg-[#FF0000] rounded-full flex items-center justify-center mb-4">
                <Rss className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-black text-[22px] font-bold mb-1">Игры детям</h3>
              <p className="text-black/50 text-[10px] font-bold uppercase tracking-wider max-w-[200px]">
                ИГРЫ, РАСКРАСКИ, МУЛЬТИКИ
              </p>
            </div>
            <div className="relative z-10 mt-4">
              <button onClick={onOpenKids} className="bg-black text-white px-8 py-2.5 rounded-xl text-[13px] font-bold hover:bg-gray-900 transition-colors">
                ПЕРЕЙТИ
              </button>
            </div>
            {/* Large background icon */}
            <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-28 h-28 bg-[#FF0000] rounded-full flex items-center justify-center opacity-100">
              <Rss className="w-14 h-14 text-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
