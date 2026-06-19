import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Heart,
  List,
  LocateFixed,
  MapPin,
  MessageCircle,
  Map,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { LocationPickerMapModal, type PickedLocationResult } from '../shared/LocationPickerMapModal';

type HelpRequestStatus = 'active' | 'resolved';

interface HelpRequest {
  _id?: string;
  id?: string;
  user?: string;
  author?: string;
  time?: string;
  createdAt?: string;
  location: string;
  coordinates?: { lat: number; lng: number } | null;
  description: string;
  status: HelpRequestStatus;
}

const getRequestId = (req: HelpRequest) => String(req.id || req._id || '');

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const requestTimeLabel = (req: HelpRequest) => req.time || formatDateTime(req.createdAt) || '';

const apiFetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`.trim();
    try {
      const data = await res.json();
      if (typeof data?.message === 'string' && data.message.trim()) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
};

const buildRouteUrl = (location: string, coordinates?: { lat: number; lng: number } | null) => {
  if (coordinates?.lat && coordinates?.lng) {
    return `https://www.google.com/maps/?q=${coordinates.lat},${coordinates.lng}`;
  }
  const q = location.trim();
  if (!q) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

const ModalShell: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  const content = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-[760px] bg-white rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="text-[18px] font-black text-gray-900">{title}</div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Закрыть"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  // Render into a portal so the modal is centered relative to the viewport,
  // even if parents use transforms/animations (which can break `position: fixed`).
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

