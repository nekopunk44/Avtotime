import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  MapPin,
  Heart,
  Scale,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Plus,
  Check,
  ChevronDown,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { LocationPickerMapModal } from '../shared/LocationPickerMapModal';
import { CAR_SERVICE_TYPES } from '../../constants/carServices';
import { SORT_OPTIONS as VEHICLE_SORT_OPTIONS } from '../../constants/mockData';
import { CarServiceListing } from '../../types';
import { openAvtotimeProfile } from '../../utils/avtotime';
import { ServiceFilters } from '../../utils/marketAPI';

const QUALITY_OPTIONS = [
  { label: '5/5', value: 5 },
  { label: '4/5', value: 4 },
  { label: '3/5', value: 3 },
  { label: '2/5', value: 2 },
  { label: '1/5', value: 1 },
];

const formatServicePrice = (service: CarServiceListing) => {
  const prefix = service.pricePrefix ? `${service.pricePrefix} ` : '';
  return `${prefix}${service.price.toLocaleString('ru-RU')} RUB`;
};

const getServiceQuality = (service: CarServiceListing) => {
  const legacyRating = (service as CarServiceListing & { rating?: number }).rating;

  if (typeof service.serviceQuality === 'number' && service.serviceQuality > 0) {
    return service.serviceQuality;
  }

  if (typeof legacyRating === 'number' && legacyRating > 0) {
    return Math.max(1, Math.min(5, Math.round(legacyRating)));
  }

  return 0;
};

interface CarServicesPageProps {
  services: CarServiceListing[];
  compareList?: { id: number; type: string }[];
  toggleCompare?: (id: number, type: string) => void;
  onAddListingClick?: () => void;
  onOpenMyListings?: () => void;
  onLoadFiltered?: (filters: ServiceFilters) => Promise<CarServiceListing[]>;
}

