import React from 'react';

interface FooterProps {
  onNavigate?: (page: string) => void;
}

const NavLink: React.FC<{
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ onClick, className, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={className}
  >
    {children}
  </button>
);

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const go = (page: string) => {
    onNavigate?.(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#0E0402] pt-16 pb-0">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12 md:gap-24 lg:gap-40 mb-20">
          {/* Brand */}
          <div className="flex flex-col gap-4 flex-shrink-0 md:items-center md:text-center lg:items-start lg:text-left">
            <button
              type="button"
              onClick={() => go('home')}
              className="flex items-center justify-center lg:justify-start"
            >
              <img src="/лого_бел.jpg" alt="AVTOTIME" className="h-16 w-auto" referrerPolicy="no-referrer" />
            </button>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[380px] pl-8 md:pl-0 text-left md:text-center lg:text-left">
              Ваш надежный автомобильный рынок для покупки, продажи и аренды транспортных средств.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20 flex-grow text-center md:text-left">
            {/* Marketplace */}
            <div className="md:pl-16 lg:pl-0">
              <h4 className="font-bold text-white mb-6 text-[18px]">Маркетплейс</h4>
              <ul className="flex flex-col items-center md:items-start gap-4 text-gray-400 text-sm">
                <li><NavLink onClick={() => go('home')} className="hover:text-white transition-colors">Купить автомобили</NavLink></li>
                <li><NavLink onClick={() => go('add-listing')} className="hover:text-white transition-colors">Продать свой автомобиль</NavLink></li>
                <li><NavLink onClick={() => go('home')} className="hover:text-white transition-colors">Арендовать автомобиль</NavLink></li>
                <li><NavLink onClick={() => go('home')} className="hover:text-white transition-colors">Автозапчасти</NavLink></li>
                <li><NavLink onClick={() => go('car-services')} className="hover:text-white transition-colors">Автосервисы</NavLink></li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-bold text-white mb-6 text-[18px]">Услуги</h4>
              <ul className="flex flex-col items-center md:items-start gap-4 text-gray-400 text-sm">
                <li><NavLink onClick={() => go('driving-courses')} className="hover:text-white transition-colors">Курсы вождения</NavLink></li>
                <li><NavLink onClick={() => go('consultations')} className="hover:text-white transition-colors">Консультации по автомобилям</NavLink></li>
                <li><NavLink onClick={() => go('auto-tuning')} className="hover:text-white transition-colors">Тюнинг автомобилей</NavLink></li>
                <li><NavLink onClick={() => go('help-others')} className="hover:text-white transition-colors">Помощь другим</NavLink></li>
                <li><NavLink onClick={() => go('eco-tips')} className="hover:text-white transition-colors">Экологические советы</NavLink></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-bold text-white mb-6 text-[18px]">Компания</h4>
              <ul className="flex flex-col items-center md:items-start gap-4 text-sm">
                <li><NavLink onClick={() => go('terms')} className="text-gray-400 underline decoration-white decoration-1 underline-offset-4 hover:text-white transition-colors">Terms of Service</NavLink></li>
                <li><NavLink onClick={() => go('privacy')} className="text-gray-400 underline decoration-white decoration-1 underline-offset-4 hover:text-white transition-colors">Privacy Policy</NavLink></li>
                <li><NavLink onClick={() => go('cookies')} className="text-gray-400 underline decoration-white decoration-1 underline-offset-4 hover:text-white transition-colors">Cookie Policy</NavLink></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full border-t border-white">
        <div className="max-w-[1536px] mx-auto px-4 py-10 flex justify-center">
          <p className="text-gray-500 text-sm">© 2026 MomentumX. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
