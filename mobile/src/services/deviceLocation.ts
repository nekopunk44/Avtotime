import { Platform } from 'react-native';
import { getViewerGeo } from '../api/market';

/**
 * Где находится пользователь.
 *
 * Точное положение даёт expo-location — нативный модуль: в сборке, сделанной
 * до его появления, его нет, и обращение бросит. Поэтому загрузка ленивая и
 * под защитой, а при неудаче остаётся запасной путь — город по IP с сервера.
 * Так кнопка работает в любой сборке, просто с разной точностью.
 */

type LocationModule = typeof import('expo-location');

export interface DeviceLocation {
  /** Читаемый адрес: улица и город, если их удалось получить. */
  label: string;
  lat: number | null;
  lng: number | null;
  /** true — координаты с устройства, false — приблизительный город по IP. */
  precise: boolean;
}

let cached: LocationModule | null | undefined;

/**
 * Есть ли нативная часть в этой сборке. Спрашиваем именно так: обычное
 * обращение к отсутствующему нативному модулю бросает «Cannot find native
 * module 'ExpoLocation'» и попадает в лог красной ошибкой, даже если её
 * поймать. Опциональный запрос возвращает null молча.
 */
const hasNativeLocation = (): boolean => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const core = require('expo-modules-core') as {
      requireOptionalNativeModule?: (name: string) => unknown;
    };
    if (typeof core?.requireOptionalNativeModule !== 'function') return false;
    return core.requireOptionalNativeModule('ExpoLocation') != null;
  } catch {
    return false;
  }
};

const loadLocation = (): LocationModule | null => {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    cached = null;
    return null;
  }
  if (!hasNativeLocation()) {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-location') as LocationModule;
    cached = typeof mod?.getCurrentPositionAsync === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
};

/** Собираем адрес из того, что вернул обратный геокодер, без пустых кусков. */
const addressOf = (place: { street?: string | null; name?: string | null; city?: string | null; district?: string | null; region?: string | null }) => {
  const street = place.street || place.name || '';
  const city = place.city || place.district || place.region || '';
  return [street, city].filter(Boolean).join(', ');
};

const cityFallback = async (): Promise<DeviceLocation | null> => {
  try {
    const geo = await getViewerGeo();
    if (!geo.city) return null;
    return { label: geo.city, lat: geo.lat, lng: geo.lng, precise: false };
  } catch {
    return null;
  }
};

/**
 * Точное положение устройства; при отказе в доступе, отсутствии модуля или
 * ошибке — город по IP. null означает, что не вышло вообще ничего.
 */
export async function getDeviceLocation(): Promise<DeviceLocation | null> {
  const location = loadLocation();
  if (!location) return cityFallback();

  try {
    const { status } = await location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return cityFallback();

    const position = await location.getCurrentPositionAsync({
      accuracy: location.Accuracy.Balanced,
    });
    const { latitude, longitude } = position.coords;

    // Адрес — приятное дополнение: без него остаются координаты, и это уже
    // точнее города.
    let label = '';
    try {
      const [place] = await location.reverseGeocodeAsync({ latitude, longitude });
      if (place) label = addressOf(place);
    } catch {
      label = '';
    }

    return {
      label: label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      lat: latitude,
      lng: longitude,
      precise: true,
    };
  } catch {
    return cityFallback();
  }
}
