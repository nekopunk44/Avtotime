import GeoPlace from "../models/geoPlace.model.js";

/**
 * Названия мест → координаты, с кэшем в базе.
 *
 * Внешний геокодер (по умолчанию Nominatim) спрашивается только о том, чего
 * ещё нет в справочнике, и не больше нескольких названий за запрос: список
 * объявлений не должен ждать сеть, а публичный сервис — захлёбываться. Всё,
 * что не удалось разрешить, тоже запоминается, чтобы не спрашивать снова.
 */

const GEOCODER_URL = process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
// Nominatim требует опознаваемый User-Agent с контактом — это условие
// использования, а не вежливость.
const GEOCODER_UA = process.env.GEOCODER_USER_AGENT || "Avtotime/1.0 (support@avtotime.org)";
const GEOCODER_TIMEOUT_MS = Number(process.env.GEOCODER_TIMEOUT_MS || 4000);
// Сколько НОВЫХ названий разрешаем за один запрос списка.
const MAX_LOOKUPS_PER_CALL = Number(process.env.GEOCODER_MAX_LOOKUPS || 3);
const GEOCODER_ENABLED = process.env.GEOCODER_ENABLED !== "false";

export const normalizePlace = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Расстояние по большому кругу, км. */
export const distanceKm = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

const lookupRemote = async (query) => {
  const url = `${GEOCODER_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": GEOCODER_UA, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const first = Array.isArray(rows) ? rows[0] : null;
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: String(first.display_name || "") };
  } catch {
    // Сеть, таймаут, чужой формат — для вызывающего это просто «не знаю».
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Возвращает Map<нормализованное название, {lat, lng} | null>.
 * null означает «спрашивали, не нашли» — вызывающий отправляет такие места
 * в конец списка, а не считает расстояние нулевым.
 */
export const resolvePlaces = async (names) => {
  const keys = Array.from(new Set((names || []).map(normalizePlace).filter(Boolean)));
  const result = new Map();
  if (!keys.length) return result;

  const cached = await GeoPlace.find({ key: { $in: keys } }).lean();
  cached.forEach((place) => {
    result.set(
      place.key,
      Number.isFinite(place.lat) && Number.isFinite(place.lng)
        ? { lat: place.lat, lng: place.lng }
        : null,
    );
  });

  if (!GEOCODER_ENABLED) return result;

  const missing = keys.filter((key) => !result.has(key)).slice(0, MAX_LOOKUPS_PER_CALL);
  for (const key of missing) {
    // Последовательно, а не параллельно: у публичного геокодера предел
    // примерно один запрос в секунду.
    const found = await lookupRemote(key);
    result.set(key, found ? { lat: found.lat, lng: found.lng } : null);
    await GeoPlace.updateOne(
      { key },
      {
        $set: {
          key,
          query: key,
          displayName: found?.displayName || "",
          lat: found?.lat ?? null,
          lng: found?.lng ?? null,
          resolvedAt: new Date(),
        },
      },
      { upsert: true },
    ).catch(() => {});
  }

  return result;
};
