import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Check,
  ChevronDown,
  X,
  RotateCcw,
} from 'lucide-react';
import { LocationPickerMapModal } from '../shared/LocationPickerMapModal';
import { DRY_CLEANING_TYPES } from '../../constants/dryCleaning';
import { SORT_OPTIONS as VEHICLE_SORT_OPTIONS } from '../../constants/mockData';
import { DryCleaningListing } from '../../types';
import { openAvtotimeProfile } from '../../utils/avtotime';
import { ServiceFilters } from '../../utils/marketAPI';

interface DryCleaningPageProps {
  listings: DryCleaningListing[];
  onAddListingClick?: () => void;
  onLoadFiltered?: (filters: ServiceFilters) => Promise<DryCleaningListing[]>;
}

const formatPrice = (value: number) => `${value.toLocaleString('ru-RU')} RUB`;

const sortListings = (listings: DryCleaningListing[], sortValue: string) => {
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

export const DryCleaningPage: React.FC<DryCleaningPageProps> = ({ listings, onAddListingClick, onLoadFiltered }) => {
  const [priceRange, setPriceRange] = useState({ min: 0, max: 5000 });
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('Кишинев');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState('Новые');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [serverResults, setServerResults] = useState<DryCleaningListing[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const effectiveRegion = selectedRegion !== 'Кишинев' ? selectedRegion.trim() : '';
      if (effectiveRegion) filters.location = effectiveRegion;
      if (priceRange.min !== 0) filters.priceMin = priceRange.min;
      if (priceRange.max !== 5000) filters.priceMax = priceRange.max;
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
    selectedRegion !== 'Кишинев' ||
    priceRange.min !== 0 ||
    priceRange.max !== 5000 ||
    selectedTypes.length > 0 ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setSelectedRegion('Кишинев');
    setPriceRange({ min: 0, max: 5000 });
    setSelectedTypes([]);
    setSearchQuery('');
    setServerResults(null);
  };

  const baseListings = serverResults ?? listings;
  const filteredListings = useMemo(() => {
    return sortListings(
      baseListings.filter((item) => {
        const searchable = `${item.title} ${item.category} ${item.location} ${item.tags.join(' ')}`.toLowerCase();
        const normalizedQuery = serverResults ? '' : searchQuery.trim().toLowerCase();
        const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
        const matchesRegion = serverResults
          ? true
          : (selectedRegion === 'Кишинев' || !selectedRegion.trim()
            ? true
            : item.location.toLowerCase().includes(selectedRegion.trim().toLowerCase()));
        const matchesPrice = serverResults
          ? true
          : (priceRange.min === 0 && priceRange.max === 5000 ? true : item.price >= priceRange.min && item.price <= priceRange.max);
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(item.category);

        return matchesSearch && matchesRegion && matchesPrice && matchesType;
      }),
      selectedSort,
    );
  }, [baseListings, serverResults, priceRange.max, priceRange.min, searchQuery, selectedRegion, selectedSort, selectedTypes]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(parseInt(e.target.value, 10) || 0, priceRange.max - 50);
    setPriceRange({ ...priceRange, min: Math.max(0, value) });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(parseInt(e.target.value, 10) || 0, priceRange.min + 50);
    setPriceRange({ ...priceRange, max: Math.min(5000, value) });
  };

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
          <h1 className="text-[32px] font-bold text-gray-900 leading-tight">Химчистка</h1>
          <p className="text-[14px] text-gray-500 mt-1">{filteredListings.length} предложений</p>
        </div>

        <div className="mb-8">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Поиск по химчистке"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10 transition-all"
              />
            </div>

            <button
              onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
              className="lg:hidden w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 hover:border-gray-300 transition-all"
            >
              <SlidersHorizontal className="w-5 h-5" />
              Фильтры
            </button>

            <div className="relative w-full lg:w-[260px]">
              <button
                onClick={() => setIsSortOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 hover:border-gray-300 transition-all"
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
              onClick={onAddListingClick}
              className="w-full lg:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Добавить услугу
            </button>
          </div>
        </div>

        <div
          className="flex flex-col lg:flex-row items-start gap-8 lg:pb-4"
          style={{ minHeight: 'calc(100vh - var(--market-header-height, 120px))' }}
        >
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
                <h3 className="text-[16px] font-bold text-gray-900 mb-6">Диапазон цен</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-gray-400 mb-2">От</label>
                    <input
                      type="number"
                      value={priceRange.min}
                      onChange={handleMinChange}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-gray-400 mb-2">До</label>
                    <input
                      type="number"
                      value={priceRange.max}
                      onChange={handleMaxChange}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <h3 className="text-[16px] font-bold text-gray-900 mb-4">Тип услуги</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 py-1 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                      selectedTypes.length === 0 ? 'bg-red-600 border-red-600' : 'border-gray-300 group-hover:border-red-500'
                    }`}>
                      {selectedTypes.length === 0 && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedTypes.length === 0}
                      onChange={() => setSelectedTypes([])}
                    />
                    <span className="text-[14px] text-gray-700">Все</span>
                  </label>

                  {DRY_CLEANING_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                        selectedTypes.includes(type)
                          ? 'bg-red-600 border-red-600'
                          : 'border-gray-300 group-hover:border-red-500'
                      }`}>
                        {selectedTypes.includes(type) && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedTypes.includes(type)}
                        onChange={() =>
                          setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
                        }
                      />
                      <span className="text-[14px] text-gray-700">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setIsMobileFiltersOpen(false)}
                className="lg:hidden w-full py-3 rounded-2xl font-bold text-[16px] bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
              >
                Применить фильтры
              </button>
            </div>
          </aside>

          <div className="flex-1 w-full">
            {filteredListings.length === 0 ? (
              <div className="bg-white rounded-[40px] p-10 border border-gray-100 text-center shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Ничего не найдено</h3>
                <p className="text-gray-500 max-w-xl mx-auto">Попробуйте изменить фильтры или добавьте свою услугу, чтобы она сразу появилась в списке.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredListings.map((item) => (
                <div key={item.id} className="bg-white rounded-[28px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                    </div>
                    {item.badge && (
                      <div className="absolute bottom-4 left-4">
                        <span className="bg-white/95 text-gray-900 px-3 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-2 shadow-sm">
                          <Sparkles className="w-4 h-4 text-red-600" />
                          {item.badge}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{item.title}</h3>
                    <div className="flex items-center gap-1.5 text-gray-500 text-[14px] mb-4">
                      <MapPin className="w-4 h-4" />
                      {item.location}
                    </div>

                    {(item.rating > 0 || item.reviews > 0) && (
                      <div className="flex items-center gap-2 mb-5">
                        <span className="font-bold text-gray-900">{item.rating}/5</span>
                        <span className="text-gray-400 text-[14px]">({item.reviews} отзывов)</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-6">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="bg-gray-50 text-gray-600 px-3 py-1 rounded-full text-[12px] font-bold">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900">{formatPrice(item.price)}</span>
                        <span className="text-gray-400 text-[14px]">/услуга</span>
                      </div>
                      <button
                        onClick={() => openAvtotimeProfile(item.socialNickname)}
                        className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors"
                      >
                        Забронировать
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

