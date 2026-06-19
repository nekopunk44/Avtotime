import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  MapPin,
  Plus,
  MessageCircle,
  ArrowLeftRight,
  Zap,
  Flame,
  Wind,
  Activity,
  ChevronDown,
  SlidersHorizontal,
  X,
  RotateCcw,
} from 'lucide-react';
import { LocationPickerMapModal } from '../shared/LocationPickerMapModal';
import { AUTO_TUNING_TYPES } from '../../constants/autoTuning';
import { SORT_OPTIONS as VEHICLE_SORT_OPTIONS } from '../../constants/mockData';
import { AutoTuningListing } from '../../types';
import { openAvtotimeProfile } from '../../utils/avtotime';
import { ServiceFilters } from '../../utils/marketAPI';

interface AutoTuningPageProps {
  listings: AutoTuningListing[];
  onAddListingClick?: () => void;
  onOpenMyListings?: () => void;
  onLoadFiltered?: (filters: ServiceFilters) => Promise<AutoTuningListing[]>;
}

const TUNING_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ecu: Zap,
  turbo: Flame,
  exhaust: Wind,
  suspension: Activity,
};

const getTypeIdByCategory = (category: string) => {
  const normalized = category.toLowerCase();

  if (normalized.includes('ecu') || normalized.includes('чип')) return 'ecu';
  if (normalized.includes('турбо') || normalized.includes('компресс')) return 'turbo';
  if (normalized.includes('выхлоп')) return 'exhaust';
  if (normalized.includes('подвес')) return 'suspension';

  return '';
};

const sortListings = (listings: AutoTuningListing[], sortValue: string) => {
  const nextListings = [...listings];

  switch (sortValue) {
    case 'Старые':
      return nextListings.sort((a, b) => a.id - b.id);
    case 'Цена: от низкой к высокой':
      return nextListings.sort((a, b) => a.price - b.price);
    case 'Цена: от высокой к низкой':
      return nextListings.sort((a, b) => b.price - a.price);
    default:
      return nextListings.sort((a, b) => b.id - a.id);
  }
};

