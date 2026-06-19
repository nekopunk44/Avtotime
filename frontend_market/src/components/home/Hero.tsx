import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Search, RefreshCw } from 'lucide-react';

const CarModel3D = lazy(() =>
  import('./CarModel3D').then((m) => ({ default: m.CarModel3D }))
);

export type HeroQuickSearchPayload = {
  offerType: string;
  brand?: string;
  model?: string;
  year?: string;
  region?: string;
};

interface HeroProps {
  setCurrentPage: (page: string) => void;
  onQuickSearch?: (payload: HeroQuickSearchPayload) => void;
}

function CountryFlag({ country }: { country: string }) {
  if (country === 'JP') return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" preserveAspectRatio="none" className="w-full h-full">
      <rect fill="#fff" width="900" height="600"/>
      <circle fill="#bc002d" cx="450" cy="300" r="180"/>
    </svg>
  );
  if (country === 'DE') return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3" preserveAspectRatio="none" className="w-full h-full">
      <rect width="5" height="1" y="0" fill="#000"/>
      <rect width="5" height="1" y="1" fill="#D00"/>
      <rect width="5" height="1" y="2" fill="#FFCE00"/>
    </svg>
  );
  // US
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 400" preserveAspectRatio="none" className="w-full h-full">
      <rect width="760" height="400" fill="#B22234"/>
      {[1,3,5,7,9,11].map(i => <rect key={i} y={i*400/13} width="760" height={400/13} fill="#fff"/>)}
      <rect width="304" height={7*400/13} fill="#3C3B6E"/>
      {Array.from({length:50}).map((_,i) => {
        const col = i % (Math.floor(i/6) % 2 === 0 ? 6 : 5);
        const x = Math.floor(i/6) % 2 === 0 ? col*50+25 : col*50+50;
        const y = Math.floor(i/6)*27+13;
        return <text key={i} x={x} y={y} fill="#fff" fontSize="18" textAnchor="middle">★</text>;
      })}
    </svg>
  );
}

export const Hero: React.FC<HeroProps> = ({ setCurrentPage, onQuickSearch }) => {
  const [activeType, setActiveType] = useState('Продажа');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [region, setRegion] = useState('');
  const [carCountry, setCarCountry] = useState('US');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <section className="bg-[#D9D9D9] pt-4 pb-12 lg:pt-6 lg:pb-20 overflow-hidden relative min-h-[320px] md:min-h-[450px] lg:min-h-[500px] flex items-start">
      {/* 3D Car Model — full section on mobile, right-side on md+ */}
      {/* 3D Car Model */}
      <div className="absolute inset-0 md:inset-auto md:right-0 md:bottom-0 md:w-[65%] z-0 md:h-full md:min-h-[450px] overflow-hidden">
        <div className="w-full h-full">
          <Suspense fallback={null}>
            <CarModel3D onCountryChange={setCarCountry} compact={isMobile} />
          </Suspense>
        </div>
      </div>

      {/* Mobile flag — top right corner */}
      <div className="md:hidden absolute top-4 right-4 z-10 w-16 h-10 shadow-lg rounded overflow-hidden transition-opacity duration-500">
        <CountryFlag country={carCountry} />
      </div>

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 pt-4 lg:pt-8">
        {/* Header with Title and Flag — desktop only */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <div className="w-full md:w-[600px] lg:w-[650px] flex items-baseline justify-between">
            <h1 className="text-[28px] md:text-[36px] lg:text-[48px] font-bold text-black leading-none">
              Быстрый поиск
            </h1>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onQuickSearch?.({ offerType: 'Все' });
              }}
              className="text-[10px] md:text-[12px] text-gray-600 hover:text-black transition-colors whitespace-nowrap"
            >
              Все объявления
            </a>
          </div>

          {/* Country Flag */}
          <div className="w-16 h-10 md:w-20 md:h-12 lg:w-24 lg:h-16 shadow-lg rounded overflow-hidden shrink-0 transition-opacity duration-500">
            <CountryFlag country={carCountry} />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start justify-between gap-8">

          {/* Left Content: Search Box — desktop only */}
          <div className="hidden md:block md:w-[600px] lg:w-[650px] shrink-0">
            {/* Search Container */}
            <div className="relative">
              {/* Red Border Box */}
              <div className="bg-[#FF0000] p-3 md:p-2 rounded-[12px] shadow-lg">
                {/* Row 1: Offer Types (White block with full rounding) */}
                <div className="bg-white rounded-[12px] grid grid-cols-2 md:flex mb-3 md:mb-2 overflow-hidden">
                  {[
                    { name: 'Продажа', src: '/online-shoping.png', size: 'w-4 h-4' },
                    { name: 'Покупка', src: '/auto/transport.png', size: 'w-8 h-8' },
                    { name: 'Аренда', src: '/key.png', size: 'w-4 h-4' },
                    { name: 'Обмен', src: null, size: 'w-4 h-4' },
                  ].map((type) => (
                    <button
                      key={type.name}
                      onClick={() => setActiveType(type.name)}
                      className={`flex md:flex-1 items-center justify-center gap-2 lg:gap-3 px-4 py-2.5 md:py-1.5 text-[13px] lg:text-[15px] font-medium transition-all ${
                        activeType === type.name
                          ? 'bg-black text-white rounded-[12px]'
                          : 'text-black hover:bg-gray-50'
                      }`}
                    >
                      {type.src
                        ? <img src={type.src} className={`${type.size} object-contain transition-all`} style={activeType === type.name ? { filter: 'brightness(0) invert(1)' } : {}} />
                        : <RefreshCw className="w-4 h-4" />
                      }
                      {type.name}
                    </button>
                  ))}
                </div>

                {/* Row 2: Filters (Red block with outlined inputs) */}
                <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Марка"
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                    className="w-full md:flex-1 md:min-w-[100px] bg-transparent border border-white text-white py-2 md:py-1 px-2 lg:px-4 rounded-[12px] text-[12px] lg:text-[13px] font-medium placeholder:text-white/80 text-center focus:outline-none focus:bg-white/10 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Модель"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="w-full md:flex-1 md:min-w-[100px] bg-transparent border border-white text-white py-2 md:py-1 px-2 lg:px-4 rounded-[12px] text-[12px] lg:text-[13px] font-medium placeholder:text-white/80 text-center focus:outline-none focus:bg-white/10 transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Год"
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    className="w-full md:flex-1 md:min-w-[100px] bg-transparent border border-white text-white py-2 md:py-1 px-2 lg:px-4 rounded-[12px] text-[12px] lg:text-[13px] font-medium placeholder:text-white/80 text-center focus:outline-none focus:bg-white/10 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Карта (регион)"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    className="w-full md:flex-1 md:min-w-[100px] bg-transparent border border-white text-white py-2 md:py-1 px-2 lg:px-4 rounded-[12px] text-[12px] lg:text-[13px] font-medium placeholder:text-white/80 text-center focus:outline-none focus:bg-white/10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onQuickSearch?.({
                        offerType: activeType,
                        brand: brand.trim() || undefined,
                        model: model.trim() || undefined,
                        year: year.trim() || undefined,
                        region: region.trim() || undefined,
                      });
                    }}
                    className="col-span-2 md:col-span-1 bg-black text-white p-2 md:p-1 rounded-[12px] hover:bg-gray-900 transition-colors flex items-center justify-center min-w-[50px]"
                    aria-label="Search listings"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content: empty space for car */}
          <div className="flex-1 relative w-full lg:static">
          </div>
        </div>
      </div>
    </section>
  );
};
