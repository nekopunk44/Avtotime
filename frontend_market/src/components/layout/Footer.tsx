import React from 'react';

export const Footer: React.FC = () => (
  <footer className="bg-[#0E0402] pt-16 pb-0">
    <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-12 md:gap-24 lg:gap-40 mb-20">
        {/* Brand */}
        <div className="flex flex-col gap-4 flex-shrink-0 md:items-center md:text-center lg:items-start lg:text-left">
          <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center justify-center lg:justify-start">
            <img src="/logo2.png" alt="AVTOTIME" className="h-18 w-auto" referrerPolicy="no-referrer" />
          </a>
          <p className="text-gray-400 text-sm leading-relaxed max-w-[380px] pl-8 md:pl-0 text-left md:text-center lg:text-left">
            Ваш надежный автомобильный рынок для покупки, продажи и аренды транспортных средств.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20 flex-grow text-center md:text-left">
          {/* Marketplace */}
          <div className="md:pl-16 lg:pl-0">
            <h4 className="font-bold text-white mb-6 text-[18px]">Маркетплейс</h4>
            <ul className="flex flex-col items-center md:items-start gap-4 text-gray-400 text-sm">
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Купить автомобили</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Продать свой автомобиль</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Арендовать автомобиль</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Автозапчасти</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Автосервисы</a></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold text-white mb-6 text-[18px]">Услуги</h4>
            <ul className="flex flex-col items-center md:items-start gap-4 text-gray-400 text-sm">
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Курсы вождения</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Консультации по автомобилям</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Тюнинг автомобилей</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Помощь другим</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Экологические советы</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-white mb-6 text-[18px]">Компания</h4>
            <ul className="flex flex-col items-center md:items-start gap-4 text-sm">
              <li><a href="#" onClick={(e) => e.preventDefault()} className="text-gray-400 underline decoration-white decoration-1 underline-offset-4 hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="text-gray-400 underline decoration-white decoration-1 underline-offset-4 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()} className="text-gray-400 underline decoration-white decoration-1 underline-offset-4 hover:text-white transition-colors">Cookie Policy</a></li>
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
