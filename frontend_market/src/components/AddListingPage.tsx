import React, { useRef, useState, useEffect } from 'react';
import {
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { showMarketToast } from '../utils/avtotime';
import {
  BIKE_CONDITIONS,
  BIKE_FRAME_MATERIALS,
  BIKE_FRAME_SIZES,
  BIKE_SUSPENSIONS,
  BIKE_TYPES,
  TRAILER_TYPES,
  TRANSPORT_TYPES,
  VEHICLE_LISTING_SCHEMAS,
  normalizeVehicleType,
} from '../constants/vehicleListingSchema';
import {
  ALL_BRANDS,
  BIKE_BRANDS,
  BIKE_MODELS,
  BRANDS_AND_MODELS,
  BUS_BRANDS,
  BUS_MODELS,
  MOTO_BRANDS,
  MOTO_MODELS,
  TRUCK_BRANDS,
  TRUCK_MODELS,
} from '../constants/mockData';

const FUELS = ['Бензин', 'Дизель', 'Гибрид', 'Электро', 'Пропан', 'Метан'];
const BODIES = [
  'Седан',
  'Хэтчбек',
  'Универсал',
  'Кроссовер',
  'Внедорожник',
  'Компактвэн',
  'Минивэн',
  'Купе',
  'Кабриолет',
  'Лимузин',
  'Микроавтобус',
  'Пикап',
  'Родстер',
  'Спорт-купе',
  'Фургон',
];
const DRIVES = ['Задний', 'Передний', 'Полный'];
const GEARBOXES = ['Автомат', 'Механика', 'Вариатор', 'Роботизированная'];
const SEATS = ['2 места', '4 места', '5 мест', '6 мест', '7 мест', '8 мест', '9 мест'];
const CURRENCIES = ['$', '€'];

const OFFER_TYPE_OPTIONS = [
  { name: 'Продажа', src: '/online-shoping.png', size: 'w-4 h-4' },
  { name: 'Покупка', src: '/auto/transport.png', size: 'w-8 h-8' },
  { name: 'Аренда', src: '/key.png', size: 'w-4 h-4' },
  { name: 'Обмен', src: null, size: 'w-4 h-4' },
];

const OFFER_TYPE_LABELS: Record<string, string> = {
  Продажа: 'продаже',
  Покупка: 'покупке',
  Аренда: 'аренде',
  Обмен: 'обмене',
};

interface PlanLimits {
  maxListings: number | null;
  maxPhotos: number | null;
  maxDescriptionLen: number | null;
  badge?: string | null;
  videoEnabled?: boolean;
}

interface AddListingPageProps {
  onBack: () => void;
  vehicleType?: string;
  planLimits?: PlanLimits | null;
  effectivePlan?: string;
  onUpgradeClick?: () => void;
  onSubmit: (listing: {
    offerType: string;
    brand: string;
    model: string;
    year: string;
    mileage: string;
    fuel: string;
    body: string;
    drive: string;
    gearbox: string;
    engineVolume: string;
    seats: string;
    registration: string;
    region: string;
    price: string;
    currency: string;
    title: string;
    description: string;
    images: File[];
    videoUrl: string;
  }) => Promise<void> | void;
}

export const AddListingPage = ({
  onBack,
  onSubmit,
  vehicleType,
  planLimits,
  effectivePlan,
  onUpgradeClick,
}: AddListingPageProps) => {
  const maxPhotos = planLimits?.maxPhotos ?? 10;
  const maxDescriptionLen = planLimits?.maxDescriptionLen ?? null;
  const normalizedVehicleType = normalizeVehicleType(vehicleType);
  const schema = VEHICLE_LISTING_SCHEMAS[normalizedVehicleType];

  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [offerType, setOfferType] = useState('Продажа');
  const [images, setImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    brand: '',
    model: '',
    year: '',
    mileage: '',
    fuel: '',
    body: '',
    drive: '',
    gearbox: '',
    engineVolume: '',
    seats: '',
    registration: '',
    region: '',
    price: '',
    currency: '$',
    transportType: '',
    trailerType: '',
    bikeType: '',
    bikeCondition: '',
    bikeFrameMaterial: '',
    bikeSuspension: '',
    bikeFrameSize: '',
    videoUrl: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'brand') {
        next.model = '';
      }
      return next;
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((file: File) => file.type.startsWith('image/'));
    setImages((prev) => {
      const merged = [...prev, ...files];
      if (merged.length > maxPhotos) {
        showMarketToast(`Ваш план «${effectivePlan || 'free'}» позволяет максимум ${maxPhotos} фото.`);
      }
      return merged.slice(0, maxPhotos);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files).filter((file: File) => file.type.startsWith('image/'));
    setImages((prev) => {
      const merged = [...prev, ...files];
      if (merged.length > maxPhotos) {
        showMarketToast(`Ваш план «${effectivePlan || 'free'}» позволяет максимум ${maxPhotos} фото.`);
      }
      return merged.slice(0, maxPhotos);
    });
  };

  const getOfferTypeLabel = () => OFFER_TYPE_LABELS[offerType] || offerType.toLowerCase();

  const getPageTitle = () => `Создай объявление о ${getOfferTypeLabel()} в категории «${normalizedVehicleType}»`;

  const getDescription = () =>
    `Выберите тип предложения для объявления в категории «${normalizedVehicleType}».`;

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      return;
    }

    onBack();
  };

  const buildPublishTitle = () => {
    const manual = formData.title.trim();
    if (manual) {
      return manual;
    }

    if (schema.showTransportSpecs) {
      return formData.transportType ? `Перевозки • ${formData.transportType}` : 'Перевозки';
    }

    if (schema.showTrailerSpecs) {
      return formData.trailerType ? `Прицепы • ${formData.trailerType}` : 'Прицепы';
    }

    if (schema.showBikeSpecs) {
      const bikeBrandModel = [formData.brand, formData.model].filter(Boolean).join(' ').trim();
      if (bikeBrandModel) {
        return `Велосипед ${bikeBrandModel}`;
      }
      if (formData.bikeType) {
        return `Велосипед • ${formData.bikeType}`;
      }
      return 'Велосипед';
    }

    const pieces = [formData.year, formData.brand, formData.model].filter(Boolean);
    return pieces.length > 0 ? pieces.join(' ') : `Объявление • ${normalizedVehicleType}`;
  };

  const handlePublish = async () => {
    if (images.length === 0) {
      showMarketToast('Добавьте хотя бы 1 фото.');
      return;
    }

    if (!formData.price.trim()) {
      showMarketToast('Укажите цену.');
      return;
    }

    const metaTags = [
      `Категория: ${normalizedVehicleType}`,
      schema.showTransportSpecs && formData.transportType ? `Тип перевозки: ${formData.transportType}` : '',
      schema.showTrailerSpecs && formData.trailerType ? `Тип прицепа: ${formData.trailerType}` : '',
      schema.showBikeSpecs && formData.bikeType ? `Тип велосипеда: ${formData.bikeType}` : '',
      schema.showBikeSpecs && formData.bikeCondition ? `Состояние: ${formData.bikeCondition}` : '',
      schema.showBikeSpecs && formData.bikeFrameMaterial ? `Материал рамы: ${formData.bikeFrameMaterial}` : '',
      schema.showBikeSpecs && formData.bikeSuspension ? `Подвеска: ${formData.bikeSuspension}` : '',
      schema.showBikeSpecs && formData.bikeFrameSize ? `Размер рамы: ${formData.bikeFrameSize}` : '',
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    const descriptionCore = formData.description.trim();
    const descriptionMeta = metaTags.length ? `[${metaTags.join('] [')}]` : '';
    const mergedDescription = [descriptionCore, descriptionMeta].filter(Boolean).join('\n\n');

    if (maxDescriptionLen != null && mergedDescription.length > maxDescriptionLen) {
      showMarketToast(`Ваш план «${effectivePlan || 'free'}» позволяет описание до ${maxDescriptionLen} символов.`);
      return;
    }

    try {
      await onSubmit({
        offerType,
        brand: schema.showBrandModel ? formData.brand : '',
        model: schema.showBrandModel ? formData.model : '',
        year: schema.showAutoSpecs ? formData.year : '',
        mileage: schema.showAutoSpecs ? formData.mileage : '',
        fuel: schema.showAutoSpecs ? formData.fuel : '',
        body: schema.showAutoSpecs ? formData.body : '',
        drive: schema.showAutoSpecs ? formData.drive : '',
        gearbox: schema.showAutoSpecs ? formData.gearbox : '',
        engineVolume: schema.showAutoSpecs ? formData.engineVolume : '',
        seats: schema.showSeatsRegistration ? formData.seats : '',
        registration: schema.showSeatsRegistration ? formData.registration : '',
        region: formData.region,
        price: formData.price,
        currency: formData.currency,
        title: buildPublishTitle(),
        description: mergedDescription,
        images,
        videoUrl: planLimits?.videoEnabled ? formData.videoUrl.trim() : '',
      });
    } catch (error: any) {
      const data = error?.response?.data || error?.data;
      const code = data?.code;
      const msg = data?.message || error?.message || 'Не удалось опубликовать объявление.';
      if ((code === 'PLAN_LISTING_LIMIT' || code === 'PLAN_PHOTO_LIMIT' || code === 'PLAN_DESCRIPTION_LIMIT') && onUpgradeClick) {
        showMarketToast(msg);
        setTimeout(() => onUpgradeClick(), 600);
      } else {
        showMarketToast(msg);
      }
    }
  };

  const getBrandsAndModels = () => {
    switch (normalizedVehicleType) {
      case 'Грузовые автомобили':
        return { brands: TRUCK_BRANDS, models: TRUCK_MODELS };
      case 'Мото':
        return { brands: MOTO_BRANDS, models: MOTO_MODELS };
      case 'Микроавтобусы':
        return { brands: BUS_BRANDS, models: BUS_MODELS };
      case 'Велосипеды':
        return { brands: BIKE_BRANDS, models: BIKE_MODELS };
      default:
        return { brands: ALL_BRANDS, models: BRANDS_AND_MODELS };
    }
  };

  useEffect(() => {
    const { brands: nextBrands } = getBrandsAndModels();
    setBrands(Array.isArray(nextBrands) ? nextBrands : []);
  }, [normalizedVehicleType]);

  useEffect(() => {
    if (!schema.showBrandModel || !formData.brand) {
      setModels([]);
      return;
    }

    const { models: nextModelsMap } = getBrandsAndModels();
    const list = (nextModelsMap as Record<string, string[]>)[formData.brand] || [];
    setModels(list);
  }, [normalizedVehicleType, schema.showBrandModel, formData.brand]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Mobile header */}
        <div className="sm:hidden flex items-center mb-12 w-full">
          <button
            onClick={handleBack}
            className="hover:bg-white/10 p-2 rounded-full transition-colors shrink-0"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight leading-tight">Создай объявление</h1>
            <p className="text-gray-400 text-sm mt-1">Заполните информацию ниже, чтобы разместить своё объявление на рынке</p>
          </div>
          <div className="w-12 shrink-0" />
        </div>

        {/* Desktop header */}
        <div className="hidden sm:flex relative items-center justify-center mb-12 w-full">
          <button
            onClick={handleBack}
            className="absolute left-0 hover:bg-white/10 p-3 rounded-full transition-colors shrink-0"
          >
            <ChevronLeft className="w-12 h-12" />
          </button>
          <div className="w-full max-w-[760px] text-left">
            <h1 className="text-3xl font-bold mb-2 tracking-tight leading-tight">{getPageTitle()}</h1>
            <p className="text-gray-400 text-sm">Заполните информацию ниже, чтобы разместить своё объявление на рынке</p>
          </div>
          <div className="absolute right-0 shrink-0">
            <img src="/logo2.png" alt="AVTOTIME" className="h-16 lg:h-20 object-contain" referrerPolicy="no-referrer" />
          </div>
        </div>

        <div className="space-y-10 max-w-[760px] mx-auto">
          {planLimits && (
            <div className="bg-[#1a1a1a] rounded-2xl p-4 sm:p-5 border border-white/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/90 font-bold uppercase tracking-wider text-xs">
                  {effectivePlan || 'free'}
                </span>
                <span className="text-gray-400">
                  Фото: до {planLimits.maxPhotos ?? '∞'} • Описание: до {planLimits.maxDescriptionLen ?? '∞'} симв. • Объявлений: до {planLimits.maxListings ?? '∞'}
                </span>
              </div>
              {effectivePlan !== 'business' && onUpgradeClick && (
                <button
                  onClick={onUpgradeClick}
                  className="px-4 py-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors text-sm font-semibold"
                >
                  Улучшить план
                </button>
              )}
            </div>
          )}
          {step === 1 ? (
            <>
              <div className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20">
                <h2 className="text-xl font-bold mb-2">Тип предложения</h2>
                <p className="text-gray-400 text-sm mb-6">{getDescription()}</p>

                <div className="bg-white rounded-[14px] grid grid-cols-2 md:flex overflow-hidden max-w-[600px] mx-auto">
                  {OFFER_TYPE_OPTIONS.map((type) => (
                    <button
                      key={type.name}
                      onClick={() => setOfferType(type.name)}
                      className={`flex md:flex-1 items-center justify-center gap-2 lg:gap-3 px-6 py-2.5 md:py-1.5 text-[13px] lg:text-[15px] font-medium transition-all ${
                        offerType === type.name ? 'bg-black text-white rounded-[12px]' : 'text-black hover:bg-gray-50'
                      }`}
                    >
                      {type.src
                        ? <img src={type.src} className={`${type.size} object-contain transition-all`} style={offerType === type.name ? { filter: 'brightness(0) invert(1)' } : {}} />
                        : <RefreshCw className="w-4 h-4" />
                      }
                      {type.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20">
                <h2 className="text-xl font-bold mb-2">Детали</h2>
                <p className="text-gray-400 text-sm mb-6">Укажите характеристики: {normalizedVehicleType}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {schema.showBrandModel ? (
                    <SelectField
                      label="Марка"
                      value={formData.brand}
                      onChange={(v) => handleInputChange('brand', v)}
                      options={brands}
                      placeholder="Выберите марку"
                    />
                  ) : null}
                  {schema.showBrandModel ? (
                    <SelectField
                      label="Модель"
                      value={formData.model}
                      onChange={(v) => handleInputChange('model', v)}
                      options={models}
                      placeholder="Выберите модель"
                      disabled={!formData.brand}
                    />
                  ) : null}

                  {schema.showTransportSpecs ? (
                    <SelectField
                      label="Тип перевозки"
                      value={formData.transportType}
                      onChange={(v) => handleInputChange('transportType', v)}
                      options={TRANSPORT_TYPES.filter((x) => x !== 'Все')}
                      placeholder="Выберите"
                    />
                  ) : null}

                  {schema.showTrailerSpecs ? (
                    <SelectField
                      label="Тип прицепа"
                      value={formData.trailerType}
                      onChange={(v) => handleInputChange('trailerType', v)}
                      options={TRAILER_TYPES}
                      placeholder="Выберите"
                    />
                  ) : null}

                  {schema.showBikeSpecs ? (
                    <SelectField
                      label="Тип велосипеда"
                      value={formData.bikeType}
                      onChange={(v) => handleInputChange('bikeType', v)}
                      options={BIKE_TYPES.filter((x) => x !== 'Все')}
                      placeholder="Выберите"
                    />
                  ) : null}
                  {schema.showBikeSpecs ? (
                    <SelectField
                      label="Состояние"
                      value={formData.bikeCondition}
                      onChange={(v) => handleInputChange('bikeCondition', v)}
                      options={BIKE_CONDITIONS.filter((x) => x !== 'Все')}
                      placeholder="Выберите"
                    />
                  ) : null}
                  {schema.showBikeSpecs ? (
                    <SelectField
                      label="Материал рамы"
                      value={formData.bikeFrameMaterial}
                      onChange={(v) => handleInputChange('bikeFrameMaterial', v)}
                      options={BIKE_FRAME_MATERIALS.filter((x) => x !== 'Все')}
                      placeholder="Выберите"
                    />
                  ) : null}
                  {schema.showBikeSpecs ? (
                    <SelectField
                      label="Подвеска"
                      value={formData.bikeSuspension}
                      onChange={(v) => handleInputChange('bikeSuspension', v)}
                      options={BIKE_SUSPENSIONS.filter((x) => x !== 'Все')}
                      placeholder="Выберите"
                    />
                  ) : null}
                  {schema.showBikeSpecs ? (
                    <SelectField
                      label="Размер рамы"
                      value={formData.bikeFrameSize}
                      onChange={(v) => handleInputChange('bikeFrameSize', v)}
                      options={BIKE_FRAME_SIZES.filter((x) => x !== 'Все')}
                      placeholder="Выберите"
                    />
                  ) : null}

                  {schema.showAutoSpecs ? (
                    <div>
                      <label className="block text-sm font-bold mb-2">Год</label>
                      <input
                        type="number"
                        placeholder="2025"
                        value={formData.year}
                        onChange={(e) => handleInputChange('year', e.target.value)}
                        className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  ) : null}

                  {schema.showAutoSpecs ? (
                    <div>
                      <label className="block text-sm font-bold mb-2">Пробег</label>
                      <input
                        type="number"
                        placeholder="50000"
                        value={formData.mileage}
                        onChange={(e) => handleInputChange('mileage', e.target.value)}
                        className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  ) : null}

                  {schema.showAutoSpecs ? (
                    <SelectField
                      label="Топливо"
                      value={formData.fuel}
                      onChange={(v) => handleInputChange('fuel', v)}
                      options={FUELS}
                      placeholder="Выберите топливо"
                    />
                  ) : null}
                  {schema.showAutoSpecs ? (
                    <SelectField
                      label="Кузов"
                      value={formData.body}
                      onChange={(v) => handleInputChange('body', v)}
                      options={BODIES}
                      placeholder="Выберите кузов"
                    />
                  ) : null}
                  {schema.showAutoSpecs ? (
                    <SelectField
                      label="Привод"
                      value={formData.drive}
                      onChange={(v) => handleInputChange('drive', v)}
                      options={DRIVES}
                      placeholder="Выберите привод"
                    />
                  ) : null}
                  {schema.showAutoSpecs ? (
                    <SelectField
                      label="Коробка передач"
                      value={formData.gearbox}
                      onChange={(v) => handleInputChange('gearbox', v)}
                      options={GEARBOXES}
                      placeholder="Выберите КПП"
                    />
                  ) : null}

                  {schema.showAutoSpecs ? (
                    <div>
                      <label className="block text-sm font-bold mb-2">Объем двигателя</label>
                      <input
                        type="text"
                        placeholder="3.0"
                        value={formData.engineVolume}
                        onChange={(e) => handleInputChange('engineVolume', e.target.value)}
                        className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button
                  onClick={() => setStep(2)}
                  className="bg-transparent border border-white/20 text-white px-24 py-3.5 rounded-xl font-medium hover:bg-white/5 transition-colors flex items-center gap-2 text-lg"
                >
                  Далее
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold mb-2">Основная информация</h2>
                <p className="text-gray-400 text-sm mb-6">Укажите основные детали вашего объявления</p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold mb-2">Название объявления</label>
                    <input
                      type="text"
                      placeholder="BMW X3"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">Описание</label>
                    <textarea
                      placeholder="Хорошее состояние"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">Фотографии</label>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleFileDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-gray-600 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors bg-[#1a1a1a]"
                    >
                      <Upload className="w-12 h-12 text-gray-500 mb-4" />
                      <p className="text-gray-500 text-sm mb-2 text-center">
                        Перетащите изображения сюда или нажмите, чтобы просмотреть
                      </p>
                      <p className="text-gray-600 text-xs">{images.length}/{maxPhotos} изображений</p>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                      />
                    </div>

                    {images.length > 0 && (
                      <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                        {images.map((img, idx) => (
                          <div
                            key={idx}
                            className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-white/10 relative group"
                          >
                            <img
                              src={URL.createObjectURL(img)}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImages((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 bg-black/50 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {planLimits?.videoEnabled ? (
                    <div>
                      <label className="block text-sm font-bold mb-2">
                        Видео объявления
                        <span className="ml-2 text-[11px] uppercase tracking-wider text-emerald-400 font-bold">
                          {effectivePlan || 'pro'}
                        </span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=… или https://vimeo.com/…"
                        value={formData.videoUrl}
                        onChange={(e) => handleInputChange('videoUrl', e.target.value)}
                        className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <p className="text-gray-500 text-xs mt-2">
                        Поддерживается YouTube и Vimeo. Видео покажется в карточке объявления.
                      </p>
                    </div>
                  ) : onUpgradeClick ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="text-sm text-gray-400">
                        Хотите добавить видео к объявлению? Доступно на тарифах Pro и Business.
                      </div>
                      <button
                        onClick={onUpgradeClick}
                        type="button"
                        className="px-4 py-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors text-sm font-semibold"
                      >
                        Улучшить план
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold mb-2">Дополнительная информация</h2>
                <p className="text-gray-400 text-sm mb-6">
                  {schema.showSeatsRegistration ? 'Более подробная информация о регистрации и местоположении' : 'Укажите местоположение'}
                </p>

                <div className={`grid grid-cols-1 ${schema.showSeatsRegistration ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-6`}>
                  {schema.showSeatsRegistration ? (
                    <SelectField
                      label="Количество мест"
                      value={formData.seats}
                      onChange={(v) => handleInputChange('seats', v)}
                      options={SEATS}
                      placeholder="Выберите"
                    />
                  ) : null}
                  {schema.showSeatsRegistration ? (
                    <SelectField
                      label="Место регистрации"
                      value={formData.registration}
                      onChange={(v) => handleInputChange('registration', v)}
                      options={['Германия', 'Россия', 'Беларусь', 'Казахстан']}
                      placeholder="Выберите"
                    />
                  ) : null}
                  <SelectField
                    label="Регион нахождения"
                    value={formData.region}
                    onChange={(v) => handleInputChange('region', v)}
                    options={['Бавария', 'Москва', 'Минск', 'Астана']}
                    placeholder="Выберите"
                  />
                </div>
              </div>

              <div className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold mb-2">Цена</h2>
                <p className="text-gray-400 text-sm mb-6">Установите вашу цену</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold mb-2">Цена</label>
                    <input
                      type="number"
                      placeholder="25000"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <SelectField
                    label="Валюта"
                    value={formData.currency}
                    onChange={(v) => handleInputChange('currency', v)}
                    options={CURRENCIES}
                    placeholder="$"
                  />
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button type="button" onClick={handlePublish} className="bg-[#e33232] text-white px-24 py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-3 w-full max-w-[400px]">
                  <Car className="w-7 h-7 text-white" />
                  Опубликовать
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
}

const SelectField = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: SelectFieldProps) => {
  return (
    <div>
      <label className="block text-sm font-bold mb-2">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full bg-white text-black rounded-lg pl-4 pr-10 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-red-500 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
};
