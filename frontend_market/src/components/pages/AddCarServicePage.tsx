import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { CAR_SERVICE_TYPES } from '../../constants/carServices';
import { CarServiceCreatePayload } from '../../types';
import { LocationPickerMapModal } from '../shared/LocationPickerMapModal';

interface AddCarServicePageProps {
  onBack: () => void;
  onSubmit: (service: CarServiceCreatePayload) => void;
  currentUserName?: string;
}

interface FormData {
  title: string;
  socialNickname: string;
  category: string;
  location: string;
  price: string;
  unit: string;
  serviceQuality: string;
  reviews: string;
}

const INITIAL_FORM_DATA: FormData = {
  title: '',
  socialNickname: '',
  category: '',
  location: '',
  price: '',
  unit: '/час',
  serviceQuality: '',
  reviews: '',
};

const UNIT_OPTIONS = ['/час', '/услуга', '/визит', ''];

const buildFallbackImage = (category: string) => {
  const encoded = encodeURIComponent(category || 'Автосервис');
  return `https://ui-avatars.com/api/?name=${encoded}&background=111827&color=ffffff&size=900&bold=true`;
};

const formatPrice = (price: string | number, unit = '', pricePrefix = '') => {
  const numericPrice = Number(price) || 0;
  const prefix = pricePrefix ? `${pricePrefix} ` : '';
  return `${prefix}${numericPrice.toLocaleString('ru-RU')} RUB${unit ? ` ${unit}` : ''}`;
};

