import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, Map, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, SlidersHorizontal, Grid, List as ListIcon, Trash2, Plus, Minus, Check, X } from 'lucide-react';
import { FilterSection } from './FilterSection';
import { CarCard } from '../shared/CarCard';
import { LocationPickerMapModal } from '../shared/LocationPickerMapModal';
import { ALL_BRANDS, BRANDS_AND_MODELS, TRUCK_BRANDS, TRUCK_MODELS, MOTO_BRANDS, MOTO_MODELS, BUS_BRANDS, BUS_MODELS, BIKE_BRANDS, BIKE_MODELS, SORT_OPTIONS, getModels } from '../../constants/mockData';
import { PARTS_CATEGORIES, makePartsCategoryKey } from '../../constants/partsCategories';
import { Car } from '../../types';
import { CarFilters, PartFilters } from '../../utils/marketAPI';

interface VehicleDetailsPageProps {
  vehicleType: string;
  cars?: Car[];
  compareList: {id: number, type: string}[];
  toggleCompare: (id: number, type: string) => void;
  setCurrentPage: (page: string) => void;
  onCarClick?: (car: Car) => void;
  initialSearch?: {
    offerType?: string;
    brand?: string;
    model?: string;
    year?: string;
    region?: string;
  };
  onLoadFilteredCars?: (filters: CarFilters) => Promise<Car[]>;
  onLoadFilteredParts?: (filters: PartFilters) => Promise<Car[]>;
}

