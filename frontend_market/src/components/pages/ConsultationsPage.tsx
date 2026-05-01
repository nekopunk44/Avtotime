import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Star,
  CheckCircle2,
  Calendar,
  Scale,
  Search,
  ShieldCheck,
  Car,
  Check,
  ChevronDown,
  SlidersHorizontal,
  Plus,
} from 'lucide-react';
import { LocationPickerMapModal } from '../shared/LocationPickerMapModal';
import { SORT_OPTIONS as VEHICLE_SORT_OPTIONS } from '../../constants/mockData';
import { ConsultationExpert } from '../../types';
import { openAvtotimeProfile } from '../../utils/avtotime';
import { ConsultationFilters } from '../../utils/marketAPI';

interface ConsultationsPageProps {
  experts: ConsultationExpert[];
  compareList?: { id: number; type: string }[];
  toggleCompare?: (id: number, type: string) => void;
  onAddServiceClick?: () => void;
  onOpenMyListings?: () => void;
  onLoadFiltered?: (filters: ConsultationFilters) => Promise<ConsultationExpert[]>;
}

const CONSULTATION_TYPE_FILTERS = [
  { id: 'legal', label: 'Юридическая помощь', icon: Scale },
  { id: 'tech', label: 'Технический осмотр', icon: Search },
  { id: 'insurance', label: 'Страхование', icon: ShieldCheck },
  { id: 'purchase', label: 'Помощь в покупке', icon: Car },
  { id: 'verified', label: 'Только проверенные', icon: CheckCircle2, color: 'text-green-500' },
];

const matchesType = (expert: ConsultationExpert, typeId: string) => {
  const searchable = `${expert.specialties.join(' ')} ${expert.tags.join(' ')}`.toLowerCase();

  switch (typeId) {
    case 'legal':
      return /юрист|прав|дтп|договор|тамож/.test(searchable);
    case 'tech':
      return /тех|осмотр|диагност|кузов|эксперт/.test(searchable);
    case 'insurance':
      return /страх/.test(searchable);
    case 'purchase':
      return /покуп|подбор|купли/.test(searchable);
    case 'verified':
      return expert.isVerified;
    default:
      return true;
  }
};

const sortExperts = (experts: ConsultationExpert[], sortValue: string) => {
  const nextExperts = [...experts];

  switch (sortValue) {
    case 'Старые':
      return nextExperts.sort((a, b) => a.id - b.id);
    case 'Цена: от низкой к высокой':
      return nextExperts.sort((a, b) => a.hourlyRate - b.hourlyRate);
    case 'Цена: от высокой к низкой':
      return nextExperts.sort((a, b) => b.hourlyRate - a.hourlyRate);
    default:
      return nextExperts.sort((a, b) => b.id - a.id);
  }
};

const formatExperienceYears = (years: number) => {
  const mod10 = years % 10;
  const mod100 = years % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${years} год`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${years} года`;
  }

  return `${years} лет`;
};

