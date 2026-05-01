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
import { LocationPickerMapModal } from '../shared/LocationPickerMapModal';
import { ConsultationExpertCreatePayload } from '../../types';

interface AddConsultationPageProps {
  onBack: () => void;
  onSubmit: (expert: ConsultationExpertCreatePayload) => void;
  currentUserName?: string;
}

interface FormData {
  name: string;
  socialNickname: string;
  specialties: string;
  location: string;
  hourlyRate: string;
  experience: string;
  consultations: string;
  tags: string;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  socialNickname: '',
  specialties: '',
  location: '',
  hourlyRate: '',
  experience: '',
  consultations: '',
  tags: '',
};

const splitByComma = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const formatExperienceYears = (value: string | number) => {
  const years = Number(value) || 0;
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

const buildFallbackAvatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'AV')}&background=F3F4F6&color=111827&size=240`;

export const AddConsultationPage: React.FC<AddConsultationPageProps> = ({ onBack, onSubmit, currentUserName }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarObjectUrl, setAvatarObjectUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (avatarObjectUrl) {
        URL.revokeObjectURL(avatarObjectUrl);
      }
    };
  }, [avatarObjectUrl]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    if (avatarObjectUrl) {
      URL.revokeObjectURL(avatarObjectUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setAvatarObjectUrl(nextUrl);
    setAvatarPreview(nextUrl);
    setAvatarFile(file);
  };

  const handleRemoveAvatar = () => {
    if (avatarObjectUrl) {
      URL.revokeObjectURL(avatarObjectUrl);
    }

    setAvatarObjectUrl('');
    setAvatarPreview('');
    setAvatarFile(null);

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

  const specialties = splitByComma(formData.specialties);
  const tags = splitByComma(formData.tags);
  const previewAvatar = avatarPreview || buildFallbackAvatar(formData.name);
  const resolvedNickname = (currentUserName || formData.socialNickname).trim();
  const canProceed = Boolean(
    formData.name.trim() &&
      resolvedNickname &&
      formData.location.trim() &&
      specialties.length > 0 &&
      formData.hourlyRate.trim(),
  );
  const canPublish =
    canProceed &&
    Boolean(formData.experience.trim() && formData.consultations.trim() && tags.length > 0);

  const handlePublish = () => {
    if (!canPublish) {
      return;
    }

    onSubmit({
      name: formData.name.trim(),
      avatar: avatarFile ? '' : previewAvatar,
      avatarFile,
      socialNickname: resolvedNickname,
      isVerified: false,
      rating: 0,
      reviewsCount: 0,
      specialties,
      experience: Number(formData.experience) || 0,
      consultations: Number(formData.consultations) || 0,
      hourlyRate: Number(formData.hourlyRate) || 0,
      tags,
      location: formData.location.trim(),
    });

    if (avatarObjectUrl) {
      URL.revokeObjectURL(avatarObjectUrl);
    }

    setFormData(INITIAL_FORM_DATA);
    setAvatarPreview('');
    setAvatarObjectUrl('');
    setAvatarFile(null);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <LocationPickerMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelect={(region) => updateField('location', region)}
        selectedRegion={formData.location}
        title="Выберите регион для консультации"
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="relative flex items-center justify-center mb-12 w-full">
          <button
            onClick={handleBack}
            className="absolute left-0 hover:bg-white/10 p-3 rounded-full transition-colors shrink-0"
          >
            <ChevronLeft className="w-12 h-12" />
          </button>

          <div className="w-full max-w-[820px] text-left">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight leading-tight">
              Создайте объявление для авто-консультации
            </h1>
            <p className="text-gray-400 text-sm">
              Заполните карточку специалиста так, как она должна отображаться на странице консультаций.
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
                <h2 className="text-xl font-bold mb-2">Профиль специалиста</h2>
                <p className="text-gray-400 text-sm mb-6">Укажите базовую информацию, которая будет видна в карточке.</p>

                <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-8">
                  <div>
                    <label className="block text-sm font-bold mb-2">Фото специалиста</label>
                    <div className="bg-[#111111] border border-dashed border-white/15 rounded-2xl p-4">
                      <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white/10 mx-auto mb-4 bg-white/5">
                        <img
                          src={previewAvatar}
                          alt={formData.name || 'Специалист'}
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
                        onChange={handleAvatarSelect}
                      />

                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
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
                      label="Имя и фамилия"
                      value={formData.name}
                      onChange={(value) => updateField('name', value)}
                      placeholder="Александр Петров"
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
                      placeholder="@alex.petrov"
                      className="sm:col-span-2"
                      disabled={Boolean(currentUserName)}
                    />
                    <TextField
                      label="Специализации"
                      value={formData.specialties}
                      onChange={(value) => updateField('specialties', value)}
                      placeholder="Юрист, Автоправо"
                      className="sm:col-span-2"
                      hint="Разделяйте значения запятыми"
                    />
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                        value={formData.hourlyRate}
                        onChange={(value) => updateField('hourlyRate', value)}
                        placeholder="5000"
                        min="0"
                      />
                      <NumberField
                        label="Опыт, лет"
                        value={formData.experience}
                        onChange={(value) => updateField('experience', value)}
                        placeholder="12"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20">
                <h2 className="text-xl font-bold mb-2">Предпросмотр карточки</h2>
                <p className="text-gray-400 text-sm mb-6">Показывает, как заполненные значения будут смотреться в списке.</p>

                <div className="bg-white text-gray-900 rounded-[32px] p-6 sm:p-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex flex-col items-center text-center md:w-[220px]">
                      <img
                        src={previewAvatar}
                        alt={formData.name || 'Специалист'}
                        className="w-32 h-32 rounded-full object-cover border-4 border-gray-50 mb-4"
                        referrerPolicy="no-referrer"
                      />
                      <h3 className="text-xl font-bold">{formData.name || 'Имя специалиста'}</h3>
                    </div>

                    <div className="flex-1 space-y-5">
                      <div className="flex flex-wrap gap-2">
                        {(specialties.length > 0 ? specialties : ['Специализация']).map((item) => (
                          <span
                            key={item}
                            className="bg-gray-50 text-gray-600 px-4 py-1.5 rounded-full text-[13px] font-bold border border-gray-100"
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <PreviewStat value={formatExperienceYears(formData.experience)} label="Опыт" accent />
                        <PreviewStat value={`${formData.consultations || '0'}+`} label="Консультации" />
                        <PreviewStat value={formData.hourlyRate ? Number(formData.hourlyRate).toLocaleString('ru-RU') : '0'} label="RUB/час" accent />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(tags.length > 0 ? tags : ['Темы консультаций']).map((item) => (
                          <span
                            key={item}
                            className="bg-gray-50 text-gray-600 px-4 py-1.5 rounded-xl text-[13px] font-medium border border-gray-100"
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-gray-500">
                        <MapPin className="w-5 h-5" />
                        <span className="font-medium">{formData.location || 'Город'}</span>
                      </div>
                    </div>
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
                <h2 className="text-xl font-bold mb-2">Параметры карточки</h2>
                <p className="text-gray-400 text-sm mb-6">Эти данные попадут в числовые блоки и теги карточки.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <NumberField
                    label="Количество консультаций"
                    value={formData.consultations}
                    onChange={(value) => updateField('consultations', value)}
                    placeholder="450"
                    min="0"
                  />
                  <TextField
                    label="Темы консультаций"
                    value={formData.tags}
                    onChange={(value) => updateField('tags', value)}
                    placeholder="Договоры купли-продажи, Споры при ДТП"
                    className="sm:col-span-2"
                    hint="Каждая тема станет отдельным тегом карточки"
                  />
                </div>
              </section>

              <section className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold mb-2">Что будет опубликовано</h2>
                <p className="text-gray-400 text-sm mb-6">Проверьте финальный набор полей перед публикацией.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SummaryRow icon={<Plus className="w-5 h-5" />} label="Специалист" value={formData.name || 'Не указано'} />
                  <SummaryRow icon={<Plus className="w-5 h-5" />} label="Ник AVTOTIME" value={resolvedNickname || 'Не указано'} />
                  <SummaryRow icon={<MapPin className="w-5 h-5" />} label="Локация" value={formData.location || 'Не указано'} />
                  <SummaryRow
                    icon={<Calendar className="w-5 h-5" />}
                    label="Цена услуги"
                    value={formData.hourlyRate ? `${Number(formData.hourlyRate).toLocaleString('ru-RU')} RUB` : 'Не указано'}
                  />
                  <SummaryRow icon={<Calendar className="w-5 h-5" />} label="Опыт" value={formatExperienceYears(formData.experience)} />
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
                  Опубликовать консультацию
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

interface PreviewStatProps {
  value: string;
  label: string;
  accent?: boolean;
}

const PreviewStat: React.FC<PreviewStatProps> = ({ value, label, accent = false }) => (
  <div className={`${accent ? 'bg-red-50' : 'bg-gray-50'} rounded-3xl p-6 text-center`}>
    <div className={`text-[28px] font-bold mb-1 ${accent ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
    <div className="text-[13px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
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