const BIKE_TYPES = ['Все', 'Горные (MTB)', 'Шоссейные', 'Городские', 'Гибридные', 'Складные', 'Электровелосипеды', 'BMX', 'Детские', 'Другой тип'];
const CONDITIONS = ['Все', 'Новый', 'Б/У'];
const FRAME_MATERIALS = ['Все', 'Алюминий', 'Сталь', 'Карбон', 'Титан', 'Магний', 'Другой материал'];
const SUSPENSIONS = ['Все', 'Без амортизации (Rigid)', 'Передний амортизатор (Hardtail)', 'Двухподвес (Full Suspension)'];
const FRAME_SIZES = ['Все', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const TRANSPORT_TYPES = ['Все', 'Грузоперевозки', 'Пассажирские перевозки', 'Эвакуатор', 'Спецтехника', 'Другой тип'];

export const VehicleDetailsPage: React.FC<VehicleDetailsPageProps> = ({
  vehicleType,
  cars,
  compareList,
  toggleCompare,
  setCurrentPage,
  onCarClick,
  initialSearch,
  onLoadFilteredCars,
  onLoadFilteredParts,
}) => {
  const isPartsCatalog = vehicleType === 'Автозапчасти';
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [paginationPage, setPaginationPage] = useState(1);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState('Новые');
  const [searchQuery, setSearchQuery] = useState('');
  const [dynamicModelsByBrand, setDynamicModelsByBrand] = useState<Record<string, string[]>>(BRANDS_AND_MODELS);
  const [modelsLoading, setModelsLoading] = useState<Record<string, boolean>>({});
  const [modelsLoaded, setModelsLoaded] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Тип предложения': true,
    'Регион': true,
    'Цена': true,
    'Марка': true,
    'Категории': true,
    'Год': true,
    'Топливо': true,
    'Коробка передач': true,
    'Регистрация': true,
    'Объем двигателя': true,
    'Пробег': true,
    'Кузов': true,
    'Привод': true,
    'Количество мест в салоне': true,
    'Тип велосипеда': true,
    'Состояние': true,
    'Материал рамы': true,
    'Подвеска': true,
    'Размер рамы': true,
    'Тип перевозки': true,
  });
  const [filters, setFilters] = useState<Record<string, any>>({
    offerType: 'Все',
    region: '',
    priceFrom: '0',
    priceTo: '500000',
    currency: 'USD',
    brands: [],
    models: {},
    yearFrom: 'от',
    yearTo: 'до',
    fuel: ['Все'],
    gearbox: ['Все'],
    registration: '',
    engineFrom: '0',
    engineTo: '5000',
    mileageFrom: '0',
    mileageTo: '500000',
    body: ['Все'],
    drive: 'Все',
    seats: [],
    // Bicycles
    bikeType: 'Все',
    condition: 'Все',
    frameMaterial: 'Все',
    suspension: 'Все',
    frameSize: 'Все',
    // Transport
    transportType: 'Все',
    // Parts
    partCategories: [] as string[],
  });
  const [brandSearch, setBrandSearch] = useState('');
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [serverResults, setServerResults] = useState<Car[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickyTopOffset = 'calc(var(--market-header-height, 120px) + 24px)';
  const stickyViewportHeight = 'calc(100vh - var(--market-header-height, 120px) - 16px)';
  const [appliedInitialSearchKey, setAppliedInitialSearchKey] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = isMobileFiltersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileFiltersOpen]);

  useEffect(() => {
    // Reset to static fallbacks on category change; API data will be reloaded lazily.
    setDynamicModelsByBrand(BRANDS_AND_MODELS);
    setModelsLoaded({});
    setModelsLoading({});
    setServerResults(null);
  }, [vehicleType]);

  useEffect(() => {
    if (!initialSearch) return;

    const key = JSON.stringify({
      offerType: initialSearch.offerType || '',
      brand: initialSearch.brand || '',
      model: initialSearch.model || '',
      year: initialSearch.year || '',
      region: initialSearch.region || '',
    });

    if (appliedInitialSearchKey === key) return;
    setAppliedInitialSearchKey(key);

    const brand = String(initialSearch.brand || '').trim();
    const model = String(initialSearch.model || '').trim();
    const year = String(initialSearch.year || '').trim();
    const region = String(initialSearch.region || '').trim();
    const offerType = String(initialSearch.offerType || '').trim();

    setSearchQuery([brand, model].filter(Boolean).join(' '));
    setBrandSearch(brand);

    setFilters((prev) => {
      const next = { ...prev };

      next.offerType = offerType || 'Все';
      next.region = region;

      if (year) {
        next.yearFrom = year;
        next.yearTo = year;
      } else {
        next.yearFrom = 'от';
        next.yearTo = 'до';
      }

      if (brand) {
        next.brands = [brand];
        if (model) {
          next.models = { [brand]: [model] };
        } else {
          next.models = {};
        }
      } else {
        next.brands = [];
        next.models = {};
      }

      return next;
    });
  }, [appliedInitialSearchKey, initialSearch]);

  const buildServerFilters = useCallback((): CarFilters | PartFilters => {
    const selectedBrands: string[] = Array.isArray(filters.brands) ? filters.brands as string[] : [];
    const modelsByBrand: Record<string, string[]> = typeof filters.models === 'object' && filters.models ? filters.models as Record<string, string[]> : {};
    const allModels = Object.values(modelsByBrand).flat();

    if (isPartsCatalog) {
      const f: PartFilters = {};
      if (searchQuery.trim()) f.q = searchQuery.trim();
      if (selectedBrands.length) f.brand = selectedBrands;
      if (allModels.length) f.model = allModels;
      const yFrom = filters.yearFrom && filters.yearFrom !== 'от' ? Number(String(filters.yearFrom).replace(/\D/g, '')) : 0;
      const yTo = filters.yearTo && filters.yearTo !== 'до' ? Number(String(filters.yearTo).replace(/\D/g, '')) : 0;
      if (yFrom) f.yearFrom = yFrom;
      if (yTo) f.yearTo = yTo;
      const pFrom = Number(String(filters.priceFrom || '0').replace(/\D/g, '')) || 0;
      const pTo = Number(String(filters.priceTo || '0').replace(/\D/g, '')) || 0;
      if (pFrom > 0) f.priceMin = pFrom;
      if (pTo > 0 && pTo < 500000) f.priceMax = pTo;
      if (filters.region) f.region = String(filters.region);
      const partCategories: string[] = Array.isArray((filters as any).partCategories) ? (filters as any).partCategories : [];
      if (partCategories.length) f.partCategoryKey = partCategories[0];
      return f;
    }

    const f: CarFilters = {};
    if (searchQuery.trim()) f.q = searchQuery.trim();
    if (filters.offerType && filters.offerType !== 'Все') f.type = String(filters.offerType);
    if (selectedBrands.length) f.brand = selectedBrands;
    if (allModels.length) f.model = allModels;
    const yFrom = filters.yearFrom && filters.yearFrom !== 'от' ? Number(String(filters.yearFrom).replace(/\D/g, '')) : 0;
    const yTo = filters.yearTo && filters.yearTo !== 'до' ? Number(String(filters.yearTo).replace(/\D/g, '')) : 0;
    if (yFrom) f.yearFrom = yFrom;
    if (yTo) f.yearTo = yTo;
    const pFrom = Number(String(filters.priceFrom || '0').replace(/\D/g, '')) || 0;
    const pTo = Number(String(filters.priceTo || '0').replace(/\D/g, '')) || 0;
    if (pFrom > 0) f.priceMin = pFrom;
    if (pTo > 0 && pTo < 500000) f.priceMax = pTo;
    const mFrom = Number(String(filters.mileageFrom || '0').replace(/\D/g, '')) || 0;
    const mTo = Number(String(filters.mileageTo || '0').replace(/\D/g, '')) || 0;
    if (mFrom > 0) f.mileageMin = mFrom;
    if (mTo > 0 && mTo < 500000) f.mileageMax = mTo;
    const fuelArr: string[] = Array.isArray(filters.fuel) ? (filters.fuel as string[]).filter(v => v !== 'Все') : [];
    if (fuelArr.length) f.fuel = fuelArr;
    const gearArr: string[] = Array.isArray(filters.gearbox) ? (filters.gearbox as string[]).filter(v => v !== 'Все') : [];
    if (gearArr.length) f.gearbox = gearArr;
    const bodyArr: string[] = Array.isArray(filters.body) ? (filters.body as string[]).filter(v => v !== 'Все') : [];
    if (bodyArr.length) f.bodyType = bodyArr;
    if (filters.drive && filters.drive !== 'Все') f.driveType = String(filters.drive);
    if (filters.region) f.region = String(filters.region);
    if (filters.registration) f.registrationPlace = String(filters.registration);
    return f;
  }, [filters, searchQuery, isPartsCatalog]);

  useEffect(() => {
    const loader = isPartsCatalog ? onLoadFilteredParts : onLoadFilteredCars;
    if (!loader) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const serverFilters = buildServerFilters();
        const results = await (loader as (f: CarFilters | PartFilters) => Promise<Car[]>)(serverFilters);
        setServerResults(results);
        setPaginationPage(1);
      } catch {
        setServerResults(null);
      }
    }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, searchQuery, isPartsCatalog, onLoadFilteredCars, onLoadFilteredParts, buildServerFilters]);

  const getBrandsAndModels = () => {
    switch (vehicleType) {
      case 'Грузовые автомобили':
        return { brands: TRUCK_BRANDS, models: TRUCK_MODELS };
      case 'Мото':
        return { brands: MOTO_BRANDS, models: MOTO_MODELS };
      case 'Микроавтобусы':
        return { brands: BUS_BRANDS, models: BUS_MODELS };
      case 'Велосипеды':
        return { brands: BIKE_BRANDS, models: BIKE_MODELS };
      default:
        return { brands: ALL_BRANDS, models: dynamicModelsByBrand };
    }
  };

  const { brands: currentBrands, models: currentModels } = getBrandsAndModels();

  const sourceCars = cars ?? [];

  const DEFAULT_VEHICLE_CATEGORY = 'Легковые автомобили';
  const extractVehicleCategory = (description: unknown) => {
    const text = String(description || '');
    const match = text.match(/\[Категория:\s*([^\]]+)\]/i);
    return match?.[1]?.trim() || '';
  };

  const extractPartCategoryKey = (description: unknown) => {
    const text = String(description || '');
    const match = text.match(/\[PartCategory:\s*([^\|\]]+)\|([^\]]+)\]/i);
    if (!match) return '';
    return makePartsCategoryKey(match[1].trim(), match[2].trim());
  };

  const getCarCategory = (car: Car) => extractVehicleCategory(car.description) || DEFAULT_VEHICLE_CATEGORY;

  const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
  const parseDigits = (value: unknown) => {
    const digits = String(value ?? '').replace(/[^\d]/g, '');
    if (!digits) return null;
    const num = Number(digits);
    return Number.isFinite(num) ? num : null;
  };
  const parseFloatLoose = (value: unknown) => {
    const raw = String(value ?? '').trim().replace(',', '.');
    if (!raw) return null;
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? num : null;
  };

  const effectiveArrayFilter = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    const trimmed = value.map((v) => String(v).trim()).filter(Boolean);
    return trimmed.filter((v) => v !== 'Все');
  };

  const matchesText = (haystack: string, needle: string) => {
    if (!needle.trim()) return true;
    return normalize(haystack).includes(normalize(needle));
  };

  const applySort = (items: Car[]) => {
    const next = [...items];
    const sortIndex = SORT_OPTIONS.indexOf(selectedSort);

    if (sortIndex === 1) {
      return next.sort((a, b) => (a.id || 0) - (b.id || 0));
    }

    if (sortIndex === 2) {
      return next.sort((a, b) => (parseDigits(a.price) || 0) - (parseDigits(b.price) || 0));
    }

    if (sortIndex === 3) {
      return next.sort((a, b) => (parseDigits(b.price) || 0) - (parseDigits(a.price) || 0));
    }

    return next.sort((a, b) => (b.id || 0) - (a.id || 0));
  };

  const filteredCars = useMemo(() => {
    const fromServer = serverResults !== null;
    const regionNeedle = String(filters.region || '').trim();
    const offerNeedle = String(filters.offerType || '').trim();

    const selectedBrands = Array.isArray(filters.brands) ? (filters.brands as string[]) : [];
    const selectedModelsByBrand = typeof filters.models === 'object' && filters.models ? filters.models : {};

    const fuelFilter = effectiveArrayFilter(filters.fuel);
    const gearboxFilter = effectiveArrayFilter(filters.gearbox);
    const bodyFilter = effectiveArrayFilter(filters.body);

    const driveFilter = String(filters.drive || '').trim();
    const seatsFilter = Array.isArray(filters.seats) ? (filters.seats as string[]) : [];

    const yearFrom = filters.yearFrom && filters.yearFrom !== 'от' ? parseDigits(filters.yearFrom) : null;
    const yearTo = filters.yearTo && filters.yearTo !== 'до' ? parseDigits(filters.yearTo) : null;
    const priceFrom = parseDigits(filters.priceFrom) ?? 0;
    const priceTo = parseDigits(filters.priceTo) ?? Number.POSITIVE_INFINITY;

    const mileageFrom = parseDigits(filters.mileageFrom) ?? 0;
    const mileageTo = parseDigits(filters.mileageTo) ?? Number.POSITIVE_INFINITY;

    const engineFrom = parseFloatLoose(filters.engineFrom) ?? 0;
    const engineTo = parseFloatLoose(filters.engineTo) ?? Number.POSITIVE_INFINITY;

    const registrationNeedle = String(filters.registration || '').trim();
    const selectedPartCategories = Array.isArray((filters as any).partCategories)
      ? (((filters as any).partCategories as string[]) || []).filter(Boolean)
      : [];

    const normalizedSearch = searchQuery.trim();

    const allowedBrandsForVehicleType = (() => {
      if (vehicleType === 'Грузовые автомобили') return TRUCK_BRANDS;
      if (vehicleType === 'Мото') return MOTO_BRANDS;
      if (vehicleType === 'Микроавтобусы') return BUS_BRANDS;
      if (vehicleType === 'Велосипеды') return BIKE_BRANDS;
      return null;
    })();

    const transportTypeNeedle = String(filters.transportType || '').trim();
    const bikeTypeNeedle = String(filters.bikeType || '').trim();
    const conditionNeedle = String(filters.condition || '').trim();
    const frameMaterialNeedle = String(filters.frameMaterial || '').trim();
    const suspensionNeedle = String(filters.suspension || '').trim();
    const frameSizeNeedle = String(filters.frameSize || '').trim();

    const matchesBikeOrTransportMeta = (car: Car) => {
      const blob = `${car.title || ''} ${car.description || ''} ${car.type || ''}`;

      if (vehicleType === 'Перевозки' && transportTypeNeedle && transportTypeNeedle !== 'Все') {
        if (!matchesText(blob, transportTypeNeedle)) return false;
      }

      if (vehicleType === 'Велосипеды') {
        if (bikeTypeNeedle && bikeTypeNeedle !== 'Все' && !matchesText(blob, bikeTypeNeedle)) return false;
        if (conditionNeedle && conditionNeedle !== 'Все' && !matchesText(blob, conditionNeedle)) return false;
        if (frameMaterialNeedle && frameMaterialNeedle !== 'Все' && !matchesText(blob, frameMaterialNeedle)) return false;
        if (suspensionNeedle && suspensionNeedle !== 'Все' && !matchesText(blob, suspensionNeedle)) return false;
        if (frameSizeNeedle && frameSizeNeedle !== 'Все' && !matchesText(blob, frameSizeNeedle)) return false;
      }

      return true;
    };

    const expectedCategory = vehicleType || DEFAULT_VEHICLE_CATEGORY;
    const baseData = fromServer ? serverResults! : sourceCars;

    const filtered = baseData.filter((car) => {
      if (!fromServer && !isPartsCatalog && getCarCategory(car) !== expectedCategory) return false;

      if (isPartsCatalog && selectedPartCategories.length > 0) {
        const partKey =
          typeof (car as any)?.partCategoryKey === 'string' && String((car as any).partCategoryKey).trim()
            ? String((car as any).partCategoryKey).trim()
            : extractPartCategoryKey(car.description);
        if (!partKey || !selectedPartCategories.includes(partKey)) return false;
      }

      if (!fromServer && allowedBrandsForVehicleType && car.brand && !allowedBrandsForVehicleType.includes(car.brand)) {
        return false;
      }

      if (!fromServer && normalizedSearch) {
        const searchable = `${car.title || ''} ${car.brand || ''} ${car.model || ''} ${car.description || ''}`;
        if (!matchesText(searchable, normalizedSearch)) return false;
      }

      if (!fromServer && offerNeedle && offerNeedle !== 'Все') {
        if (!matchesText(car.type || '', offerNeedle)) return false;
      }

      if (!fromServer && regionNeedle) {
        const regionBlob = `${car.location || ''} ${car.region || ''} ${car.registrationPlace || ''}`;
        if (!matchesText(regionBlob, regionNeedle)) return false;
      }

      if (!fromServer && selectedBrands.length > 0) {
        if (!car.brand || !selectedBrands.includes(car.brand)) return false;
      }

      if (!fromServer && car.brand && selectedModelsByBrand?.[car.brand]?.length) {
        const allowedModels = selectedModelsByBrand[car.brand] as string[];
        if (allowedModels.length > 0 && car.model && !allowedModels.includes(car.model)) return false;
        if (allowedModels.length > 0 && !car.model) return false;
      }

      if (!fromServer) {
        const priceValue = parseDigits(car.price) || 0;
        if (priceValue < priceFrom || priceValue > priceTo) return false;

        const yearValue = parseDigits(car.year);
        if (yearFrom !== null && yearValue !== null && yearValue < yearFrom) return false;
        if (yearTo !== null && yearValue !== null && yearValue > yearTo) return false;

        if (fuelFilter.length > 0) {
          if (!car.fuel || !fuelFilter.includes(car.fuel)) return false;
        }

        if (gearboxFilter.length > 0) {
          if (!car.transmission || !gearboxFilter.includes(car.transmission)) return false;
        }

        if (registrationNeedle) {
          if (!matchesText(car.registrationPlace || '', registrationNeedle)) return false;
        }

        const engineValue = parseFloatLoose(car.engineVolume);
        if (engineValue !== null && (engineValue < engineFrom || engineValue > engineTo)) return false;

        const mileageValue = parseDigits(car.mileage) || 0;
        if (mileageValue < mileageFrom || mileageValue > mileageTo) return false;

        if (bodyFilter.length > 0) {
          if (!car.bodyType || !bodyFilter.includes(car.bodyType)) return false;
        }

        if (driveFilter && driveFilter !== 'Все') {
          if (!car.driveType || car.driveType !== driveFilter) return false;
        }
      }

      if (seatsFilter.length > 0) {
        const carSeatsDigits = parseDigits(car.seats);
        const matchesAny = seatsFilter.some((label) => parseDigits(label) === carSeatsDigits);
        if (!matchesAny) return false;
      }

      if (!matchesBikeOrTransportMeta(car)) return false;

      return true;
    });

    return applySort(filtered);
  }, [filters, searchQuery, selectedSort, sourceCars, vehicleType, serverResults]);

  const pageSize = viewMode === 'grid' ? 12 : 10;
  const totalPages = Math.max(1, Math.ceil(filteredCars.length / pageSize));

  useEffect(() => {
    setPaginationPage(1);
  }, [filters, searchQuery, selectedSort, vehicleType, viewMode]);

  useEffect(() => {
    setPaginationPage((prev) => Math.min(Math.max(prev, 1), totalPages));
  }, [totalPages]);

  const pagedCars = useMemo(() => {
    const start = (paginationPage - 1) * pageSize;
    return filteredCars.slice(start, start + pageSize);
  }, [filteredCars, pageSize, paginationPage]);

  const getPaginationItems = (current: number, pages: number) => {
    if (pages <= 7) return Array.from({ length: pages }, (_, idx) => idx + 1);

    const items: Array<number | string> = [];
    const left = Math.max(2, current - 1);
    const right = Math.min(pages - 1, current + 1);

    items.push(1);
    if (left > 2) items.push('...');

    for (let p = left; p <= right; p += 1) items.push(p);

    if (right < pages - 1) items.push('...');
    items.push(pages);

    return items;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const ensureModelsLoaded = async (brand: string) => {
    // Only for default catalog types where we use ALL_BRANDS.
    if (vehicleType === 'Грузовые автомобили' || vehicleType === 'Мото' || vehicleType === 'Микроавтобусы' || vehicleType === 'Велосипеды') {
      return;
    }

    if (modelsLoaded[brand] || modelsLoading[brand]) return;

    setModelsLoading((prev) => ({ ...prev, [brand]: true }));
    try {
      const models = await getModels(brand);
      setDynamicModelsByBrand((prev) => ({
        ...prev,
        [brand]: Array.isArray(models) && models.length > 0 ? models : (prev[brand] || []),
      }));
      setModelsLoaded((prev) => ({ ...prev, [brand]: true }));
    } finally {
      setModelsLoading((prev) => ({ ...prev, [brand]: false }));
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => {
      if (Array.isArray(prev[key])) {
        const current = prev[key] as any[];
        const index = current.indexOf(value);
        if (index > -1) {
          return { ...prev, [key]: current.filter(v => v !== value) };
        } else {
          return { ...prev, [key]: [...current, value] };
        }
      }
      return { ...prev, [key]: value };
    });
  };

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => {
      const next = !prev[brand];
      if (next) {
        void ensureModelsLoaded(brand);
      }
      return { ...prev, [brand]: next };
    });
  };

  const toggleBrandSelection = (brand: string) => {
    setFilters(prev => {
      const current = prev.brands as string[];
      if (current.includes(brand)) {
        const newModels = { ...prev.models };
        delete newModels[brand];
        return { ...prev, brands: current.filter(b => b !== brand), models: newModels };
      } else {
        return { ...prev, brands: [...current, brand] };
      }
    });
  };

  const toggleModelSelection = (brand: string, model: string) => {
    setFilters(prev => {
      const currentModels = prev.models[brand] || [];
      const newModels = currentModels.includes(model)
        ? currentModels.filter((m: string) => m !== model)
        : [...currentModels, model];
      return { ...prev, models: { ...prev.models, [brand]: newModels } };
    });
  };

  const togglePartCategory = (categoryKey: string) => {
    setFilters((prev) => {
      const current = Array.isArray(prev.partCategories) ? (prev.partCategories as string[]) : [];
      if (current.includes(categoryKey)) {
        return { ...prev, partCategories: current.filter((k) => k !== categoryKey) };
      }
      return { ...prev, partCategories: [...current, categoryKey] };
    });
  };

  const resetFilters = () => {
    setFilters({
      offerType: 'Все',
      region: '',
      priceFrom: '0',
      priceTo: '500000',
      currency: 'USD',
      brands: [],
      models: {},
      yearFrom: 'от',
      yearTo: 'до',
      fuel: ['Все'],
      gearbox: ['Все'],
      registration: '',
      engineFrom: '0',
      engineTo: '5000',
      mileageFrom: '0',
      mileageTo: '500000',
      body: ['Все'],
      drive: 'Все',
      seats: [],
      // Bicycles
      bikeType: 'Все',
      condition: 'Все',
      frameMaterial: 'Все',
      suspension: 'Все',
      frameSize: 'Все',
      // Transport
      transportType: 'Все',
      // Parts
      partCategories: [],
    });
  };

  const filteredBrands = currentBrands.filter(brand => 
    brand.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'offerType' && value === 'Продажа') return false;
    if (key === 'currency' && value === 'USD') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return value !== '';
  });

  return (
    <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <LocationPickerMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelect={(region) => handleFilterChange('region', region)}
        selectedRegion={filters.region}
      />

      {/* Page Title & Result Count */}
      <div className="mb-8">
        <h1 className="text-[32px] font-bold text-gray-900 leading-tight">
          {vehicleType || 'Автомобили'}
        </h1>
        <p className="text-[14px] text-gray-500 mt-1">
          {filteredCars.length} найденных вариантов
        </p>
      </div>

      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row items-center gap-4 mb-8">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Поиск по марке"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10 transition-all"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {/* Mobile Filter Toggle */}
          <button 
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
            className="md:hidden flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 hover:border-gray-300 transition-all"
          >
            <SlidersHorizontal className="w-5 h-5" />
            Фильтры
          </button>

          {/* Sort Dropdown */}
          <div className="relative flex-1 lg:flex-none min-w-[160px]">
            <button 
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="w-full flex items-center justify-between px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 hover:border-gray-300 transition-all"
            >
              <span className="flex items-center gap-2">
                {selectedSort}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSortOpen && (
              <div className="absolute top-full right-0 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl z-30 py-2 animate-in fade-in zoom-in-95 duration-200">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSelectedSort(option);
                      setIsSortOpen(false);
                    }}
                    className={`w-full text-left px-5 py-2.5 text-sm transition-colors ${selectedSort === option ? 'text-red-600 bg-red-50 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setCurrentPage('settings-listings')}
            className="flex-1 lg:flex-none px-6 py-3 bg-black text-white rounded-xl font-bold text-sm transition-all hover:bg-gray-900"
          >
            Мои объявления
          </button>

          <button 
            onClick={() => setCurrentPage('add-listing')}
            className="flex-1 lg:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> добавить объявление
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-8 md:pb-4">
        {/* Sidebar Filters */}
        <aside
          className={`fixed inset-0 z-[100] flex flex-col bg-white md:relative md:inset-auto md:z-auto md:w-72 lg:w-80 md:flex-shrink-0 md:self-start md:sticky md:block transition-transform duration-300 ease-out ${isMobileFiltersOpen ? 'translate-y-0 visible' : 'translate-y-full invisible md:translate-y-0 md:visible pointer-events-none md:pointer-events-auto'}`}
          style={{ top: stickyTopOffset }}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 md:hidden shrink-0">
            <h2 className="text-xl font-bold text-gray-900">Фильтры</h2>
            <button onClick={() => setIsMobileFiltersOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="bg-white p-5 lg:p-6 md:rounded-3xl md:border md:border-gray-200 md:overflow-y-auto scrollbar-hide overflow-y-auto flex-1"
            style={{ maxHeight: stickyViewportHeight }}
          >
            <div className="hidden md:flex items-center justify-between mb-2 pb-3">
              <h2 className="text-xl font-bold text-gray-900">Фильтры</h2>
            </div>

            <div className="space-y-0">
              <FilterSection title="Тип предложения" isOpen={expandedSections['Тип предложения']} onToggle={() => toggleSection('Тип предложения')}>
                <div className="flex flex-wrap gap-2">
                  {(vehicleType === 'Прицепы' ? ['Все', 'Продажа', 'Аренда'] : ['Все', 'Покупка', 'Продажа', 'Аренда', 'Обмен']).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleFilterChange('offerType', type)}
                      className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all border ${filters.offerType === type ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </FilterSection>

              {vehicleType === 'Перевозки' && (
                <FilterSection title="Тип перевозки" isOpen={expandedSections['Тип перевозки']} onToggle={() => toggleSection('Тип перевозки')}>
                  <div className="flex flex-col gap-2">
                    {TRANSPORT_TYPES.map((type) => (
                      <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                        <div 
                          onClick={() => handleFilterChange('transportType', type)}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                            filters.transportType === type 
                              ? 'border-red-600 bg-red-600' 
                              : 'border-gray-300 group-hover:border-red-500'
                          }`}
                        >
                          {filters.transportType === type && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className={`text-[14px] transition-colors ${
                          filters.transportType === type ? 'text-red-600 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                        }`}>
                          {type}
                        </span>
                      </label>
                    ))}
                  </div>
                </FilterSection>
              )}

              <FilterSection title="Регион" isOpen={expandedSections['Регион']} onToggle={() => toggleSection('Регион')}>
                <div className="space-y-2.5">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Написать регион"
                      value={filters.region}
                      onChange={(e) => handleFilterChange('region', e.target.value)}
                      className="w-full pl-11 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all"
                  >
                    <MapPin className="w-4 h-4" /> Выбрать на карте
                  </button>
                </div>
              </FilterSection>

              <FilterSection title="Цена" isOpen={expandedSections['Цена']} onToggle={() => toggleSection('Цена')}>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    value={filters.priceFrom}
                    onChange={(e) => handleFilterChange('priceFrom', e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                  />
                  <span className="text-gray-400">-</span>
                  <input 
                    type="text" 
                    value={filters.priceTo}
                    onChange={(e) => handleFilterChange('priceTo', e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                  />
                </div>
              </FilterSection>

              {vehicleType !== 'Перевозки' && vehicleType !== 'Прицепы' && (
                <FilterSection title="Марка" isOpen={expandedSections['Марка']} onToggle={() => toggleSection('Марка')}>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Поиск марки..."
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredBrands.map((brand) => (
                        <div key={brand} className="mb-2">
                          <div className="flex items-center justify-between group">
                            <label className="flex items-center gap-3 cursor-pointer flex-1 py-1">
                              <div 
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleBrandSelection(brand);
                                }}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 ${
                                  filters.brands.includes(brand) 
                                    ? 'bg-red-600 border-red-600' 
                                    : 'border-gray-300 group-hover:border-red-500'
                                }`}
                              >
                                {filters.brands.includes(brand) && <Check className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <span className={`text-[14px] transition-colors ${
                                filters.brands.includes(brand) ? 'text-red-600 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                              }`}>
                                {brand}
                              </span>
                            </label>
                            {currentModels[brand] && (
                              <button 
                                onClick={() => toggleBrand(brand)}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                              >
                                {expandedBrands[brand] ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            )}
                          </div>
                          
                          {expandedBrands[brand] && currentModels[brand] && (
                            <div className="ml-8 mt-2 flex flex-col gap-2">
                              {currentModels[brand].map((model) => (
                                <label key={model} className="flex items-center gap-3 cursor-pointer group">
                                  <div 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      toggleModelSelection(brand, model);
                                    }}
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 ${
                                      filters.models[brand]?.includes(model)
                                        ? 'bg-red-600 border-red-600'
                                        : 'border-gray-300 group-hover:border-red-500'
                                    }`}
                                  >
                                    {filters.models[brand]?.includes(model) && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className={`text-[13px] transition-colors ${
                                    filters.models[brand]?.includes(model) ? 'text-red-600 font-medium' : 'text-gray-500 group-hover:text-gray-700'
                                  }`}>
                                    {model}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </FilterSection>
              )}

              {isPartsCatalog && (
                <FilterSection title="Категории" isOpen={expandedSections['Категории']} onToggle={() => toggleSection('Категории')}>
                  <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                    {PARTS_CATEGORIES.map((group) => (
                      <div key={group.title} className="space-y-2">
                        <div className="text-[13px] font-semibold text-gray-900">{group.title}</div>
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const key = makePartsCategoryKey(group.title, item);
                            const checked = Array.isArray(filters.partCategories) && (filters.partCategories as string[]).includes(key);
                            return (
                              <label key={key} className="flex items-center gap-3 py-1 cursor-pointer group">
                                <div
                                  onClick={(e) => {
                                    e.preventDefault();
                                    togglePartCategory(key);
                                  }}
                                  className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                                    checked ? 'bg-red-600 border-red-600' : 'border-gray-300 group-hover:border-red-500'
                                  }`}
                                >
                                  {checked && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                                </div>
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={checked}
                                  onChange={() => togglePartCategory(key)}
                                />
                                <span className="text-[14px] text-gray-700 group-hover:text-gray-900 transition-colors">
                                  {item}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </FilterSection>
              )}

              {vehicleType === 'Велосипеды' && (
                <>
                  <FilterSection title="Тип велосипеда" isOpen={expandedSections['Тип велосипеда']} onToggle={() => toggleSection('Тип велосипеда')}>
                    <div className="flex flex-col gap-2">
                      {BIKE_TYPES.map((type) => (
                        <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                          <div 
                            onClick={() => handleFilterChange('bikeType', type)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                              filters.bikeType === type 
                                ? 'border-red-600 bg-red-600' 
                                : 'border-gray-300 group-hover:border-red-500'
                            }`}
                          >
                            {filters.bikeType === type && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-[14px] transition-colors ${
                            filters.bikeType === type ? 'text-red-600 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                          }`}>
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection title="Состояние" isOpen={expandedSections['Состояние']} onToggle={() => toggleSection('Состояние')}>
                    <div className="flex flex-col gap-2">
                      {CONDITIONS.map((type) => (
                        <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                          <div 
                            onClick={() => handleFilterChange('condition', type)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                              filters.condition === type 
                                ? 'border-red-600 bg-red-600' 
                                : 'border-gray-300 group-hover:border-red-500'
                            }`}
                          >
                            {filters.condition === type && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-[14px] transition-colors ${
                            filters.condition === type ? 'text-red-600 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                          }`}>
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection title="Материал рамы" isOpen={expandedSections['Материал рамы']} onToggle={() => toggleSection('Материал рамы')}>
                    <div className="flex flex-col gap-2">
                      {FRAME_MATERIALS.map((type) => (
                        <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                          <div 
                            onClick={() => handleFilterChange('frameMaterial', type)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                              filters.frameMaterial === type 
                                ? 'border-red-600 bg-red-600' 
                                : 'border-gray-300 group-hover:border-red-500'
                            }`}
                          >
                            {filters.frameMaterial === type && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-[14px] transition-colors ${
                            filters.frameMaterial === type ? 'text-red-600 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                          }`}>
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection title="Подвеска" isOpen={expandedSections['Подвеска']} onToggle={() => toggleSection('Подвеска')}>
                    <div className="flex flex-col gap-2">
                      {SUSPENSIONS.map((type) => (
                        <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                          <div 
                            onClick={() => handleFilterChange('suspension', type)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                              filters.suspension === type 
                                ? 'border-red-600 bg-red-600' 
                                : 'border-gray-300 group-hover:border-red-500'
                            }`}
                          >
                            {filters.suspension === type && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-[14px] transition-colors ${
                            filters.suspension === type ? 'text-red-600 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                          }`}>
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection title="Размер рамы" isOpen={expandedSections['Размер рамы']} onToggle={() => toggleSection('Размер рамы')}>
                    <div className="flex flex-col gap-2">
                      {FRAME_SIZES.map((type) => (
                        <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                          <div 
                            onClick={() => handleFilterChange('frameSize', type)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                              filters.frameSize === type 
                                ? 'border-red-600 bg-red-600' 
                                : 'border-gray-300 group-hover:border-red-500'
                            }`}
                          >
                            {filters.frameSize === type && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-[14px] transition-colors ${
                            filters.frameSize === type ? 'text-red-600 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                          }`}>
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </FilterSection>
                </>
              )}

              {vehicleType === 'Прицепы' && (
                <FilterSection title="Год" isOpen={expandedSections['Год']} onToggle={() => toggleSection('Год')}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      value={filters.yearFrom}
                      onChange={(e) => handleFilterChange('yearFrom', e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                      type="text" 
                      value={filters.yearTo}
                      onChange={(e) => handleFilterChange('yearTo', e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                    />
                  </div>
                </FilterSection>
              )}

              {vehicleType !== 'Велосипеды' && vehicleType !== 'Перевозки' && vehicleType !== 'Прицепы' && vehicleType !== 'Автозапчасти' && (
                <>
                  <FilterSection title="Год" isOpen={expandedSections['Год']} onToggle={() => toggleSection('Год')}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={filters.yearFrom}
                        onChange={(e) => handleFilterChange('yearFrom', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                      />
                      <span className="text-gray-400">-</span>
                      <input 
                        type="text" 
                        value={filters.yearTo}
                        onChange={(e) => handleFilterChange('yearTo', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                      />
                    </div>
                  </FilterSection>

                  <FilterSection title="Топливо" isOpen={expandedSections['Топливо']} onToggle={() => toggleSection('Топливо')}>
                    <div className="space-y-2">
                      {['Все', 'Бензин', 'Дизель', 'Гибрид', 'Электро', 'Пропан', 'Метан'].map((type) => (
                        <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                          <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                            filters.fuel.includes(type) ? 'bg-red-600 border-red-600' : 'border-gray-300 group-hover:border-red-500'
                          }`}>
                            {filters.fuel.includes(type) && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                          </div>
                          <input 
                            type="checkbox" 
                            className="hidden"
                            checked={filters.fuel.includes(type)}
                            onChange={() => handleFilterChange('fuel', type)}
                          />
                          <span className="text-[14px] text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection title="Коробка передач" isOpen={expandedSections['Коробка передач']} onToggle={() => toggleSection('Коробка передач')}>
                    <div className="space-y-2">
                      {['Все', 'Автомат', 'Механика', 'Вариатор', 'Роботизированная'].map((type) => (
                        <label key={type} className="flex items-center gap-3 py-1 cursor-pointer group">
                          <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                            filters.gearbox.includes(type) ? 'bg-red-600 border-red-600' : 'border-gray-300 group-hover:border-red-500'
                          }`}>
                            {filters.gearbox.includes(type) && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                          </div>
                          <input 
                            type="checkbox" 
                            className="hidden"
                            checked={filters.gearbox.includes(type)}
                            onChange={() => handleFilterChange('gearbox', type)}
                          />
                          <span className="text-[14px] text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection title="Регистрация" isOpen={expandedSections['Регистрация']} onToggle={() => toggleSection('Регистрация')}>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Написать"
                        value={filters.registration}
                        onChange={(e) => handleFilterChange('registration', e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10 transition-all"
                      />
                    </div>
                  </FilterSection>

                  <FilterSection title="Объем двигателя" isOpen={expandedSections['Объем двигателя']} onToggle={() => toggleSection('Объем двигателя')}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={filters.engineFrom}
                        onChange={(e) => handleFilterChange('engineFrom', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                      />
                      <span className="text-gray-400">-</span>
                      <input 
                        type="text" 
                        value={filters.engineTo}
                        onChange={(e) => handleFilterChange('engineTo', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                      />
                    </div>
                  </FilterSection>

                  <FilterSection title="Пробег" isOpen={expandedSections['Пробег']} onToggle={() => toggleSection('Пробег')}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={filters.mileageFrom}
                        onChange={(e) => handleFilterChange('mileageFrom', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                      />
                      <span className="text-gray-400">-</span>
                      <input 
                        type="text" 
                        value={filters.mileageTo}
                        onChange={(e) => handleFilterChange('mileageTo', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
                      />
                    </div>
                  </FilterSection>

                  {vehicleType === 'Легковые автомобили' && (
                    <FilterSection title="Кузов" isOpen={expandedSections['Кузов']} onToggle={() => toggleSection('Кузов')}>
                      <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {['Все', 'Седан', 'Хэтчбэк', 'Универсал', 'Кроссовер', 'Внедорожник', 'Компактвэн', 'Минивэн', 'Купе', 'Кабриолет', 'Лимузин', 'Микроавтобус', 'Пикап', 'Родстер', 'Спорт-купе', 'Фургон'].map((type) => (
                          <label key={type} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${filters.body.includes(type) ? 'bg-red-600 border-red-600' : 'border-gray-300 group-hover:border-red-500'}`}>
                              {filters.body.includes(type) && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                            </div>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={filters.body.includes(type)}
                              onChange={() => handleFilterChange('body', type)}
                            />
                            <span className="text-[14px] text-gray-700">{type}</span>
                          </label>
                        ))}
                      </div>
                    </FilterSection>
                  )}

                  {vehicleType !== 'Мото' && (
                    <FilterSection title="Привод" isOpen={expandedSections['Привод']} onToggle={() => toggleSection('Привод')}>
                      <div className="flex flex-wrap gap-2">
                        {['Все', 'Задний', 'Передний', 'Полный'].map((type) => (
                          <button
                            key={type}
                            onClick={() => handleFilterChange('drive', type)}
                            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all border ${filters.drive === type ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </FilterSection>
                  )}

                  {vehicleType !== 'Мото' && (
                    <FilterSection title="Количество мест в салоне" isOpen={expandedSections['Количество мест в салоне']} onToggle={() => toggleSection('Количество мест в салоне')}>
                      <div className="space-y-2">
                        {['2 места', '4 места', '5 мест', '6 мест', '7 мест', '8 мест', '9 мест'].map((num) => (
                          <label key={num} className="flex items-center gap-3 py-1 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                              filters.seats.includes(num) ? 'bg-red-600 border-red-600' : 'border-gray-300 group-hover:border-red-500'
                            }`}>
                              {filters.seats.includes(num) && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                            </div>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={filters.seats.includes(num)}
                              onChange={() => handleFilterChange('seats', num)}
                            />
                            <span className="text-[14px] text-gray-700">{num}</span>
                          </label>
                        ))}
                      </div>
                    </FilterSection>
                  )}
                </>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <button 
                onClick={() => setIsMobileFiltersOpen(false)}
                className="w-full py-3 bg-red-600 text-white rounded-2xl font-bold text-sm transition-all hover:bg-red-700 shadow-lg shadow-red-600/20"
              >
                Применить фильтры
              </button>
              <button 
                onClick={resetFilters}
                className="w-full py-2 text-sm font-bold text-gray-900 hover:text-red-600 transition-colors"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {filteredCars.length === 0 ? (
            <div className="bg-white rounded-[40px] p-10 border border-gray-100 text-center shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Ничего не найдено</h3>
              <p className="text-gray-500 max-w-xl mx-auto">Попробуйте изменить фильтры или сбросьте их, чтобы увидеть все объявления.</p>
            </div>
          ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'flex flex-col gap-6'}>
            {pagedCars.map((car, index) => (
              <CarCard
                key={`${car.id}-${index}`}
                car={car}
                isCompared={compareList.some(i => i.id === car.id && i.type === 'car')}
                onToggleCompare={() => toggleCompare(car.id, 'car')}
                onClick={() => onCarClick?.(car)}
              />
            ))}
          </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <nav className="flex items-center gap-2" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => setPaginationPage((prev) => Math.max(1, prev - 1))}
                  disabled={paginationPage <= 1}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {getPaginationItems(paginationPage, totalPages).map((item, i) => {
                  if (item === '...') {
                    return (
                      <span
                        key={`dots-${i}`}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-gray-400 select-none"
                      >
                        ...
                      </span>
                    );
                  }

                  const page = item as number;
                  const isActive = page === paginationPage;

                  return (
                    <button
                      key={`page-${page}`}
                      type="button"
                      onClick={() => setPaginationPage(page)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                        isActive ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPaginationPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={paginationPage >= totalPages}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