export const HelpOthersPage: React.FC = () => {
  const [view, setView] = useState<'all' | 'my-requests'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [allRequests, setAllRequests] = useState<HelpRequest[]>([]);
  const [myRequests, setMyRequests] = useState<HelpRequest[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLocation, setCreateLocation] = useState('');
  const [createCoordinates, setCreateCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [createDescription, setCreateDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingRequest, setEditingRequest] = useState<HelpRequest | null>(null);
  const [editCoordinates, setEditCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<'create' | 'edit'>('create');

  const loadAll = async () => {
    const data = await apiFetchJson<HelpRequest[]>('/api/market/help-others/requests');
    setAllRequests(Array.isArray(data) ? data : []);
  };

  const loadMine = async () => {
    const data = await apiFetchJson<HelpRequest[]>('/api/market/help-others/requests?mine=1');
    setMyRequests(Array.isArray(data) ? data : []);
  };

  const refresh = async () => {
    setIsLoading(true);
    setError('');
    try {
      await Promise.all([loadAll(), loadMine()]);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить запросы');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const activeRequests = useMemo(() => allRequests.filter((r) => r.status === 'active'), [allRequests]);
  const resolvedRequests = useMemo(() => allRequests.filter((r) => r.status === 'resolved'), [allRequests]);

  const openCreate = () => {
    setCreateError('');
    setCreateLocation('');
    setCreateCoordinates(null);
    setCreateDescription('');
    setIsCreateOpen(true);
  };

  const openMapPicker = (target: 'create' | 'edit') => {
    setMapTarget(target);
    setIsMapOpen(true);
  };

  const handleCreate = async () => {
    const location = createLocation.trim();
    const description = createDescription.trim();
    if (!location || !description) {
      setCreateError('Заполни местоположение и описание проблемы.');
      return;
    }

    setCreateLoading(true);
    setCreateError('');
    try {
      await apiFetchJson('/api/market/help-others/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ location, description, coordinates: createCoordinates }),
      });
      setIsCreateOpen(false);
      setView('my-requests');
      await refresh();
    } catch (e: any) {
      setCreateError(e?.message || 'Не удалось создать запрос');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    try {
      await apiFetchJson(`/api/market/help-others/requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refresh();
    } catch (e) {
      // ignore
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRequest) return;
    const id = getRequestId(editingRequest);
    if (!id) return;

    const location = String(editingRequest.location || '').trim();
    const description = String(editingRequest.description || '').trim();
    if (!location || !description) {
      setEditError('Заполни местоположение и описание проблемы.');
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      await apiFetchJson(`/api/market/help-others/requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ location, description, status: editingRequest.status, coordinates: editCoordinates ?? editingRequest.coordinates }),
      });
      setEditingRequest(null);
      await refresh();
    } catch (e: any) {
      setEditError(e?.message || 'Не удалось сохранить');
    } finally {
      setEditLoading(false);
    }
  };

  const fillGeoToEdit = async () => {
    if (!editingRequest) return;
    if (!navigator.geolocation) {
      setEditError('Геолокация не поддерживается вашим браузером.');
      return;
    }
    setEditError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setEditCoordinates({ lat, lng });
        setEditingRequest((prev) => (prev ? { ...prev, location: `${lat.toFixed(5)}, ${lng.toFixed(5)}` } : prev));
      },
      () => setEditError('Не удалось получить геолокацию. Введи адрес вручную.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* Hero */}
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-2xl mb-6">
          <Heart className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-[48px] font-bold text-gray-900 mb-4 font-serif">Помощь другим</h1>
        <p className="text-[18px] text-gray-600 max-w-2xl mx-auto mb-8">
          Сообщество водителей, помогающих друг другу в экстренных ситуациях
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Мне нужна помощь
          </button>
          <button
            onClick={() => setView(view === 'all' ? 'my-requests' : 'all')}
            className={[
              'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors w-full sm:w-auto',
              view === 'my-requests'
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
            ].join(' ')}
          >
            <List className="w-5 h-5" />
            {view === 'all' ? 'Мои запросы о помощи' : 'Все запросы'}
          </button>
        </div>
      </div>

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="text-center py-10 text-gray-500">Загрузка...</div>
        ) : view === 'my-requests' ? (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-gray-900" />
              <h2 className="text-[24px] font-bold text-gray-900">Мои запросы</h2>
            </div>

            {myRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-[24px] border border-gray-100 shadow-sm">
                <p className="text-gray-500 text-[16px]">У вас пока нет запросов о помощи.</p>
                <button
                  onClick={openCreate}
                  className="mt-6 inline-flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Создать запрос
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myRequests.map((request) => {
                  const id = getRequestId(request);
                  return (
                    <div key={id} className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{request.user || 'Вы'}</div>
                            <div className="text-[14px] text-gray-500">{requestTimeLabel(request)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              'text-[12px] font-bold px-3 py-1 rounded-full uppercase tracking-wider',
                              request.status === 'active' ? 'bg-red-600 text-white' : 'bg-green-100 text-green-700',
                            ].join(' ')}
                          >
                            {request.status === 'active' ? 'Активен' : 'Решен'}
                          </span>
                          <button
                            onClick={() => {
                              setEditError('');
                              setEditCoordinates(request.coordinates ?? null);
                              setEditingRequest(request);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Редактировать"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600 mb-4 text-[15px]">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        {request.location}
                      </div>

                      <p className="text-[16px] text-gray-900 font-medium">{request.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Active */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <h2 className="text-[24px] font-bold text-gray-900">Активные запросы о помощи</h2>
                <span className="bg-red-600 text-white text-[14px] font-bold px-2.5 py-0.5 rounded-full">
                  {activeRequests.length}
                </span>
              </div>

              {activeRequests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-[24px] border border-gray-100 shadow-sm text-gray-500">
                  Пока нет активных запросов.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeRequests.map((request) => {
                    const id = getRequestId(request);
                    return (
                      <div key={id} className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{request.user || 'Пользователь'}</div>
                              <div className="text-[14px] text-gray-500">{requestTimeLabel(request)}</div>
                            </div>
                          </div>
                          <span className="bg-red-600 text-white text-[12px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Активен
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600 mb-4 text-[15px]">
                          <MapPin className="w-5 h-5 text-gray-400" />
                          {request.location}
                        </div>

                        <p className="text-[16px] text-gray-900 mb-6 font-medium">{request.description}</p>

                        <div className="flex gap-3">
                          <button className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                            <MessageCircle className="w-5 h-5" />
                            Связаться
                          </button>
                          <a
                            href={buildRouteUrl(request.location, request.coordinates) || '#'}
                            target={buildRouteUrl(request.location, request.coordinates) ? '_blank' : undefined}
                            rel="noreferrer"
                            className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                            onClick={(e) => {
                              if (!buildRouteUrl(request.location, request.coordinates)) e.preventDefault();
                            }}
                          >
                            <MapPin className="w-5 h-5" />
                            Маршрут
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resolved */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <h2 className="text-[24px] font-bold text-gray-900">Решенные запросы</h2>
                <span className="bg-green-600 text-white text-[14px] font-bold px-2.5 py-0.5 rounded-full">
                  {resolvedRequests.length}
                </span>
              </div>

              {resolvedRequests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-[24px] border border-gray-100 shadow-sm text-gray-500">
                  Пока нет решенных запросов.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {resolvedRequests.map((request) => {
                    const id = getRequestId(request);
                    return (
                      <div key={id} className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{request.user || 'Пользователь'}</div>
                              <div className="text-[14px] text-gray-500">{requestTimeLabel(request)}</div>
                            </div>
                          </div>
                          <span className="bg-green-100 text-green-700 text-[12px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Решен
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600 mb-4 text-[15px]">
                          <MapPin className="w-5 h-5 text-gray-400" />
                          {request.location}
                        </div>

                        <p className="text-[16px] text-gray-900 font-medium">{request.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isCreateOpen ? (
        <ModalShell title="Создать запрос о помощи" onClose={() => setIsCreateOpen(false)}>
          {createError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
              {createError}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="block text-[14px] font-medium text-gray-700 mb-1">Местоположение</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  value={createLocation}
                  onChange={(e) => { setCreateLocation(e.target.value); setCreateCoordinates(null); }}
                  placeholder="Например: Кишинёв, Ботаника"
                  className="w-full pl-11 pr-12 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => openMapPicker('create')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Выбрать на карте"
                  aria-label="Выбрать на карте"
                >
                  <Map className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-gray-700 mb-1">Описание проблемы</label>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none min-h-[110px] resize-none transition-all text-sm"
                placeholder="Опиши, что случилось и какая помощь нужна"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                disabled={createLoading}
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
                disabled={createLoading}
              >
                {createLoading ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {editingRequest ? (
        <ModalShell title="Редактировать запрос" onClose={() => setEditingRequest(null)}>
          {editError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
              {editError}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="block text-[14px] font-medium text-gray-700 mb-1">Местоположение</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  value={editingRequest.location}
                  onChange={(e) => { setEditCoordinates(null); setEditingRequest({ ...editingRequest, location: e.target.value }); }}
                  className="w-full pl-11 pr-[88px] py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={fillGeoToEdit}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Определить мое местоположение"
                    aria-label="Определить мое местоположение"
                  >
                    <LocateFixed className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openMapPicker('edit')}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Выбрать на карте"
                    aria-label="Выбрать на карте"
                  >
                    <Map className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-gray-700 mb-1">Описание проблемы</label>
              <textarea
                value={editingRequest.description}
                onChange={(e) => setEditingRequest({ ...editingRequest, description: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none min-h-[110px] resize-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-gray-700 mb-1">Статус</label>
              <select
                value={editingRequest.status}
                onChange={(e) => setEditingRequest({ ...editingRequest, status: e.target.value as HelpRequestStatus })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all bg-white text-sm"
              >
                <option value="active">Активен</option>
                <option value="resolved">Решен</option>
              </select>
            </div>

            <button
              onClick={handleSaveEdit}
              className="w-full bg-red-600 text-white rounded-xl py-3 font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
              disabled={editLoading}
            >
              {editLoading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      <LocationPickerMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        selectedRegion={mapTarget === 'create' ? createLocation : editingRequest?.location || ''}
        title="Выберите местоположение на карте"
        onSelect={(picked: PickedLocationResult) => {
          if (mapTarget === 'create') {
            setCreateLocation(picked.label);
            setCreateCoordinates({ lat: picked.lat, lng: picked.lng });
          } else {
            setEditCoordinates({ lat: picked.lat, lng: picked.lng });
            setEditingRequest((prev) => (prev ? { ...prev, location: picked.label } : prev));
          }
        }}
      />
    </div>
  );
};
