/**
 * Определение места: точные координаты с устройства и запасной путь.
 * Нативного модуля может не быть в сборке — тогда кнопка обязана не падать,
 * а честно вернуть город по IP.
 */
const mockLocation = {
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 56.95, longitude: 24.11 } })),
  reverseGeocodeAsync: jest.fn(async () => [{ street: 'Brīvības iela', city: 'Rīga' }]),
};
jest.mock('expo-location', () => mockLocation, { virtual: true });

// Наличие нативной части проверяется опциональным запросом — он же решает,
// трогать ли expo-location вообще.
const mockNativeModule = jest.fn(() => ({}) as unknown);
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: (name: string) => mockNativeModule(),
}), { virtual: true });

const mockViewerGeo = jest.fn(async () => ({
  city: 'Кишинев', region: '', country: 'MD', lat: 47.02, lng: 28.83,
}));
jest.mock('../api/market', () => ({
  getViewerGeo: (...args: unknown[]) => mockViewerGeo(...(args as [])),
}));

import { getDeviceLocation } from '../services/deviceLocation';

beforeEach(() => {
  jest.clearAllMocks();
  mockNativeModule.mockReturnValue({});
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLocation.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 56.95, longitude: 24.11 } });
  mockLocation.reverseGeocodeAsync.mockResolvedValue([{ street: 'Brīvības iela', city: 'Rīga' }]);
});

describe('точное местоположение', () => {
  it('возвращает координаты устройства и читаемый адрес', async () => {
    const result = await getDeviceLocation();

    expect(result).toEqual({ label: 'Brīvības iela, Rīga', lat: 56.95, lng: 24.11, precise: true });
    // Город по IP не спрашиваем, когда есть точные координаты.
    expect(mockViewerGeo).not.toHaveBeenCalled();
  });

  it('без адреса отдаёт сами координаты, а не пустую строку', async () => {
    mockLocation.reverseGeocodeAsync.mockResolvedValue([]);

    const result = await getDeviceLocation();

    expect(result?.precise).toBe(true);
    expect(result?.label).toBe('56.9500, 24.1100');
  });
});

describe('запасной путь', () => {
  it('при отказе в доступе подставляет город по IP', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await getDeviceLocation();

    expect(result).toEqual({ label: 'Кишинев', lat: 47.02, lng: 28.83, precise: false });
    // Позицию не запрашиваем: разрешения нет.
    expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('без нативного модуля в сборке даже не трогает expo-location', async () => {
    jest.resetModules();
    mockNativeModule.mockReturnValue(null);
    // Модуль перечитывается: доступность запоминается при первом обращении.
    const { getDeviceLocation: fresh } = require('../services/deviceLocation');

    await expect(fresh()).resolves.toEqual({
      label: 'Кишинев', lat: 47.02, lng: 28.83, precise: false,
    });
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('ошибка нативной части не выпускается наружу', async () => {
    mockLocation.getCurrentPositionAsync.mockRejectedValue(
      new Error('The native "ExpoLocation" module could not be found'),
    );

    await expect(getDeviceLocation()).resolves.toEqual({
      label: 'Кишинев', lat: 47.02, lng: 28.83, precise: false,
    });
  });

  it('когда и город неизвестен, отдаёт null, а не выдумывает место', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockViewerGeo.mockResolvedValue({ city: '', region: '', country: null as never, lat: null as never, lng: null as never });

    await expect(getDeviceLocation()).resolves.toBeNull();
  });
});