export const AutoTuningPage: React.FC<AutoTuningPageProps> = ({
  listings,
  onAddListingClick,
  onOpenMyListings,
  onLoadFiltered,
}) => {
  const [priceRange, setPriceRange] = useState({ min: 0, max: 200000 });
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('Москва');
  const [selectedTuningTypes, setSelectedTuningTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState('Новые');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [serverResults, setServerResults] = useState<AutoTuningListing[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpenMyListings = () => {
    if (onOpenMyListings) {
      onOpenMyListings();
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.assign('/market?view=settings-listings');
    }
  };

  const stickyTopOffset = 'calc(var(--market-header-height, 120px) + 24px)';
  const stickyViewportHeight = 'calc(100vh - var(--market-header-height, 120px) - 16px)';

  useEffect(() => {
    if (isMobileFiltersOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileFiltersOpen]);

  useEffect(() => {
    if (!onLoadFiltered) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const filters: ServiceFilters = {};
      if (searchQuery.trim()) filters.q = searchQuery.trim();
      const effectiveRegion = selectedRegion !== 'Москва' ? selectedRegion.trim() : '';
      if (effectiveRegion) filters.location = effectiveRegion;
      if (priceRange.min !== 0) filters.priceMin = priceRange.min;
      if (priceRange.max !== 200000) filters.priceMax = priceRange.max;
      try {
        const results = await onLoadFiltered(filters);
        setServerResults(results);
      } catch {
        setServerResults(null);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, selectedRegion, priceRange, onLoadFiltered]);

  const isFiltersActive =
    selectedRegion !== 'Москва' ||
    priceRange.min !== 0 ||
    priceRange.max !== 200000 ||
    selectedTuningTypes.length > 0;

  const resetFilters = () => {
    setSelectedRegion('Москва');
    setPriceRange({ min: 0, max: 200000 });
    setSelectedTuningTypes([]);
    setServerResults(null);
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(parseInt(e.target.value, 10), priceRange.max - 5000);
    setPriceRange({ ...priceRange, min: value });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(parseInt(e.target.value, 10), priceRange.min + 5000);
    setPriceRange({ ...priceRange, max: value });
  };

  const baseListings = serverResults ?? listings;
  const filteredListings = sortListings(
    baseListings.filter((shop) => {
      const searchable = `${shop.title} ${shop.category} ${shop.location} ${shop.tags.join(' ')}`.toLowerCase();
      const normalizedQuery = serverResults ? '' : searchQuery.trim().toLowerCase();
      const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesRegion = serverResults
        ? true
        : (selectedRegion === 'Москва' || !selectedRegion.trim()
          ? true
          : shop.location.toLowerCase().includes(selectedRegion.trim().toLowerCase()));
      const matchesPrice = serverResults
        ? true
        : (priceRange.min === 0 && priceRange.max === 200000
          ? true
          : shop.price >= priceRange.min && shop.price <= priceRange.max);
      const shopTypeId = getTypeIdByCategory(shop.category);
      const matchesType = selectedTuningTypes.length === 0 || selectedTuningTypes.includes(shopTypeId);

      return matchesSearch && matchesRegion && matchesPrice && matchesType;
    }),
    selectedSort,
  );

  return (
    <div className="bg-gray-50 pt-8 pb-8 lg:pb-10">
      <LocationPickerMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelect={(picked) => setSelectedRegion(picked.label)}
        selectedRegion={selectedRegion}
      />

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-gray-900 leading-tight">Автотюнинг</h1>
          <p className="text-[14px] text-gray-500 mt-1">{filteredListings.length} найденных вариантов</p>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-4 mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск услуг или ателье"
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <button
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="lg:hidden flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 hover:border-gray-300 transition-all shadow-sm"
            >
              <SlidersHorizontal className="w-5 h-5" />
              Фильтры
            </button>

            <div className="relative flex-1 lg:flex-none min-w-[160px]">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="w-full flex items-center justify-between px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 hover:border-gray-300 transition-all shadow-sm"
              >
                <span>{selectedSort}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSortOpen && (
                <div className="absolute top-full right-0 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl z-30 py-2 animate-in fade-in zoom-in-95 duration-200">
                  {VEHICLE_SORT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSelectedSort(option);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-5 py-2.5 text-sm transition-colors ${
                        selectedSort === option ? 'text-red-600 bg-red-50 font-bold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleOpenMyListings}
              className="flex-1 lg:flex-none px-6 py-3 bg-black text-white rounded-xl font-bold text-sm transition-all hover:bg-gray-900 shadow-sm"
            >
              Мои объявления
            </button>

            <button
              onClick={onAddListingClick}
              className="flex-1 lg:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Добавить услугу
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-8 lg:pb-4">
          <aside
            className={`fixed inset-0 z-[100] flex flex-col bg-white lg:relative lg:inset-auto lg:z-auto lg:w-80 lg:flex-shrink-0 lg:self-start lg:sticky lg:block transition-transform duration-300 ease-out ${isMobileFiltersOpen ? 'translate-y-0 visible' : 'translate-y-full invisible lg:translate-y-0 lg:visible pointer-events-none lg:pointer-events-auto'}`}
            style={{ top: stickyTopOffset }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 lg:hidden shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Фильтры</h2>
              <div className="flex items-center gap-2">
                {isFiltersActive && (
                  <button onClick={resetFilters} className="text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 text-sm font-medium">
                    <RotateCcw className="w-4 h-4" />
                    Сбросить
                  </button>
                )}
                <button onClick={() => setIsMobileFiltersOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              className="bg-white lg:rounded-[32px] p-5 lg:p-7 lg:shadow-sm lg:border lg:border-gray-100 lg:overflow-y-auto overflow-y-auto flex-1"
              style={{ maxHeight: stickyViewportHeight }}
            >
              <div className="hidden lg:flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-bold text-gray-900">Фильтры</h2>
                {isFiltersActive && (
                  <button onClick={resetFilters} className="text-[14px] font-bold text-red-600 hover:text-red-700 transition-colors">
                    Сбросить
                  </button>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-[16px] font-bold text-gray-900 mb-4">Регион</h3>
                <div className="space-y-2.5">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Написать регион"
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full pl-11 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10 transition-all"
                    />
                  </div>
                  <button
                    onClick={() => setIsMapOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all"
                  >
                    <MapPin className="w-4 h-4" />
                    Выбрать на карте
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-[16px] font-bold text-gray-900 mb-8">Диапазон цен</h3>
                <div className="relative h-2 w-full bg-gray-100 rounded-full">
                  <div
                    className="absolute h-full bg-red-600 rounded-full"
                    style={{
                      left: `${(priceRange.min / 200000) * 100}%`,
                      right: `${100 - (priceRange.max / 200000) * 100}%`,
                    }}
                  />

                  <div
                    className="absolute -top-8 px-2 py-1 bg-red-600 text-white text-[11px] font-bold rounded shadow-lg -translate-x-1/2 pointer-events-none"
                    style={{ left: `${(priceRange.min / 200000) * 100}%` }}
                  >
                    {priceRange.min.toLocaleString('ru-RU')}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600 rotate-45"></div>
                  </div>
                  <div
                    className="absolute -top-8 px-2 py-1 bg-red-600 text-white text-[11px] font-bold rounded shadow-lg -translate-x-1/2 pointer-events-none"
                    style={{ left: `${(priceRange.max / 200000) * 100}%` }}
                  >
                    {priceRange.max.toLocaleString('ru-RU')}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600 rotate-45"></div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="200000"
                    step="5000"
                    value={priceRange.min}
                    onChange={handleMinChange}
                    className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-600 [&::-webkit-slider-thumb]:shadow-md"
                  />
                  <input
                    type="range"
                    min="0"
                    max="200000"
                    step="5000"
                    value={priceRange.max}
                    onChange={handleMaxChange}
                    className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-600 [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>
                <div className="flex justify-between text-[12px] font-bold text-gray-400 mt-3">
                  <span>0 RUB</span>
                  <span>200 000 RUB</span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-[16px] font-bold text-gray-900 mb-4">Тип тюнинга</h3>
                <div className="space-y-3">
                  {AUTO_TUNING_TYPES.map((type) => {
                    const Icon = TUNING_TYPE_ICONS[type.id] || Zap;
                    return (
                      <label key={type.id} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center w-5 h-5 border-2 border-gray-300 rounded group-hover:border-red-500 transition-colors">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={selectedTuningTypes.includes(type.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTuningTypes([...selectedTuningTypes, type.id]);
                              } else {
                                setSelectedTuningTypes(selectedTuningTypes.filter((item) => item !== type.id));
                              }
                            }}
                          />
                          <div className="absolute inset-0 bg-red-600 rounded opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                          <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">{type.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                disabled={!isFiltersActive}
                onClick={() => setIsMobileFiltersOpen(false)}
                className={`w-full py-3 rounded-2xl font-bold text-[16px] transition-all ${
                  isFiltersActive
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Применить фильтры
              </button>
            </div>
          </aside>

          <div className="flex-1">
            {filteredListings.length === 0 ? (
              <div className="bg-white rounded-[40px] p-10 border border-gray-100 text-center shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Ничего не найдено</h3>
                <p className="text-gray-500 max-w-xl mx-auto">Попробуйте изменить фильтры или добавьте свою услугу, чтобы она сразу появилась в списке.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredListings.map((shop) => (
                <div key={shop.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col">
                  <div className="relative h-56">
                    <img src={shop.image} alt={shop.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute top-4 left-4 bg-[#e85d04] text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      {shop.badge}
                    </div>
                  </div>

                  <div className="p-6 flex flex-col flex-grow">
                    <div className="inline-block border border-gray-200 text-gray-600 text-[11px] font-medium px-3 py-1 rounded-full mb-4 self-start">
                      {shop.category}
                    </div>
                    <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">{shop.title}</h3>
                    <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-4">
                      <MapPin className="w-4 h-4" />
                      {shop.location}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {shop.tags.map((tag) => (
                        <span key={tag} className="bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded-lg font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-end justify-between mb-6">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Начиная от</div>
                        <div className="text-2xl font-bold text-red-600">{shop.price.toLocaleString('ru-RU')} RUB</div>
                      </div>
                      {(shop.rating > 0 || shop.reviews > 0) && (
                        <div className="text-xs text-gray-500">{shop.reviews} отзывов</div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => openAvtotimeProfile(shop.socialNickname)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Связаться
                      </button>
                      <button className="w-12 h-12 flex items-center justify-center border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors">
                        <ArrowLeftRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