export const ConsultationsPage: React.FC<ConsultationsPageProps> = ({
  experts,
  compareList = [],
  toggleCompare,
  onAddServiceClick,
  onOpenMyListings,
  onLoadFiltered,
}) => {
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState('Новые');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [serverResults, setServerResults] = useState<ConsultationExpert[] | null>(null);
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
    if (!onLoadFiltered) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const filters: ConsultationFilters = {};
      if (searchQuery.trim()) filters.q = searchQuery.trim();
      if (selectedRegion.trim()) filters.location = selectedRegion.trim();
      if (priceRange.min !== 0) filters.minRate = priceRange.min;
      if (priceRange.max !== 10000) filters.maxRate = priceRange.max;
      try {
        const results = await onLoadFiltered(filters);
        setServerResults(results);
      } catch {
        setServerResults(null);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, selectedRegion, priceRange, onLoadFiltered]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(parseInt(e.target.value, 10), priceRange.max - 500);
    setPriceRange({ ...priceRange, min: value });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(parseInt(e.target.value, 10), priceRange.min + 500);
    setPriceRange({ ...priceRange, max: value });
  };

  const toggleType = (typeId: string) => {
    setSelectedTypes((prev) => (prev.includes(typeId) ? prev.filter((item) => item !== typeId) : [...prev, typeId]));
  };

  const baseExperts = serverResults ?? experts;
  const filteredExperts = sortExperts(
    baseExperts.filter((expert) => {
      const searchableText = `${expert.name} ${expert.location} ${expert.specialties.join(' ')} ${expert.tags.join(' ')}`.toLowerCase();
      const normalizedQuery = serverResults ? '' : searchQuery.trim().toLowerCase();
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesRegion = serverResults ? true : (!selectedRegion.trim() || expert.location.toLowerCase().includes(selectedRegion.trim().toLowerCase()));
      const matchesPrice = serverResults ? true : (expert.hourlyRate >= priceRange.min && expert.hourlyRate <= priceRange.max);
      const matchesSelectedTypes = selectedTypes.every((typeId) => matchesType(expert, typeId));

      return matchesSearch && matchesRegion && matchesPrice && matchesSelectedTypes;
    }),
    selectedSort,
  );

  return (
    <div className="bg-gray-50 pb-8 lg:pb-10">
      <LocationPickerMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelect={setSelectedRegion}
        selectedRegion={selectedRegion}
      />

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-gray-900 leading-tight">Автоконсультации</h1>
          <p className="text-[14px] text-gray-500 mt-1">{filteredExperts.length} найденных вариантов</p>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-4 mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск экспертов и услуг"
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
              onClick={onAddServiceClick}
              className="flex-1 lg:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Добавить услугу
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-8 lg:pb-4">
          <aside
            className={`w-full pt-4 lg:pt-0 lg:w-80 flex-shrink-0 lg:self-start lg:sticky ${isMobileFiltersOpen ? 'block' : 'hidden lg:block'}`}
            style={{ top: stickyTopOffset }}
          >
            <div
              className="bg-white rounded-[32px] p-5 lg:p-6 shadow-sm border border-gray-100 lg:overflow-y-auto"
              style={{ maxHeight: stickyViewportHeight }}
            >
              <div className="mb-6">
                <h2 className="text-[22px] font-bold text-gray-900">Фильтры</h2>
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
                <h3 className="text-[16px] font-bold text-gray-900 mb-8">Стоимость часа</h3>
                <div className="relative h-2 w-full bg-gray-100 rounded-full">
                  <div
                    className="absolute h-full bg-red-600 rounded-full"
                    style={{
                      left: `${(priceRange.min / 10000) * 100}%`,
                      right: `${100 - (priceRange.max / 10000) * 100}%`,
                    }}
                  />

                  <div
                    className="absolute -top-8 px-2 py-1 bg-red-600 text-white text-[11px] font-bold rounded shadow-lg -translate-x-1/2 pointer-events-none"
                    style={{ left: `${(priceRange.min / 10000) * 100}%` }}
                  >
                    {priceRange.min.toLocaleString('ru-RU')}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600 rotate-45"></div>
                  </div>
                  <div
                    className="absolute -top-8 px-2 py-1 bg-red-600 text-white text-[11px] font-bold rounded shadow-lg -translate-x-1/2 pointer-events-none"
                    style={{ left: `${(priceRange.max / 10000) * 100}%` }}
                  >
                    {priceRange.max.toLocaleString('ru-RU')}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600 rotate-45"></div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="500"
                    value={priceRange.min}
                    onChange={handleMinChange}
                    className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-600 [&::-webkit-slider-thumb]:shadow-md"
                  />
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="500"
                    value={priceRange.max}
                    onChange={handleMaxChange}
                    className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-600 [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>
                <div className="flex justify-between text-[12px] font-bold text-gray-400 mt-3">
                  <span>0 RUB</span>
                  <span>10 000 RUB</span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-[16px] font-bold text-gray-900 mb-4">Тип консультации</h3>
                <div className="flex flex-col gap-3">
                  {CONSULTATION_TYPE_FILTERS.map((type) => (
                    <label
                      key={type.id}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => toggleType(type.id)}
                    >
                      <div
                        className={`relative flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                          selectedTypes.includes(type.id)
                            ? 'border-red-600 bg-red-600'
                            : 'border-gray-300 group-hover:border-red-500'
                        }`}
                      >
                        {selectedTypes.includes(type.id) && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <type.icon className={`w-5 h-5 ${type.color || 'text-gray-400'} group-hover:text-gray-600 transition-colors`} />
                        <span className="text-[15px] font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{type.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold text-[16px] hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">
                Применить фильтры
              </button>
            </div>
          </aside>

          <div className="flex-1">
            {filteredExperts.length > 0 ? (
              <div className="flex flex-col gap-6">
                {filteredExperts.map((expert) => (
                  <div key={expert.id} className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 hover:shadow-md transition-shadow">
                    <div className="flex flex-col items-center text-center w-full md:w-[240px] flex-shrink-0">
                    <div className="relative mb-4">
                      <img
                        src={expert.avatar}
                        alt={expert.name}
                        className="w-[160px] h-[160px] rounded-full object-cover border-4 border-gray-50"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <h3 className="text-[20px] font-bold text-gray-900 mb-2">{expert.name}</h3>
                      {expert.isVerified && (
                        <div className="flex items-center gap-1.5 bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-[13px] font-bold mb-3">
                          <CheckCircle2 className="w-4 h-4" />
                          Проверен
                        </div>
                      )}
                      {(expert.rating > 0 || expert.reviewsCount > 0) && (
                        <div className="flex items-center gap-1.5">
                          <Star className="w-5 h-5 text-orange-400 fill-orange-400" />
                          <span className="text-[16px] font-bold text-gray-900">{expert.rating}</span>
                          <span className="text-[14px] text-gray-400 font-medium">({expert.reviewsCount})</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-6">
                        {expert.specialties.map((spec) => (
                          <span key={spec} className="bg-gray-50 text-gray-600 px-4 py-1.5 rounded-full text-[13px] font-bold border border-gray-100">
                            {spec}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-red-50 rounded-3xl p-6 text-center">
                          <div className="text-[28px] font-bold text-red-600 mb-1">{formatExperienceYears(expert.experience)}</div>
                          <div className="text-[13px] text-gray-500 font-bold uppercase tracking-wider">Опыт</div>
                        </div>
                        <div className="bg-gray-50 rounded-3xl p-6 text-center">
                          <div className="text-[28px] font-bold text-gray-900 mb-1">{expert.consultations}+</div>
                          <div className="text-[13px] text-gray-500 font-bold uppercase tracking-wider">Консультации</div>
                        </div>
                        <div className="bg-gray-50 rounded-3xl p-6 text-center">
                          <div className="text-[28px] font-bold text-red-600 mb-1">{expert.hourlyRate.toLocaleString('ru-RU')}</div>
                          <div className="text-[13px] text-gray-500 font-bold uppercase tracking-wider">RUB/час</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-8">
                        {expert.tags.map((tag) => (
                          <span key={tag} className="bg-gray-50 text-gray-600 px-4 py-1.5 rounded-xl text-[13px] font-medium border border-gray-100">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-2 text-gray-500">
                          <MapPin className="w-5 h-5" />
                          <span className="text-[15px] font-medium">{expert.location}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openAvtotimeProfile(expert.socialNickname)}
                            className="flex-1 md:flex-none bg-red-600 text-white px-8 lg:px-12 py-4 rounded-2xl font-bold text-[16px] hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-red-600/20 active:scale-95"
                          >
                            <Calendar className="w-5 h-5" />
                            Записаться на консультацию
                          </button>
                          <button
                            onClick={() => toggleCompare?.(expert.id, 'consultation')}
                            className={`p-4 rounded-2xl transition-all border active:scale-95 ${
                              compareList.some((item) => item.id === expert.id && item.type === 'consultation')
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 border-gray-100'
                            }`}
                          >
                            <Scale className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[40px] p-10 border border-gray-100 text-center shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Ничего не найдено</h3>
                <p className="text-gray-500 max-w-xl mx-auto mb-6">
                  Попробуйте изменить фильтры или добавьте свою консультацию, чтобы она сразу появилась в списке.
                </p>
                <button
                  onClick={onAddServiceClick}
                  className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  Добавить услугу
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
