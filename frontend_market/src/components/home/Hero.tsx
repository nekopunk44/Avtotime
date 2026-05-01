import React, { useState, Suspense, lazy, useCallback } from 'react';
import { Search, ShoppingCart, Car, Key, RefreshCw } from 'lucide-react';

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
  if (country === 'US') return (
    <div className="w-full h-full relative overflow-hidden">
      {/* 13 full-width stripes */}
      <div className="absolute inset-0 flex flex-col">
        {Array.from({ length: 13 }).map((_, i) => (
          <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-[#B22234]' : 'bg-white'}`} />
        ))}
      </div>
      {/* Blue canton covering top-left (top 7 stripes ≈ 53.8% height, ~40% width) */}
      <div className="absolute top-0 left-0 w-[40%] h-[53.8%] bg-[#3C3B6E] flex flex-wrap items-center justify-center gap-[1px] p-[2px]">
        {Array.from({ length: 50 }).map((_, i) => (
          <span key={i} className="text-white leading-none" style={{ fontSize: '3px' }}>★</span>
        ))}
      </div>
    </div>
  );
  if (country === 'JP') return (
    <div className="w-full h-full bg-white flex items-center justify-center">
      <div className="w-[37%] aspect-square rounded-full bg-[#BC002D]" />
    </div>
  );
  // Default: Germany
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 bg-[#000000]" />
      <div className="flex-1 bg-[#DD0000]" />
      <div className="flex-1 bg-[#FFCE00]" />
    </div>
  );
}

export const Hero: React.FC<HeroProps> = ({ setCurrentPage, onQuickSearch }) => {
  const [activeType, setActiveType] = useState('Продажа');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [region, setRegion] = useState('');
  const [carCountry, setCarCountry] = useState('US');

  return (
    <section className="bg-[#D9D9D9] pt-4 pb-12 lg:pt-6 lg:pb-20 overflow-hidden relative min-h-[450px] lg:min-h-[500px] flex items-start">
      {/* 3D Car Model */}
      <div className="hidden md:block absolute right-0 bottom-0 w-[65%] z-0" style={{ height: '100%', minHeight: '450px' }}>
        <Suspense fallback={null}>
          <CarModel3D onCountryChange={setCarCountry} />
        </Suspense>
      </div>

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 pt-4 lg:pt-8">
        {/* Header with Title and Flag */}
        <div className="flex items-center justify-between mb-6">
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
              className="hidden md:block text-[10px] md:text-[12px] text-gray-600 hover:text-black transition-colors whitespace-nowrap"
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
          
          {/* Left Content: Search Box */}
          <div className="w-full md:w-[600px] lg:w-[650px] shrink-0">
            {/* Search Container */}
            <div className="relative">
              {/* Red Border Box */}
              <div className="bg-[#FF0000] p-3 md:p-2 rounded-[12px] shadow-lg">
                {/* Row 1: Offer Types (White block with full rounding) */}
                <div className="bg-white rounded-[12px] grid grid-cols-2 md:flex mb-3 md:mb-2 overflow-hidden">
                  {[
                    { name: 'Продажа', icon: <ShoppingCart className="w-4 h-4" /> },
                    { name: 'Покупка', icon: <Car className="w-4 h-4" /> },
                    { name: 'Аренда', icon: <Key className="w-4 h-4" /> },
                    { name: 'Обмен', icon: <RefreshCw className="w-4 h-4" /> }
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
                      {type.icon}
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
