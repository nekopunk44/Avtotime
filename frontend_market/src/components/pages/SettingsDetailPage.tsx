import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  ChevronLeft,
  Clock3,
  Eye,
  EyeOff,
  FileClock,
  FileText,
  Lock,
  Mail,
  MapPin,
  Phone,
  Pencil,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { SettingsSectionKey } from './SettingsPage';
import { marketAPI } from '../../utils/marketAPI';
import type { AutoTuningListing, Car, CarServiceListing, ConsultationExpert, DryCleaningListing } from '../../types';

interface UserData {
  _id?: string;
  userName?: string;
  name?: string;
  profileImage?: string;
  bio?: string;
  profession?: string;
  gender?: string;
  location?: string;
  phone?: string;
  address?: string;
  region?: string;
  preferredContact?: string;
  plan?: string;
}

interface SettingsDetailPageProps {
  section: SettingsSectionKey;
  onBack: () => void;
  userData?: UserData | null;
  onUserDataChange?: (updated: Partial<UserData>) => void;
}

type ModerationStatus = 'approved' | 'pending' | 'rejected' | 'unknown';

type MyMarketListingItem = {
  key: string;
  kind: 'cars' | 'car-services' | 'auto-tuning' | 'dry-cleaning' | 'consultations';
  id: number;
  mongoId?: string;
  title: string;
  priceLabel: string;
  status: ModerationStatus;
  meta: string;
  moderationLastError?: string;
  moderationReasons?: string[];
  raw: any;
};

const formatMoneyRu = (value: number) => value.toLocaleString('ru-RU');

const getStatus = (raw: unknown): ModerationStatus => {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'approved' || value === 'pending' || value === 'rejected') return value;
  return 'unknown';
};

