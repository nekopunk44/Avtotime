import mongoose from "mongoose";

/**
 * Координаты населённого пункта по его названию. Объявления хранят место
 * строкой, поэтому расстояние считается через этот справочник — он же кэш
 * геокодера: внешний сервис спрашивается один раз на название, дальше ответ
 * берётся отсюда.
 *
 * Ненайденное место тоже запоминается (lat/lng = null): иначе каждый показ
 * списка снова дёргал бы геокодер за заведомо безнадёжной строкой.
 */
const geoPlaceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    query: { type: String, default: "" },
    displayName: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    resolvedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const GeoPlace = mongoose.model("GeoPlace", geoPlaceSchema);

export default GeoPlace;