export const AddCarServicePage: React.FC<AddCarServicePageProps> = ({ onBack, onSubmit, currentUserName }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [imagePreview, setImagePreview] = useState('');
  const [imageObjectUrl, setImageObjectUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (imageObjectUrl) {
        URL.revokeObjectURL(imageObjectUrl);
      }
    };
  }, [imageObjectUrl]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setImageObjectUrl(nextUrl);
    setImagePreview(nextUrl);
    setImageFile(file);
  };

  const handleRemoveImage = () => {
    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl);
    }

    setImagePreview('');
    setImageObjectUrl('');
    setImageFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      return;
    }

    onBack();
  };

  const previewImage = imagePreview || buildFallbackImage(formData.category);
  const resolvedNickname = (currentUserName || formData.socialNickname).trim();
  const canProceed = Boolean(
    formData.title.trim() &&
      resolvedNickname &&
      formData.category &&
      formData.location.trim() &&
      formData.price.trim(),
  );

  const handlePublish = () => {
    if (!canProceed) {
      return;
    }

    onSubmit({
      image: imageFile ? '' : previewImage,
      imageFile,
      socialNickname: resolvedNickname,
      category: formData.category,
      title: formData.title.trim(),
      location: formData.location.trim(),
      serviceQuality: Number(formData.serviceQuality) || 0,
      reviews: Number(formData.reviews) || 0,
      price: Number(formData.price) || 0,
      unit: formData.unit,
    });

    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl);
    }

    setFormData(INITIAL_FORM_DATA);
    setImagePreview('');
    setImageObjectUrl('');
    setImageFile(null);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <LocationPickerMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelect={(picked) => updateField('location', picked.label)}
        selectedRegion={formData.location}
        title="Выберите регион для автосервиса"
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-12">
        {/* Mobile header */}
        <div className="flex sm:hidden items-center gap-3 mb-6">
          <button onClick={handleBack} className="hover:bg-white/10 p-2 rounded-full transition-colors shrink-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-[17px] font-bold leading-tight">Создай объявление</h1>
          </div>
          <div className="w-10 shrink-0" />
        </div>

        {/* Desktop header */}
        <div className="hidden sm:flex relative items-center justify-center mb-10 w-full">
          <button onClick={handleBack} className="absolute left-0 hover:bg-white/10 p-3 rounded-full transition-colors shrink-0">
            <ChevronLeft className="w-10 h-10" />
          </button>
          <div className="w-full max-w-[820px] text-left">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight leading-tight">
              Создайте объявление для автосервиса
            </h1>
            <p className="text-gray-400 text-sm">
              Заполните карточку сервиса так, как она должна отображаться в каталоге автосервисов.
            </p>
          </div>
          <div className="absolute right-0 shrink-0">
            <img src="/logo2.png" alt="AVTOTIME" className="h-16 lg:h-20 object-contain" referrerPolicy="no-referrer" />
          </div>
        </div>

        <div className="space-y-5 sm:space-y-10 max-w-[820px] mx-auto">
          {step === 1 ? (
            <>
              <section className="bg-[#1a1a1a] rounded-2xl p-4 sm:p-8 border border-white/20">
                <h2 className="text-xl font-bold mb-2">Основные данные</h2>
                <p className="text-gray-400 text-sm mb-6">Укажите информацию, которая попадет в карточку автосервиса.</p>

                <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-8">
                  <div>
                    <label className="block text-sm font-bold mb-2">Фото сервиса</label>
                    <div className="bg-[#111111] border border-dashed border-white/15 rounded-2xl p-4">
                      <div className="w-full h-44 rounded-[24px] overflow-hidden border border-white/10 mb-4 bg-white/5">
                        <img
                          src={previewImage}
                          alt={formData.title || 'Автосервис'}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-2xl border border-dashed border-white/15 p-4 text-center cursor-pointer hover:border-red-500/50 hover:bg-white/5 transition-colors"
                      >
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-300 mb-1">Загрузить фото</p>
                        <p className="text-xs text-gray-500">PNG, JPG или WEBP</p>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageSelect}
                      />

                      {imagePreview && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Убрать загруженное фото
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TextField
                      label="Название сервиса"
                      value={formData.title}
                      onChange={(value) => updateField('title', value)}
                      placeholder="Диагностика и ремонт двигателя"
                      className="sm:col-span-2"
                    />
                    <TextField
                      label="Ник в AVTOTIME"
                      value={currentUserName ?? formData.socialNickname}
                      onChange={(value) => {
                        if (currentUserName) {
                          return;
                        }
                        updateField('socialNickname', value);
                      }}
                      placeholder="@engine.fix.spb"
                      className="sm:col-span-2"
                      disabled={Boolean(currentUserName)}
                    />
                    <SelectField
                      label="Категория"
                      value={formData.category}
                      onChange={(value) => updateField('category', value)}
                      options={CAR_SERVICE_TYPES}
                      placeholder="Выберите тип услуги"
                    />
                    <SelectField
                      label="Единица цены"
                      value={formData.unit}
                      onChange={(value) => updateField('unit', value)}
                      options={UNIT_OPTIONS}
                      placeholder="/час"
                    />
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold mb-2">Город или регион</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.location}
                            onChange={(event) => updateField('location', event.target.value)}
                            placeholder="Москва"
                            className="w-full bg-white text-black rounded-lg pl-4 pr-16 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                          <button
                            type="button"
                            onClick={() => setIsMapOpen(true)}
                            className="absolute right-1 top-1 bottom-1 w-12 flex items-center justify-center rounded-xl bg-black text-white hover:bg-red-600 transition-colors"
                            aria-label="Выбрать регион на карте"
                            title="Выбрать на карте"
                          >
                            <MapPin className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <NumberField
                        label="Цена услуги, RUB"
                        value={formData.price}
                        onChange={(value) => updateField('price', value)}
                        placeholder="5000"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-[#1a1a1a] rounded-2xl p-4 sm:p-8 border border-white/20">
                <h2 className="text-xl font-bold mb-2">Предпросмотр карточки</h2>
                <p className="text-gray-400 text-sm mb-6">Показывает, как объявление будет выглядеть в каталоге.</p>

                <div className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm">
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={previewImage}
                      alt={formData.title || 'Автосервис'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider">
                        {formData.category || 'Категория'}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 text-gray-900">
                    <h3 className="text-xl font-bold mb-2 leading-tight">{formData.title || 'Название сервиса'}</h3>
                    <div className="flex items-center gap-1.5 text-gray-500 text-[14px] mb-4">
                      <MapPin className="w-4 h-4" />
                      {formData.location || 'Город'}
                    </div>
                    {(Number(formData.serviceQuality) > 0 || Number(formData.reviews) > 0) && (
                      <div className="flex items-center gap-2 mb-6">
                        <span className="font-bold text-gray-900">{`${formData.serviceQuality || '0'}/5`}</span>
                        <span className="text-gray-400 text-[14px]">({formData.reviews || '0'} отзывов)</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">{formatPrice(formData.price, formData.unit)}</span>
                      </div>
                      <button className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold">
                        Забронировать
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canProceed}
                  className="bg-transparent border border-white/20 text-white w-full sm:w-auto px-8 sm:px-24 py-3.5 rounded-xl font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  Далее
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <section className="bg-[#1a1a1a] rounded-2xl p-4 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold mb-2">Дополнительные показатели</h2>
                <p className="text-gray-400 text-sm mb-6">При желании можно сразу задать качество обслуживания и количество отзывов.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <NumberField
                    label="Качество обслуживания"
                    value={formData.serviceQuality}
                    onChange={(value) => updateField('serviceQuality', value)}
                    placeholder="5"
                    min="1"
                    max="5"
                    step="1"
                  />
                  <NumberField
                    label="Количество отзывов"
                    value={formData.reviews}
                    onChange={(value) => updateField('reviews', value)}
                    placeholder="89"
                    min="0"
                  />
                </div>
              </section>

              <section className="bg-[#1a1a1a] rounded-2xl p-4 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold mb-2">Что будет опубликовано</h2>
                <p className="text-gray-400 text-sm mb-6">Проверьте ключевые поля перед публикацией.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SummaryRow icon={<Plus className="w-5 h-5" />} label="Сервис" value={formData.title || 'Не указано'} />
                  <SummaryRow icon={<Plus className="w-5 h-5" />} label="Ник AVTOTIME" value={resolvedNickname || 'Не указано'} />
                  <SummaryRow icon={<MapPin className="w-5 h-5" />} label="Локация" value={formData.location || 'Не указано'} />
                  <SummaryRow icon={<Calendar className="w-5 h-5" />} label="Категория" value={formData.category || 'Не указано'} />
                  <SummaryRow icon={<Calendar className="w-5 h-5" />} label="Цена" value={formatPrice(formData.price, formData.unit)} />
                </div>
              </section>

              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!canProceed}
                  className="bg-[#e33232] text-white px-8 sm:px-16 py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-3 w-full sm:max-w-[420px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#e33232]"
                >
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  Опубликовать автосервис
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
}

const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, placeholder, className, disabled }) => (
  <div className={className}>
    <label className="block text-sm font-bold mb-2">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
    />
  </div>
);

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  min?: string;
  max?: string;
  step?: string;
}

const NumberField: React.FC<NumberFieldProps> = ({ label, value, onChange, placeholder, min, max, step }) => (
  <div>
    <label className="block text-sm font-bold mb-2">{label}</label>
    <input
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
    />
  </div>
);

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, options, placeholder }) => (
  <div>
    <label className="block text-sm font-bold mb-2">{label}</label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option || 'empty'} value={option}>
          {option || 'Без единицы'}
        </option>
      ))}
    </select>
  </div>
);

interface SummaryRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ icon, label, value }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3">
    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-red-400 shrink-0">{icon}</div>
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">{label}</div>
      <div className="text-sm text-white font-medium">{value}</div>
    </div>
  </div>
);
