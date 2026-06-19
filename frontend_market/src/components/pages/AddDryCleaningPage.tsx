import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Plus, Upload, X } from 'lucide-react';
import { DRY_CLEANING_TYPES } from '../../constants/dryCleaning';
import { DryCleaningCreatePayload } from '../../types';
import { LocationPickerMapModal } from '../shared/LocationPickerMapModal';

interface AddDryCleaningPageProps {
  onBack: () => void;
  onSubmit: (listing: DryCleaningCreatePayload) => void | Promise<void>;
  currentUserName?: string;
}

interface FormData {
  title: string;
  socialNickname: string;
  category: string;
  location: string;
  price: string;
  badge: string;
  tags: string;
  rating: string;
  reviews: string;
}

const INITIAL_FORM_DATA: FormData = {
  title: '',
  socialNickname: '',
  category: '',
  location: '',
  price: '',
  badge: '',
  tags: '',
  rating: '',
  reviews: '',
};

const splitByComma = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const buildFallbackImage = (category: string) => {
  const encoded = encodeURIComponent(category || 'Химчистка');
  return `https://ui-avatars.com/api/?name=${encoded}&background=111827&color=ffffff&size=900&bold=true`;
};

export const AddDryCleaningPage: React.FC<AddDryCleaningPageProps> = ({ onBack, onSubmit, currentUserName }) => {
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

  const tags = splitByComma(formData.tags);
  const previewImage = imagePreview || buildFallbackImage(formData.category);
  const resolvedNickname = (currentUserName || formData.socialNickname).trim();

  const canProceed = Boolean(
    formData.title.trim() &&
      resolvedNickname &&
      formData.category &&
      formData.location.trim() &&
      formData.price.trim() &&
      formData.badge.trim(),
  );
  const canPublish = canProceed && tags.length > 0;

  const handlePublish = async () => {
    if (!canPublish) {
      return;
    }

    await onSubmit({
      title: formData.title.trim(),
      socialNickname: resolvedNickname,
      category: formData.category,
      location: formData.location.trim(),
      rating: Number(formData.rating) || 0,
      reviews: Number(formData.reviews) || 0,
      price: Number(formData.price) || 0,
      image: imageFile ? '' : previewImage,
      imageFile,
      badge: formData.badge.trim(),
      tags,
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
        title="Выберите регион для химчистки"
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="relative flex items-center justify-center mb-12 w-full">
          <button onClick={handleBack} className="absolute left-0 hover:bg-white/10 p-3 rounded-full transition-colors shrink-0">
            <ChevronLeft className="w-12 h-12" />
          </button>

          <div className="w-full max-w-[820px] text-left">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight leading-tight">Создайте объявление для химчистки</h1>
            <p className="text-gray-400 text-sm">
              Заполните карточку услуги так, как она должна отображаться на странице химчистки.
            </p>
          </div>

          <div className="absolute right-0 shrink-0">
            <img src="/logo2.png" alt="AVTOTIME" className="h-16 lg:h-20 object-contain" referrerPolicy="no-referrer" />
          </div>
        </div>

        <div className="space-y-10 max-w-[820px] mx-auto">
          {step === 1 ? (
            <>
              <section className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20">
                <h2 className="text-xl font-bold mb-2">Основные данные</h2>
                <p className="text-gray-400 text-sm mb-6">Укажите информацию, которая попадёт в карточку услуги.</p>

                <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-8">
                  <div>
                    <label className="block text-sm font-bold mb-2">Фото услуги</label>
                    <div className="bg-[#111111] border border-dashed border-white/15 rounded-2xl p-4">
                      <div className="w-full h-44 rounded-[24px] overflow-hidden border border-white/10 mb-4 bg-white/5">
                        <img
                          src={previewImage}
                          alt={formData.title || 'Химчистка'}
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

                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

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
                      label="Название услуги"
                      value={formData.title}
                      onChange={(value) => updateField('title', value)}
                      placeholder="Химчистка салона"
                      className="sm:col-span-2"
                    />
                    <TextField
                      label="Ник в AVTOTIME"
                      value={currentUserName ?? formData.socialNickname}
                      onChange={(value) => {
                        if (currentUserName) return;
                        updateField('socialNickname', value);
                      }}
                      placeholder="@clean.master"
                      className="sm:col-span-2"
                      disabled={Boolean(currentUserName)}
                    />
                    <SelectField
                      label="Категория"
                      value={formData.category}
                      onChange={(value) => updateField('category', value)}
                      options={DRY_CLEANING_TYPES}
                      placeholder="Выберите тип"
                    />
                    <TextField
                      label="Бейдж"
                      value={formData.badge}
                      onChange={(value) => updateField('badge', value)}
                      placeholder="Топ мастер"
                    />

                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold mb-2">Город или регион</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.location}
                            onChange={(event) => updateField('location', event.target.value)}
                            placeholder="Кишинев"
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

                      <div>
                        <label className="block text-sm font-bold mb-2">Цена (RUB)</label>
                        <input
                          type="number"
                          value={formData.price}
                          onChange={(event) => updateField('price', event.target.value)}
                          placeholder="1200"
                          className="w-full bg-white text-black rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>

                    <TextField
                      label="Теги"
                      value={formData.tags}
                      onChange={(value) => updateField('tags', value)}
                      placeholder="салон, пятна, быстро"
                      className="sm:col-span-2"
                      hint="Разделяйте теги запятыми."
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canProceed}
                  className="bg-transparent border border-white/20 text-white px-24 py-3.5 rounded-xl font-medium hover:bg-white/5 transition-colors flex items-center gap-2 text-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  Далее
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <section className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold mb-2">Дополнительные показатели</h2>
                <p className="text-gray-400 text-sm mb-6">
                  При желании можно сразу задать рейтинг и количество отзывов.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <NumberField
                    label="Рейтинг"
                    value={formData.rating}
                    onChange={(value) => updateField('rating', value)}
                    placeholder="5"
                    min="1"
                    max="5"
                    step="1"
                  />
                  <NumberField
                    label="Отзывы"
                    value={formData.reviews}
                    onChange={(value) => updateField('reviews', value)}
                    placeholder="128"
                    min="0"
                  />
                </div>
              </section>

              <section className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold mb-2">Что будет опубликовано</h2>
                <p className="text-gray-400 text-sm mb-6">Проверьте ключевые поля перед публикацией.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SummaryRow icon={<Plus className="w-5 h-5" />} label="Услуга" value={formData.title || 'Не указано'} />
                  <SummaryRow icon={<Plus className="w-5 h-5" />} label="Ник AVTOTIME" value={resolvedNickname || 'Не указано'} />
                  <SummaryRow icon={<MapPin className="w-5 h-5" />} label="Локация" value={formData.location || 'Не указано'} />
                  <SummaryRow icon={<Calendar className="w-5 h-5" />} label="Категория" value={formData.category || 'Не указано'} />
                </div>
              </section>

              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!canPublish}
                  className="bg-[#e33232] text-white px-24 py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-3 w-full max-w-[420px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#e33232]"
                >
                  <Plus className="w-6 h-6 text-white" />
                  Опубликовать химчистку
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
  hint?: string;
  disabled?: boolean;
}

const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, placeholder, className, hint, disabled }) => (
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
    {hint && <p className="text-xs text-gray-500 mt-2">{hint}</p>}
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
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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
