import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import MarketCarServiceListing from "../models/marketCarServiceListing.model.js";
import MarketAutoTuningListing from "../models/marketAutoTuningListing.model.js";
import MarketDryCleaningListing from "../models/marketDryCleaningListing.model.js";
import MarketConsultationExpert from "../models/marketConsultationExpert.model.js";

// Single registry of marketplace listing kinds. Local copies of this list kept
// drifting apart — "parts" was missing from the admin statistics entirely, so
// the whole section disappeared from the counters and the charts.
export const MARKET_KINDS = [
  { key: "cars", Model: MarketCarListing, label: "Автомобили" },
  { key: "parts", Model: MarketPartListing, label: "Запчасти" },
  { key: "car-services", Model: MarketCarServiceListing, label: "Автосервисы" },
  { key: "auto-tuning", Model: MarketAutoTuningListing, label: "Автотюнинг" },
  { key: "dry-cleaning", Model: MarketDryCleaningListing, label: "Химчистка" },
  { key: "consultations", Model: MarketConsultationExpert, label: "Консультации" },
];

export const MARKET_KIND_KEYS = MARKET_KINDS.map((entry) => entry.key);

export const MARKET_KIND_MODELS = MARKET_KINDS.map((entry) => entry.Model);

const BY_KEY = new Map(MARKET_KINDS.map((entry) => [entry.key, entry]));

export const getMarketKind = (kind) => BY_KEY.get(String(kind || "").toLowerCase()) || null;

export const getMarketModelByKind = (kind) => getMarketKind(kind)?.Model || null;

export const getMarketKindLabel = (kind) => getMarketKind(kind)?.label || "";

export default MARKET_KINDS;
