import { useEffect, useState } from 'react';
import { API_URL } from '../utils/config';
import {
  ALL_BRANDS,
  BRANDS_AND_MODELS,
  BIKE_BRANDS,
  BIKE_MODELS,
  BUS_BRANDS,
  BUS_MODELS,
  MOTO_BRANDS,
  MOTO_MODELS,
  TRUCK_BRANDS,
  TRUCK_MODELS,
} from './mockData';

/**
 * Справочник марок и моделей приходит с сервера — он же питает мобильное
 * приложение, так что список ведётся в одном месте.
 *
 * Встроенные списки остаются запасом на случай недоступного API: селекты
 * марок не должны оказаться пустыми из-за одного неудачного запроса.
 */

export interface VehicleKindCatalog {
  brands: string[];
  models: Record<string, string[]>;
}

export interface VehicleCatalog {
  cars: VehicleKindCatalog;
  trucks: VehicleKindCatalog;
  moto: VehicleKindCatalog;
  buses: VehicleKindCatalog;
  bikes: VehicleKindCatalog;
}

export const FALLBACK_CATALOG: VehicleCatalog = {
  cars: { brands: ALL_BRANDS, models: BRANDS_AND_MODELS },
  trucks: { brands: TRUCK_BRANDS, models: TRUCK_MODELS },
  moto: { brands: MOTO_BRANDS, models: MOTO_MODELS },
  buses: { brands: BUS_BRANDS, models: BUS_MODELS },
  bikes: { brands: BIKE_BRANDS, models: BIKE_MODELS },
};

const isKind = (value: unknown): value is VehicleKindCatalog =>
  Boolean(value)
  && Array.isArray((value as VehicleKindCatalog).brands)
  && Boolean((value as VehicleKindCatalog).models);

// Ответ сервера принимаем по частям: незнакомый или битый раздел не должен
// обнулять остальные.
const merge = (data: unknown): VehicleCatalog => {
  const source = (data || {}) as Partial<VehicleCatalog>;
  const pick = (key: keyof VehicleCatalog) =>
    (isKind(source[key]) ? (source[key] as VehicleKindCatalog) : FALLBACK_CATALOG[key]);
  return {
    cars: pick('cars'),
    trucks: pick('trucks'),
    moto: pick('moto'),
    buses: pick('buses'),
    bikes: pick('bikes'),
  };
};

let cached: VehicleCatalog = FALLBACK_CATALOG;
let request: Promise<VehicleCatalog> | null = null;
const listeners = new Set<(catalog: VehicleCatalog) => void>();

export function loadVehicleCatalog(): Promise<VehicleCatalog> {
  if (!request) {
    request = fetch(`${API_URL}/market/catalog`, { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error('catalog request failed');
        return response.json();
      })
      .then((data) => {
        cached = merge(data);
        listeners.forEach((listener) => listener(cached));
        return cached;
      })
      .catch(() => {
        // Остаёмся на встроенном списке и позволяем повторить попытку позже.
        request = null;
        return cached;
      });
  }
  return request;
}

/** Текущий справочник: сперва встроенный, после загрузки — серверный. */
export function useVehicleCatalog(): VehicleCatalog {
  const [catalog, setCatalog] = useState<VehicleCatalog>(cached);

  useEffect(() => {
    let alive = true;
    const listener = (next: VehicleCatalog) => { if (alive) setCatalog(next); };
    listeners.add(listener);
    loadVehicleCatalog().then((next) => listener(next));
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  return catalog;
}
