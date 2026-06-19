import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, LocateFixed, MapPin, Navigation, X } from 'lucide-react';

interface PickedLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface PickedLocationResult {
  label: string;
  lat: number;
  lng: number;
}

interface LocationPickerMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: PickedLocationResult) => void;
  selectedRegion?: string;
  title?: string;
}

const DEFAULT_CENTER: [number, number] = [28.8638, 47.0105];
const DEFAULT_ZOOM = 7;
const FOCUSED_ZOOM = 11;

const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
} as const;

function extractAddressLabel(data: any, lat: number, lng: number) {
  const address = data?.address ?? {};
  const parts: string[] = [];

  if (address.road) {
    parts.push(address.road + (address.house_number ? ` ${address.house_number}` : ''));
  } else if (address.pedestrian || address.path || address.footway) {
    parts.push(address.pedestrian || address.path || address.footway);
  }

  const city = address.city || address.town || address.village || address.municipality || address.county;
  if (city) parts.push(city);

  if (parts.length > 0) return parts.join(', ');

  return data?.display_name?.split(',')?.[0] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

async function reverseGeocode(lat: number, lng: number) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ru`,
  );

  if (!response.ok) {
    throw new Error('Не удалось получить адрес');
  }

  const data = await response.json();
  return extractAddressLabel(data, lat, lng);
}

function createMarkerElement() {
  const marker = document.createElement('div');
  marker.className = 'h-5 w-5 rounded-full border-4 border-white bg-red-600 shadow-[0_10px_24px_rgba(0,0,0,0.18)]';
  return marker;
}

export function LocationPickerMapModal({
  isOpen,
  onClose,
  onSelect,
  selectedRegion = '',
  title = 'Выберите регион на карте',
}: LocationPickerMapModalProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const animationFrameIdsRef = useRef<number[]>([]);
  const mapLibreRef = useRef<any>(null);

  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMapLibraryLoading, setIsMapLibraryLoading] = useState(false);

  const clearResizeQueue = () => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];

    animationFrameIdsRef.current.forEach((frameId) => window.cancelAnimationFrame(frameId));
    animationFrameIdsRef.current = [];
  };

  const scheduleResize = () => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    clearResizeQueue();

    const resize = () => {
      map.resize();
    };

    resize();

    animationFrameIdsRef.current.push(window.requestAnimationFrame(resize));
    animationFrameIdsRef.current.push(
      window.requestAnimationFrame(() => {
        animationFrameIdsRef.current.push(window.requestAnimationFrame(resize));
      }),
    );

    timeoutIdsRef.current.push(window.setTimeout(resize, 120));
    timeoutIdsRef.current.push(window.setTimeout(resize, 260));
    timeoutIdsRef.current.push(window.setTimeout(resize, 420));
  };

  const effectiveLabel = pickedLocation?.label || selectedRegion || 'Нажмите на карту, чтобы выбрать регион';

  const handleMapPick = async (lat: number, lng: number) => {
    setErrorMessage('');
    setIsResolvingLocation(true);

    try {
      const label = await reverseGeocode(lat, lng);
      setPickedLocation({ lat, lng, label });
    } catch {
      setPickedLocation({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      setErrorMessage('Не удалось определить название региона, но точка выбрана.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !mapElementRef.current || mapRef.current) {
      return;
    }

    let cancelled = false;

    const initializeMap = async () => {
      setIsMapLibraryLoading(true);

      try {
        const mapLibre = await import('maplibre-gl');

        if (cancelled || !mapElementRef.current) {
          return;
        }

        mapLibreRef.current = mapLibre;

        const map = new mapLibre.Map({
          container: mapElementRef.current,
          style: MAP_STYLE as any,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
        });

        map.addControl(new mapLibre.NavigationControl({ visualizePitch: false }), 'top-right');

        map.on('load', () => {
          scheduleResize();
        });

        map.on('click', (event: any) => {
          void handleMapPick(event.lngLat.lat, event.lngLat.lng);
        });

        mapRef.current = map;
        scheduleResize();

        if (mapShellRef.current && typeof ResizeObserver !== 'undefined') {
          resizeObserverRef.current = new ResizeObserver(() => {
            scheduleResize();
          });
          resizeObserverRef.current.observe(mapShellRef.current);
        }
      } finally {
        if (!cancelled) {
          setIsMapLibraryLoading(false);
        }
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      clearResizeQueue();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mapRef.current) {
      return;
    }

    scheduleResize();
  }, [isOpen]);

  useEffect(() => {
    if (!mapRef.current || !pickedLocation) {
      return;
    }

    const map = mapRef.current;
    const lngLat: [number, number] = [pickedLocation.lng, pickedLocation.lat];
    const mapLibre = mapLibreRef.current;

    if (!mapLibre) {
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new mapLibre.Marker({ element: createMarkerElement(), anchor: 'center' }).setLngLat(lngLat).addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
    }

    map.flyTo({ center: lngLat, zoom: FOCUSED_ZOOM, duration: 800 });
    scheduleResize();
  }, [pickedLocation]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Геолокация не поддерживается в этом браузере.');
      return;
    }

    setErrorMessage('');
    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsDetectingLocation(false);
        await handleMapPick(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setIsDetectingLocation(false);
        setErrorMessage('Не удалось получить доступ к геолокации.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleConfirm = () => {
    if (pickedLocation?.label) {
      onSelect({ label: pickedLocation.label, lat: pickedLocation.lat, lng: pickedLocation.lng });
      onClose();
      return;
    }

    if (selectedRegion) {
      setErrorMessage('Сначала выберите точку на карте.');
      return;
    }

    setErrorMessage('Сначала выберите точку на карте.');
  };

  if (!isOpen) {
    return null;
  }

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl animate-in fade-in duration-200">
        <div className="relative flex items-center justify-center p-6 pb-4">
          <h3 className="text-center text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="absolute right-6 rounded-full p-2 transition-colors hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-2 md:px-7 md:pb-7">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[52px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 sm:min-w-[330px]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-red-600/10 p-2 text-red-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Выбрано</p>
                  <p className="text-sm font-semibold text-gray-900">{effectiveLabel}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleUseMyLocation}
              disabled={isDetectingLocation}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-900 disabled:cursor-wait disabled:opacity-70"
            >
              {isDetectingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Определить мою геолокацию
            </button>
          </div>

          <div ref={mapShellRef} className="overflow-hidden rounded-[28px] border border-gray-200">
            <div ref={mapElementRef} className="relative h-[360px] w-full bg-gray-100 md:h-[380px]">
              {isMapLibraryLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm font-semibold text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Загрузка карты...
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p>Нажмите на карту, чтобы выбрать точное местоположение. Адрес определяется автоматически. Можно также использовать геолокацию браузера.</p>
          </div>

          {errorMessage && <p className="mt-3 text-sm font-medium text-red-600">{errorMessage}</p>}

          <div className="mt-6 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={onClose}
              className="min-w-[160px] rounded-2xl px-5 py-3 text-center text-sm font-bold text-gray-600 transition-colors hover:bg-gray-100"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={isResolvingLocation || isDetectingLocation}
              className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-70"
            >
              {isResolvingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Подтвердить выбор
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