const statusBadge = (status: ModerationStatus) => {
  if (status === 'approved') return { label: 'Одобрено', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (status === 'pending') return { label: 'На проверке', className: 'bg-amber-50 text-amber-800 border-amber-200' };
  if (status === 'rejected') return { label: 'Отказано', className: 'bg-rose-50 text-rose-700 border-rose-200' };
  return { label: 'Статус неизвестен', className: 'bg-zinc-50 text-zinc-700 border-zinc-200' };
};

const normalizeCar = (car: Car & any): MyMarketListingItem => ({
  key: car?._id ? `cars:${car._id}` : `cars:${car.id}`,
  kind: 'cars',
  id: car.id,
  mongoId: car?._id,
  title: car.title || `${car.brand || ''} ${car.model || ''}`.trim() || `Авто #${car.id}`,
  priceLabel: car.price || 'Цена не указана',
  status: getStatus(car.moderationStatus),
  meta: `${car.location || car.region || 'Без локации'} • ${car.year || 'год не указан'}`,
  moderationLastError: typeof car.moderationLastError === 'string' ? car.moderationLastError : undefined,
  moderationReasons: Array.isArray(car.moderationReasons) ? car.moderationReasons : undefined,
  raw: car,
});

const normalizeCarService = (service: CarServiceListing & any): MyMarketListingItem => {
  const prefix = service.pricePrefix ? `${service.pricePrefix} ` : '';
  const unit = service.unit ? ` / ${service.unit}` : '';
  return {
    key: service?._id ? `car-services:${service._id}` : `car-services:${service.id}`,
    kind: 'car-services',
    id: service.id,
    mongoId: service?._id,
    title: service.title || `Автосервис #${service.id}`,
    priceLabel: `${prefix}${formatMoneyRu(Number(service.price) || 0)} RUB${unit}`,
    status: getStatus(service.moderationStatus),
    meta: `${service.location || 'Без локации'} • ${service.category || 'категория не указана'}`,
    moderationLastError: typeof service.moderationLastError === 'string' ? service.moderationLastError : undefined,
    moderationReasons: Array.isArray(service.moderationReasons) ? service.moderationReasons : undefined,
    raw: service,
  };
};

const normalizeAutoTuning = (listing: AutoTuningListing & any): MyMarketListingItem => ({
  key: listing?._id ? `auto-tuning:${listing._id}` : `auto-tuning:${listing.id}`,
  kind: 'auto-tuning',
  id: listing.id,
  mongoId: listing?._id,
  title: listing.title || `Автотюнинг #${listing.id}`,
  priceLabel: `${formatMoneyRu(Number(listing.price) || 0)} RUB`,
  status: getStatus(listing.moderationStatus),
  meta: `${listing.location || 'Без локации'} • ${listing.category || 'категория не указана'}`,
  moderationLastError: typeof listing.moderationLastError === 'string' ? listing.moderationLastError : undefined,
  moderationReasons: Array.isArray(listing.moderationReasons) ? listing.moderationReasons : undefined,
  raw: listing,
});

const normalizeDryCleaning = (listing: DryCleaningListing & any): MyMarketListingItem => ({
  key: listing?._id ? `dry-cleaning:${listing._id}` : `dry-cleaning:${listing.id}`,
  kind: 'dry-cleaning',
  id: listing.id,
  mongoId: listing?._id,
  title: listing.title || `Химчистка #${listing.id}`,
  priceLabel: `${formatMoneyRu(Number(listing.price) || 0)} RUB`,
  status: getStatus(listing.moderationStatus),
  meta: `${listing.location || 'Без локации'} • ${listing.category || 'категория не указана'}`,
  moderationLastError: typeof listing.moderationLastError === 'string' ? listing.moderationLastError : undefined,
  moderationReasons: Array.isArray(listing.moderationReasons) ? listing.moderationReasons : undefined,
  raw: listing,
});

const normalizeConsultation = (expert: ConsultationExpert & any): MyMarketListingItem => ({
  key: expert?._id ? `consultations:${expert._id}` : `consultations:${expert.id}`,
  kind: 'consultations',
  id: expert.id,
  mongoId: expert?._id,
  title: expert.name || `Консультации #${expert.id}`,
  priceLabel: `${formatMoneyRu(Number(expert.hourlyRate) || 0)} RUB / час`,
  status: getStatus(expert.moderationStatus),
  meta: `${expert.location || 'Без локации'} • ${Array.isArray(expert.specialties) && expert.specialties.length ? expert.specialties[0] : 'эксперт'}`,
  moderationLastError: typeof expert.moderationLastError === 'string' ? expert.moderationLastError : undefined,
  moderationReasons: Array.isArray(expert.moderationReasons) ? expert.moderationReasons : undefined,
  raw: expert,
});

export const SettingsDetailPage: React.FC<SettingsDetailPageProps> = ({ section, onBack, userData, onUserDataChange }) => {
  // ── Main info ────────────────────────────────────────────────────────────
  const [mainInfo, setMainInfo] = useState({
    userName: userData?.userName || '',
    displayName: userData?.name || '',
    bio: userData?.bio || '',
    profession: userData?.profession || '',
    location: userData?.location || '',
  });
  const [mainInfoSaving, setMainInfoSaving] = useState(false);
  const [mainInfoSuccess, setMainInfoSuccess] = useState('');
  const [mainInfoError, setMainInfoError] = useState('');

  // ── Personal data ────────────────────────────────────────────────────────
  const [personalData, setPersonalData] = useState({
    phone: userData?.phone || '',
    address: userData?.address || '',
    region: userData?.region || '',
    preferredContact: userData?.preferredContact || 'phone_and_messages',
  });
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalSuccess, setPersonalSuccess] = useState('');
  const [personalError, setPersonalError] = useState('');

  // ── Security ─────────────────────────────────────────────────────────────
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [logoutAllSuccess, setLogoutAllSuccess] = useState('');
  const [logoutAllError, setLogoutAllError] = useState('');

  // ── My listings ──────────────────────────────────────────────────────────
  const [myListings, setMyListings] = useState<MyMarketListingItem[]>([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [myListingsError, setMyListingsError] = useState('');
  const [editing, setEditing] = useState<MyMarketListingItem | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Sync from userData when it changes externally
  useEffect(() => {
    setMainInfo({
      userName: userData?.userName || '',
      displayName: userData?.name || '',
      bio: userData?.bio || '',
      profession: userData?.profession || '',
      location: userData?.location || '',
    });
    setPersonalData({
      phone: userData?.phone || '',
      address: userData?.address || '',
      region: userData?.region || '',
      preferredContact: userData?.preferredContact || 'phone_and_messages',
    });
  }, [userData]);

  // Load listings when section opens
  useEffect(() => {
    if (section !== 'settings-listings') return;
    let cancelled = false;
    setMyListingsLoading(true);
    setMyListingsError('');

    const safeMessage = (error: unknown) => {
      if (!error) return '';
      if (error instanceof Error) return error.message;
      return String(error);
    };

    void (async () => {
      const results = await Promise.allSettled([
        marketAPI.loadCars({ mine: true }),
        marketAPI.loadCarServices({ mine: true }),
        marketAPI.loadAutoTuning({ mine: true }),
        marketAPI.loadDryCleaning({ mine: true }),
        marketAPI.loadConsultations({ mine: true }),
      ]);
      if (cancelled) return;

      const errors: string[] = [];
      const items: MyMarketListingItem[] = [];
      const [cars, services, tunings, dryCleanings, consultations] = results;

      if (cars.status === 'fulfilled') items.push(...(Array.isArray(cars.value) ? cars.value : []).map(normalizeCar));
      else errors.push(`Авто: ${safeMessage(cars.reason) || 'ошибка загрузки'}`);
      if (services.status === 'fulfilled') items.push(...(Array.isArray(services.value) ? services.value : []).map(normalizeCarService));
      else errors.push(`Автосервис: ${safeMessage(services.reason) || 'ошибка загрузки'}`);
      if (tunings.status === 'fulfilled') items.push(...(Array.isArray(tunings.value) ? tunings.value : []).map(normalizeAutoTuning));
      else errors.push(`Автотюнинг: ${safeMessage(tunings.reason) || 'ошибка загрузки'}`);
      if (dryCleanings.status === 'fulfilled') items.push(...(Array.isArray(dryCleanings.value) ? dryCleanings.value : []).map(normalizeDryCleaning));
      else errors.push(`Химчистка: ${safeMessage(dryCleanings.reason) || 'ошибка загрузки'}`);
      if (consultations.status === 'fulfilled') items.push(...(Array.isArray(consultations.value) ? consultations.value : []).map(normalizeConsultation));
      else errors.push(`Консультации: ${safeMessage(consultations.reason) || 'ошибка загрузки'}`);

      items.sort((a, b) => b.id - a.id);
      setMyListings(items);
      if (errors.length) setMyListingsError(errors.join(' • '));
      setMyListingsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [section]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveMainInfo = useCallback(async () => {
    setMainInfoSaving(true);
    setMainInfoError('');
    setMainInfoSuccess('');
    try {
      const updated = await marketAPI.saveProfile({
        userName: mainInfo.userName,
        name: mainInfo.displayName,
        bio: mainInfo.bio,
        profession: mainInfo.profession,
        location: mainInfo.location,
      });
      onUserDataChange?.({
        userName: String(updated.userName || mainInfo.userName),
        name: String(updated.name || mainInfo.displayName),
        bio: String(updated.bio ?? mainInfo.bio),
        profession: String(updated.profession ?? mainInfo.profession),
        location: String(updated.location ?? mainInfo.location),
      });
      setMainInfoSuccess('Изменения сохранены');
    } catch (e) {
      setMainInfoError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setMainInfoSaving(false);
    }
  }, [mainInfo, onUserDataChange]);

  const handleSavePersonalData = useCallback(async () => {
    setPersonalSaving(true);
    setPersonalError('');
    setPersonalSuccess('');
    try {
      await marketAPI.saveProfile({
        phone: personalData.phone,
        address: personalData.address,
        region: personalData.region,
        preferredContact: personalData.preferredContact,
      });
      onUserDataChange?.({
        phone: personalData.phone,
        address: personalData.address,
        region: personalData.region,
        preferredContact: personalData.preferredContact,
      });
      setPersonalSuccess('Данные обновлены');
    } catch (e) {
      setPersonalError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setPersonalSaving(false);
    }
  }, [personalData, onUserDataChange]);

  const handleChangePassword = useCallback(async () => {
    setPwError('');
    setPwSuccess('');
    if (!pwForm.current || !pwForm.next) {
      setPwError('Заполните все поля');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Новые пароли не совпадают');
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError('Новый пароль должен быть не короче 8 символов');
      return;
    }
    setPwSaving(true);
    try {
      await marketAPI.changePassword(pwForm.current, pwForm.next);
      setPwSuccess('Пароль успешно изменён');
      setPwForm({ current: '', next: '', confirm: '' });
      setShowPasswordForm(false);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Ошибка смены пароля');
    } finally {
      setPwSaving(false);
    }
  }, [pwForm]);

  const handleLogoutAll = useCallback(async () => {
    setLogoutAllLoading(true);
    setLogoutAllError('');
    setLogoutAllSuccess('');
    try {
      await marketAPI.logoutAll();
      setLogoutAllSuccess('Все остальные сессии завершены');
    } catch (e) {
      setLogoutAllError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLogoutAllLoading(false);
    }
  }, []);

  const beginEdit = (item: MyMarketListingItem) => {
    const raw = item.raw || {};
    if (item.kind === 'cars') {
      setEditForm({ title: String(raw.title || item.title || ''), description: String(raw.description || '') });
    } else if (item.kind === 'consultations') {
      setEditForm({ name: String(raw.name || item.title || ''), location: String(raw.location || ''), hourlyRate: raw.hourlyRate != null ? String(raw.hourlyRate) : '' });
    } else {
      setEditForm({ title: String(raw.title || item.title || ''), category: String(raw.category || ''), location: String(raw.location || ''), price: raw.price != null ? String(raw.price) : '' });
    }
    setEditError('');
    setEditing(item);
  };

  const handleDelete = async (item: MyMarketListingItem) => {
    const mongoId = item.mongoId;
    if (!mongoId) { setMyListingsError('Не удалось удалить: отсутствует _id у объявления.'); return; }
    if (typeof window !== 'undefined') {
      if (!window.confirm('Удалить объявление? Это действие нельзя отменить.')) return;
    }
    try {
      if (item.kind === 'cars') await marketAPI.deleteCar(mongoId);
      else if (item.kind === 'car-services') await marketAPI.deleteCarService(mongoId);
      else if (item.kind === 'auto-tuning') await marketAPI.deleteAutoTuning(mongoId);
      else if (item.kind === 'dry-cleaning') await marketAPI.deleteDryCleaning(mongoId);
      else await marketAPI.deleteConsultation(mongoId);
      setMyListings((prev) => prev.filter((x) => x.key !== item.key));
    } catch (error) {
      setMyListingsError(error instanceof Error ? error.message : String(error || 'Ошибка удаления'));
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const mongoId = editing.mongoId;
    if (!mongoId) { setEditError('Не удалось сохранить: отсутствует _id у объявления.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      let updated: any = null;
      if (editing.kind === 'cars') updated = await marketAPI.updateCar(mongoId, { title: editForm.title || '', description: editForm.description || '' });
      else if (editing.kind === 'consultations') updated = await marketAPI.updateConsultation(mongoId, { name: editForm.name || '', location: editForm.location || '', hourlyRate: editForm.hourlyRate || '' });
      else if (editing.kind === 'car-services') updated = await marketAPI.updateCarService(mongoId, { title: editForm.title || '', category: editForm.category || '', location: editForm.location || '', price: editForm.price || '' });
      else if (editing.kind === 'auto-tuning') updated = await marketAPI.updateAutoTuning(mongoId, { title: editForm.title || '', category: editForm.category || '', location: editForm.location || '', price: editForm.price || '' });
      else if (editing.kind === 'dry-cleaning') updated = await marketAPI.updateDryCleaning(mongoId, { title: editForm.title || '', category: editForm.category || '', location: editForm.location || '', price: editForm.price || '' });

      const normalized =
        editing.kind === 'cars' ? normalizeCar(updated)
        : editing.kind === 'car-services' ? normalizeCarService(updated)
        : editing.kind === 'auto-tuning' ? normalizeAutoTuning(updated)
        : editing.kind === 'dry-cleaning' ? normalizeDryCleaning(updated)
        : normalizeConsultation(updated);

      setMyListings((prev) => prev.map((x) => (x.key === editing.key ? normalized : x)));
      setEditing(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : String(error || 'Ошибка сохранения'));
    } finally {
      setEditSaving(false);
    }
  };

  const content = useMemo(() => {
    switch (section) {
      case 'settings-main-info': return { icon: Settings2, title: 'Основная информация', description: 'Имя профиля, фото, короткое описание и публичное отображение аккаунта.' };
      case 'settings-personal-data': return { icon: UserRound, title: 'Личные данные', description: 'Контакты, адрес, регион и данные для связи с покупателями и клиентами.' };
      case 'settings-security': return { icon: Lock, title: 'Безопасность', description: 'Пароль, двухэтапная защита, устройства входа и контроль сессий.' };
      case 'settings-listings': return { icon: FileText, title: 'Мои объявления', description: 'Управление активными и архивными объявлениями в одном месте.' };
      default: return { icon: Settings2, title: 'Настройки', description: 'Параметры аккаунта.' };
    }
  }, [section]);

  const Icon = content.icon;

  return (
    <section className="bg-[#f6f6f6] py-6 sm:py-14">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-red-600 transition-colors mb-1">
          <ChevronLeft className="w-4 h-4" />
          Назад к настройкам
        </button>

        <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] sm:rounded-[32px] bg-white border border-zinc-200 p-4 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="inline-flex rounded-2xl p-3 bg-red-50 text-red-600"><Icon className="w-5 h-5" /></div>
            <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-gray-950">{content.title}</h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">{content.description}</p>

            {/* ── Основная информация ─────────────────────────────────── */}
            {section === 'settings-main-info' && (
              <div className="mt-8 space-y-6">
                <div className="grid gap-4 sm:gap-6 sm:grid-cols-[200px_1fr]">
                  <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-6 flex flex-col items-center text-center">
                    {userData?.profileImage ? (
                      <img src={userData.profileImage} alt={mainInfo.userName} className="w-24 h-24 rounded-full object-cover border border-zinc-200" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#7B61FF] via-[#E9546B] to-[#FFB457] text-white flex items-center justify-center text-3xl font-black uppercase">
                        {mainInfo.userName[0] || '?'}
                      </div>
                    )}
                    <p className="mt-3 text-xs text-gray-500">Фото меняется в основном приложении AVTOTIME.</p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Username"><input value={mainInfo.userName} onChange={(e) => setMainInfo((p) => ({ ...p, userName: e.target.value }))} className={inputCls} /></Field>
                    <Field label="Отображаемое имя"><input value={mainInfo.displayName} onChange={(e) => setMainInfo((p) => ({ ...p, displayName: e.target.value }))} className={inputCls} /></Field>
                    <Field label="Профессия"><input value={mainInfo.profession} onChange={(e) => setMainInfo((p) => ({ ...p, profession: e.target.value }))} className={inputCls} /></Field>
                    <Field label="Город"><input value={mainInfo.location} onChange={(e) => setMainInfo((p) => ({ ...p, location: e.target.value }))} className={inputCls} /></Field>
                  </div>
                </div>

                <Field label="Короткое описание">
                  <textarea value={mainInfo.bio} onChange={(e) => setMainInfo((p) => ({ ...p, bio: e.target.value }))} className={`${inputCls} h-28 resize-none`} />
                </Field>

                {mainInfoError && <Alert type="error">{mainInfoError}</Alert>}
                {mainInfoSuccess && <Alert type="success">{mainInfoSuccess}</Alert>}

                <button onClick={handleSaveMainInfo} disabled={mainInfoSaving} className={btnPrimary}>
                  {mainInfoSaving ? 'Сохранение…' : 'Сохранить изменения'}
                </button>
              </div>
            )}

            {/* ── Личные данные ────────────────────────────────────────── */}
            {section === 'settings-personal-data' && (
              <div className="mt-8 space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Телефон">
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={personalData.phone} onChange={(e) => setPersonalData((p) => ({ ...p, phone: e.target.value }))} placeholder="+7 (000) 000-00-00" className={`${inputCls} pl-11`} />
                    </div>
                  </Field>
                  <Field label="Email">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={userData?.userName ? `(меняется через восстановление пароля)` : ''} disabled className={`${inputCls} pl-11 opacity-50`} />
                    </div>
                  </Field>
                  <Field label="Регион">
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={personalData.region} onChange={(e) => setPersonalData((p) => ({ ...p, region: e.target.value }))} className={`${inputCls} pl-11`} />
                    </div>
                  </Field>
                  <Field label="Предпочитаемый способ связи">
                    <select value={personalData.preferredContact} onChange={(e) => setPersonalData((p) => ({ ...p, preferredContact: e.target.value }))} className={inputCls}>
                      <option value="phone_and_messages">Телефон и сообщения</option>
                      <option value="messages_only">Только сообщения</option>
                      <option value="email">Email</option>
                    </select>
                  </Field>
                </div>

                <Field label="Адрес">
                  <input value={personalData.address} onChange={(e) => setPersonalData((p) => ({ ...p, address: e.target.value }))} className={inputCls} />
                </Field>

                {personalError && <Alert type="error">{personalError}</Alert>}
                {personalSuccess && <Alert type="success">{personalSuccess}</Alert>}

                <button onClick={handleSavePersonalData} disabled={personalSaving} className={btnPrimary}>
                  {personalSaving ? 'Сохранение…' : 'Обновить данные'}
                </button>
              </div>
            )}

            {/* ── Безопасность ─────────────────────────────────────────── */}
            {section === 'settings-security' && (
              <div className="mt-8 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Пароль */}
                  <article className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-red-600" />
                      <div className="text-lg font-black text-gray-950">Пароль</div>
                    </div>
                    {!showPasswordForm ? (
                      <button onClick={() => { setShowPasswordForm(true); setPwError(''); setPwSuccess(''); }} className={`mt-4 ${btnPrimary}`}>
                        Изменить пароль
                      </button>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <input type="password" placeholder="Текущий пароль" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} className={inputCls} />
                        <input type="password" placeholder="Новый пароль (мин. 8 символов)" value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} className={inputCls} />
                        <input type="password" placeholder="Повторите новый пароль" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} className={inputCls} />
                        {pwError && <Alert type="error">{pwError}</Alert>}
                        {pwSuccess && <Alert type="success">{pwSuccess}</Alert>}
                        <div className="flex gap-2">
                          <button onClick={handleChangePassword} disabled={pwSaving} className={btnPrimary}>{pwSaving ? 'Сохранение…' : 'Сохранить'}</button>
                          <button onClick={() => setShowPasswordForm(false)} className={btnSecondary}>Отмена</button>
                        </div>
                      </div>
                    )}
                  </article>

                  {/* 2FA — визуальный элемент */}
                  <article className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                    <div className="flex items-center gap-3">
                      <Eye className="w-5 h-5 text-emerald-600" />
                      <div className="text-lg font-black text-gray-950">Двухэтапная защита</div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">Двухфакторная аутентификация будет доступна в следующем обновлении.</p>
                  </article>
                </div>

                {/* Сессии */}
                <article className="rounded-[24px] sm:rounded-[28px] border border-zinc-200 bg-white p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-lg font-black text-gray-950">Управление сессиями</div>
                      <div className="text-sm text-gray-500">Завершить все активные сессии на других устройствах</div>
                    </div>
                  </div>
                  {logoutAllError && <Alert type="error">{logoutAllError}</Alert>}
                  {logoutAllSuccess && <Alert type="success">{logoutAllSuccess}</Alert>}
                  <div className="mt-5">
                    <button onClick={handleLogoutAll} disabled={logoutAllLoading} className={btnPrimary}>
                      {logoutAllLoading ? 'Завершение…' : 'Завершить все другие сессии'}
                    </button>
                  </div>
                </article>
              </div>
            )}

            {/* ── Мои объявления ───────────────────────────────────────── */}
            {section === 'settings-listings' && (
              <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
                {myListingsError && <Alert type="error">{myListingsError}</Alert>}

                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <StatsCard title="Одобрено" value={String(myListings.filter((l) => l.status === 'approved').length)} icon={BadgeCheck} accent="text-emerald-700 bg-emerald-50" />
                  <StatsCard title="Проверка" value={String(myListings.filter((l) => l.status === 'pending').length)} icon={Clock3} accent="text-amber-800 bg-amber-50" />
                  <StatsCard title="Отказано" value={String(myListings.filter((l) => l.status === 'rejected').length)} icon={FileClock} accent="text-rose-700 bg-rose-50" />
                </div>

                {myListingsLoading ? (
                  <article className="rounded-[28px] border border-zinc-200 bg-white p-6">
                    <div className="text-base font-bold text-gray-900">Загрузка объявлений…</div>
                  </article>
                ) : myListings.length === 0 ? (
                  <article className="rounded-[24px] sm:rounded-[28px] border border-zinc-200 bg-white p-8 text-center">
                    <div className="text-lg font-black text-gray-950 mb-2">Объявлений пока нет</div>
                    <div className="text-sm text-gray-500">Ваши объявления из всех категорий появятся здесь.</div>
                  </article>
                ) : (
                  <>
                    {myListings.filter((l) => l.status === 'pending').length > 0 && (
                      <ListingsBlock title="На проверке" items={myListings.filter((l) => l.status === 'pending')} onEdit={beginEdit} onDelete={handleDelete} />
                    )}
                    {myListings.filter((l) => l.status === 'approved').length > 0 && (
                      <ListingsBlock title="Одобрено" items={myListings.filter((l) => l.status === 'approved')} onEdit={beginEdit} onDelete={handleDelete} />
                    )}
                    {myListings.filter((l) => l.status === 'rejected').length > 0 && (
                      <ListingsBlock title="Отказано" items={myListings.filter((l) => l.status === 'rejected')} onEdit={beginEdit} onDelete={handleDelete} />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Правая колонка ──────────────────────────────────────────── */}
          <div className="hidden lg:block space-y-6">
            <div className="rounded-[32px] bg-black text-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
              <div className="text-xs uppercase tracking-[0.22em] text-white/50 font-bold">Раздел настроек</div>
              <div className="mt-3 text-3xl font-black">{content.title}</div>
              <div className="mt-3 text-sm text-white/70 leading-6">{content.description}</div>
            </div>

            <div className="rounded-[32px] bg-white border border-zinc-200 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-bold">Подсказка</div>
              <div className="mt-3 text-lg font-black text-gray-950">Что можно сделать здесь</div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
                {section === 'settings-main-info' && (<><li>Обновить имя профиля и отображаемое имя.</li><li>Изменить описание и профессию.</li><li>Указать город.</li></>)}
                {section === 'settings-personal-data' && (<><li>Добавить телефон для связи с покупателями.</li><li>Обновить регион и адрес.</li><li>Выбрать удобный способ связи.</li></>)}
                {section === 'settings-security' && (<><li>Изменить пароль от аккаунта.</li><li>Завершить сессии на других устройствах.</li></>)}
                {section === 'settings-listings' && (<><li>Следить за статусом модерации.</li><li>Редактировать и удалять объявления.</li></>)}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Модальное окно редактирования ───────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[720px] rounded-[28px] bg-white border border-zinc-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-gray-400 font-bold">Редактирование</div>
                <div className="mt-1 text-xl font-black text-gray-950">{editing.title}</div>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 rounded-full hover:bg-zinc-100 text-gray-500" aria-label="Закрыть"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-6 space-y-4">
              {editError && <Alert type="error">{editError}</Alert>}

              {editing.kind === 'cars' && (
                <>
                  <Field label="Название"><input value={editForm.title || ''} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} className={inputCls} /></Field>
                  <Field label="Описание"><textarea value={editForm.description || ''} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} className={`${inputCls} h-28 resize-none`} /></Field>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">После редактирования объявление может снова уйти на модерацию.</div>
                </>
              )}

              {editing.kind !== 'cars' && editing.kind !== 'consultations' && (
                <>
                  <Field label="Название"><input value={editForm.title || ''} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} className={inputCls} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Категория"><input value={editForm.category || ''} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} className={inputCls} /></Field>
                    <Field label="Локация"><input value={editForm.location || ''} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} className={inputCls} /></Field>
                  </div>
                  <Field label="Цена (RUB)"><input inputMode="numeric" value={editForm.price || ''} onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))} className={inputCls} /></Field>
                </>
              )}

              {editing.kind === 'consultations' && (
                <>
                  <Field label="Имя"><input value={editForm.name || ''} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Локация"><input value={editForm.location || ''} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} className={inputCls} /></Field>
                    <Field label="Ставка (RUB/час)"><input inputMode="numeric" value={editForm.hourlyRate || ''} onChange={(e) => setEditForm((p) => ({ ...p, hourlyRate: e.target.value }))} className={inputCls} /></Field>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-zinc-200 bg-zinc-50">
              <button onClick={() => setEditing(null)} className={btnSecondary} disabled={editSaving}>Отмена</button>
              <button onClick={handleSaveEdit} className={`${btnPrimary} inline-flex items-center gap-2`} disabled={editSaving}>
                <Pencil className="w-4 h-4" />
                {editSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// ── Shared styles ──────────────────────────────────────────────────────────
const inputCls = 'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500';
const btnPrimary = 'rounded-full bg-black text-white px-6 py-3 text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50';
const btnSecondary = 'rounded-full border border-zinc-300 bg-white text-gray-900 px-5 py-3 text-sm font-bold hover:bg-zinc-100 transition-colors disabled:opacity-50';

// ── Sub-components ─────────────────────────────────────────────────────────
const Alert: React.FC<{ type: 'error' | 'success'; children: React.ReactNode }> = ({ type, children }) => (
  <div className={`rounded-2xl border px-4 py-3 text-sm ${type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
    {children}
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-bold text-gray-900 mb-2">{label}</label>
    {children}
  </div>
);

const StatsCard: React.FC<{ title: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = ({ title, value, icon: Icon, accent }) => (
  <article className="rounded-[20px] sm:rounded-[24px] border border-zinc-200 bg-white p-3 sm:p-5">
    <div className={`inline-flex rounded-xl sm:rounded-2xl p-2 sm:p-3 ${accent}`}><Icon className="w-4 h-4 sm:w-5 sm:h-5" /></div>
    <div className="mt-2 sm:mt-4 text-xs sm:text-sm font-semibold text-gray-500 leading-tight">{title}</div>
    <div className="mt-1 text-2xl sm:text-3xl font-black text-gray-950">{value}</div>
  </article>
);

const ListingsBlock: React.FC<{ title: string; items: MyMarketListingItem[]; onEdit: (item: MyMarketListingItem) => void; onDelete: (item: MyMarketListingItem) => void }> = ({ title, items, onEdit, onDelete }) => (
  <article className="rounded-[24px] sm:rounded-[28px] border border-zinc-200 bg-white p-4 sm:p-6">
    <div className="text-xl font-black text-gray-950">{title}</div>
    <div className="mt-4 space-y-3">
      {items.length === 0 && <div className="text-sm text-gray-500">Нет объявлений.</div>}
      {items.map((item) => {
        const badge = statusBadge(item.status);
        const kindLabel = item.kind === 'cars' ? 'Авто' : item.kind === 'car-services' ? 'Автосервис' : item.kind === 'auto-tuning' ? 'Автотюнинг' : item.kind === 'dry-cleaning' ? 'Химчистка' : 'Консультации';
        return (
          <div key={item.key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-base font-black text-gray-950">{item.title}</div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold ${badge.className}`}>{badge.label}</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-zinc-200 bg-white text-xs font-bold text-gray-700">{kindLabel}</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-700">{item.priceLabel}</div>
                <div className="mt-2 text-sm text-gray-500">{item.meta}</div>
                {item.status === 'rejected' && (
                  <div className="mt-2 text-sm text-rose-700">
                    {item.moderationReasons?.length ? `Причины: ${item.moderationReasons.join(', ')}` : 'Отклонено модерацией.'}
                    {item.moderationLastError ? ` • ${item.moderationLastError}` : ''}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => onEdit(item)} className="rounded-full border border-zinc-300 bg-white p-2 sm:px-4 sm:py-2 text-xs font-bold text-gray-900 hover:bg-zinc-100 inline-flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  <span className="hidden sm:inline">Редактировать</span>
                </button>
                <button onClick={() => onDelete(item)} className="rounded-full border border-rose-200 bg-rose-50 p-2 sm:px-4 sm:py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 inline-flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Удалить</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </article>
);