export function CarServicesPage({
  services,
  compareList = [],
  toggleCompare,
  onAddListingClick,
  onOpenMyListings,
  onLoadFiltered,
}: CarServicesPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [serverResults, setServerResults] = useState<CarServiceListing[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState('Новые');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [selectedServiceQuality, setSelectedServiceQuality] = useState<number | null>(null);

  const stickyTopOffset = 'calc(var(--market-header-height, 120px) + 24px)';
  const stickyViewportHeight = 'calc(100vh - var(--market-header-height, 120px) - 16px)';

  useEffect(() => {
    if (!onLoadFiltered) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const filters: ServiceFilters = {};
      if (searchQuery.trim()) filters.q = searchQuery.trim();
      if (selectedRegion.trim()) filters.location = selectedRegion.trim();
      if (priceRange.min !== '') filters.priceMin = Number(priceRange.min);
      if (priceRange.max !== '') filters.priceMax = Number(priceRange.max);
      if (selectedServiceQuality !== null) filters.minQuality = selectedServiceQuality;
      try {
        const results = await onLoadFiltered(filters);
        setServerResults(results);
      } catch {
        setServerResults(null);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, selectedRegion, priceRange, selectedServiceQuality, onLoadFiltered]);

  const minPrice = 0;
  const maxPrice = 5000;
  const currentMin = priceRange.min === '' ? minPrice : Number(priceRange.min);
  const currentMax = priceRange.max === '' ? maxPrice : Number(priceRange.max);

  const handleReset = () => {
    setSearchQuery('');
    setPriceRange({ min: '', max: '' });
    setSelectedSort('Новые');
    setSelectedRegion('');
    setSelectedServiceTypes([]);
    setSelectedServiceQuality(null);
    setServerResults(null);
  };

  const handleOpenMyListings = () => {
    if (onOpenMyListings) {
      onOpenMyListings();
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.assign('/market?view=settings-listings');
    }
  };

  const isFilterActive =
    searchQuery !== '' ||
    priceRange.min !== '' ||
    priceRange.max !== '' ||
    selectedRegion !== '' ||
    selectedServiceTypes.length > 0 ||
    selectedServiceQuality !== null;

  const toggleServiceType = (type: string) => {
    setSelectedServiceTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), currentMax - 100);
    setPriceRange({ ...priceRange, min: value.toString() });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), currentMin + 100);
    setPriceRange({ ...priceRange, max: value.toString() });
  };

  const baseServices = serverResults ?? services;
  const filteredServices = baseServices.filter((service) => {
    const serviceQuality = getServiceQuality(service);
    const normalizedQuery = serverResults ? '' : searchQuery.trim().toLowerCase();
    const searchable = `${service.title} ${service.category} ${service.location}`.toLowerCase();
    const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
    const matchesRegion = serverResults ? true : (!selectedRegion.trim() || service.location.toLowerCase().includes(selectedRegion.trim().toLowerCase()));
    const matchesType = selectedServiceTypes.length === 0 || selectedServiceTypes.includes(service.category);
    const matchesServiceQuality = serverResults ? true : (selectedServiceQuality === null || serviceQuality >= selectedServiceQuality);
    const matchesPrice = serverResults ? true : (service.price >= currentMin && service.price <= currentMax);

    return matchesSearch && matchesRegion && matchesType && matchesServiceQuality && matchesPrice;
  });

  return (
    <div className="bg-gray-50 pb-8 lg:pb-10">
      <LocationPickerMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelect={setSelectedRegion}
        selectedRegion={selectedRegion}
      />

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-gray-900 leading-tight">Автосервисы</h1>
          <p className="text-[14px] text-gray-500 mt-1">{filteredServices.length} найденных вариантов</p>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-4 mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск услуг или сервисов"
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
              Добавить объявление
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-8 lg:pb-4">
          <aside
            className={`w-full pt-4 lg:pt-0 lg:w-80 flex-shrink-0 lg:self-start lg:sticky ${isMobileFiltersOpen ? 'block' : 'hidden lg:block'}`}
            style={{ top: stickyTopOffset }}
          >
            <div
              className="bg-white rounded-[32px] p-5 lg:p-6 border border-gray-100 shadow-sm lg:overflow-y-auto"
              style={{ maxHeight: stickyViewportHeight }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Фильтры</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 text-sm font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Сбросить
                  </button>
                  <button
                    onClick={() => setIsMobileFiltersOpen(false)}
                    className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[15px] font-bold text-gray-900 mb-3">Регион</label>
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

              <div className="mb-6">
                <label className="block text-[15px] font-bold text-gray-900 mb-3">Диапазон цен</label>
                <div className="px-2 mb-4 relative h-6 flex items-center">
                  <div className="absolute w-full h-1.5 bg-gray-100 rounded-full">
                    <div
                      className="absolute h-full bg-red-500 rounded-full"
                      style={{
                        left: `${((currentMin - minPrice) / (maxPrice - minPrice)) * 100}%`,
                        right: `${100 - ((currentMax - minPrice) / (maxPrice - minPrice)) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    min={minPrice}
                    max={maxPrice}
                    step="50"
                    value={currentMin}
                    onChange={handleMinChange}
                    className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none z-20 cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                  />
                  <input
                    type="range"
                    min={minPrice}
                    max={maxPrice}
                    step="50"
                    value={currentMax}
                    onChange={handleMaxChange}
                    className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none z-20 cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">от</span>
                    <input
                      type="number"
                      placeholder="Мин"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-8 pr-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-red-500"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                    />
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">до</span>
                    <input
                      type="number"
                      placeholder="Макс"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-8 pr-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-red-500"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[15px] font-bold text-gray-900">Тип услуги</label>
                  <ChevronRight className="w-4 h-4 text-gray-400 -rotate-90" />
                </div>
                <div className="space-y-2.5">
                  {CAR_SERVICE_TYPES.map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => toggleServiceType(type)}
                    >
                      <div
                        className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                          selectedServiceTypes.includes(type)
                            ? 'border-red-500 bg-red-500'
                            : 'border-gray-200 group-hover:border-red-500'
                        }`}
                      >
                        {selectedServiceTypes.includes(type) && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                      </div>
                      <span
                        className={`text-[14px] transition-colors ${
                          selectedServiceTypes.includes(type) ? 'text-gray-900 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                        }`}
                      >
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[15px] font-bold text-gray-900">Качество обслуживания</label>
                  <ChevronRight className="w-4 h-4 text-gray-400 -rotate-90" />
                </div>
                <div className="space-y-2.5">
                  {QUALITY_OPTIONS.map((quality) => (
                    <label
                      key={quality.value}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => setSelectedServiceQuality(quality.value)}
                    >
                      <div
                        className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${
                          selectedServiceQuality === quality.value
                            ? 'border-red-500 bg-red-500'
                            : 'border-gray-200 group-hover:border-red-500'
                        }`}
                      >
                        {selectedServiceQuality === quality.value && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                      <span
                        className={`text-[14px] transition-colors ${
                          selectedServiceQuality === quality.value ? 'text-gray-900 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                        }`}
                      >
                        {quality.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                disabled={!isFilterActive}
                className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${
                  isFilterActive
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                Применить фильтры
              </button>
            </div>
          </aside>

          <div className="flex-1">
            {filteredServices.length === 0 ? (
              <div className="bg-white rounded-[40px] p-10 border border-gray-100 text-center shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Ничего не найдено</h3>
                <p className="text-gray-500 max-w-xl mx-auto">Попробуйте изменить фильтры или добавьте свою услугу, чтобы она сразу появилась в списке.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {filteredServices.map((service) => (
                <div key={service.id} className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
                  {(() => {
                    const serviceQuality = getServiceQuality(service);

                    return (
                      <>
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider">
                        {service.category}
                      </span>
                    </div>
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompare?.(service.id, 'service');
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm backdrop-blur-sm ${
                          compareList.some((item) => item.id === service.id && item.type === 'service')
                            ? 'bg-red-600 text-white'
                            : 'bg-white/90 text-gray-900 hover:bg-white'
                        }`}
                      >
                        <Scale className="w-5 h-5" />
                      </button>
                      <button className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-900 hover:bg-white transition-colors shadow-sm">
                        <Heart className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors leading-tight">
                      {service.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-gray-500 text-[14px] mb-4">
                      <MapPin className="w-4 h-4" />
                      {service.location}
                    </div>
                    {(serviceQuality > 0 || service.reviews > 0) && (
                      <div className="flex items-center gap-2 mb-6">
                        <span className="font-bold text-gray-900">{serviceQuality}/5</span>
                        <span className="text-gray-400 text-[14px]">({service.reviews} отзывов)</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">{formatServicePrice(service)}</span>
                        <span className="text-gray-400 text-[14px] ml-1">{service.unit}</span>
                      </div>
                      <button
                        onClick={() => openAvtotimeProfile(service.socialNickname)}
                        className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors"
                      >
                        Забронировать
                      </button>
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
            )}

          </div>
        </div>
      </div>

      <button
        onClick={onAddListingClick}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl z-50 hover:bg-red-700 transition-colors"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
}
