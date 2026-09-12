import geoip from "geoip-lite";
import User from "../models/user.model.js";
import MarketDryCleaningListing from "../models/marketDryCleaningListing.model.js";
import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import MarketGame from "../models/marketGame.model.js";
import MarketEcoTip from "../models/marketEcoTip.model.js";
import MarketHelpRequest from "../models/marketHelpRequest.model.js";
import MarketCompareState from "../models/marketCompareState.model.js";
import MarketKidsActivity from "../models/marketKidsActivity.model.js";
import { getAiModerationProvider, isAiModerationEnabled } from "../services/aiModeration.js";
import {
  getCachedMarketList,
  invalidateMarketListCache,
  setCachedMarketList,
} from "../services/marketListCache.js";
import {
  getCachedResponse,
  invalidateCachedResponse,
  setCachedResponse,
} from "../services/responseCache.js";
import { enqueueMarketModerationById } from "../moderation/marketModerationWorker.js";
import { buildPublicFileUrl } from "../config/publicFiles.js";
import { distanceKm, normalizePlace, resolvePlaces } from "../services/geocode.js";
import { catalogBrands, catalogModels, isRealName } from "../config/vehicleCatalog.js";

const buildId = () => Date.now() + Math.floor(Math.random() * 1000);

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const moderationApprovedFilter = {
  $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }],
};

const parseListQueryOptions = (req, { mine }) => {
  const defaultLimit = mine ? 200 : 60;
  const maxLimit = mine ? 500 : 120;
  const rawPage = Number.parseInt(String(req.query?.page || "1"), 10);
  const rawLimit = Number.parseInt(String(req.query?.limit || defaultLimit), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Где находится смотрящий — по IP. Точность городская, но объявления и сами
 * хранят только название города, так что большего от неё и не нужно.
 * Пустой ответ — нормальный исход (серый IP, отсутствие города в базе):
 * приложение просто не предложит сортировку по близости.
 */
export const getViewerGeo = (req, res) => {
  const geo = geoip.lookup(req.ip || "");
  return res.status(200).json({
    city: geo?.city || "",
    region: geo?.region || "",
    country: geo?.country || null,
    lat: Array.isArray(geo?.ll) ? geo.ll[0] : null,
    lng: Array.isArray(geo?.ll) ? geo.ll[1] : null,
  });
};

/**
 * Расстояния от точки до перечисленных мест, км. Приложение шлёт сюда города
 * из выдачи и раскладывает объявления по близости; всё, что геокодер не знает,
 * возвращается как null и уходит в конец списка.
 */
export const getPlaceDistances = async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Нужны координаты точки отсчёта" });
    }

    const places = Array.isArray(req.body?.places) ? req.body.places.slice(0, 60) : [];
    const resolved = await resolvePlaces(places);

    const distances = {};
    places.forEach((place) => {
      const key = normalizePlace(place);
      if (!key || key in distances) return;
      const point = resolved.get(key);
      distances[key] = point ? Math.round(distanceKm({ lat, lng }, point)) : null;
    });

    return res.status(200).json({ distances });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDistinctBrands = async (req, res) => {
  try {
    const type = typeof req.query?.type === "string" ? req.query.type.trim().toLowerCase() : "";
    const cacheKey = `brands:${type || "all"}`;
    const cached = await getCachedResponse("market-meta", cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const [carBrands, partBrands] = await Promise.all([
      type && type !== "cars" ? Promise.resolve([]) : MarketCarListing.distinct("brand"),
      type && type !== "parts" ? Promise.resolve([]) : MarketPartListing.distinct("brand"),
    ]);

    // Справочник + то, что реально встречается в объявлениях: подсказка должна
    // работать и в пустом маркете, но не терять марку, которую вписали руками.
    const normalized = Array.from(
      new Set([...catalogBrands(), ...(carBrands || []), ...(partBrands || [])]),
    )
      .map((brand) => (typeof brand === "string" ? brand.trim() : ""))
      .filter(isRealName)
      .sort((a, b) => a.localeCompare(b, "ru"));

    await setCachedResponse("market-meta", cacheKey, normalized);
    return res.status(200).json(normalized);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDistinctModels = async (req, res) => {
  try {
    const brand = typeof req.query?.brand === "string" ? req.query.brand.trim() : "";
    const type = typeof req.query?.type === "string" ? req.query.type.trim().toLowerCase() : "";
    const cacheKey = `models:${type || "all"}:${brand || "all"}`;
    const cached = await getCachedResponse("market-meta", cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const filter = brand ? { brand: new RegExp(`^${escapeRegExp(brand)}$`, "i") } : {};

    const [carModels, partModels] = await Promise.all([
      type && type !== "cars" ? Promise.resolve([]) : MarketCarListing.distinct("model", filter),
      type && type !== "parts" ? Promise.resolve([]) : MarketPartListing.distinct("model", filter),
    ]);

    // Без марки отдаём все модели справочника: пользователь может искать по
    // одному названию модели, не выбирая марку.
    const normalized = Array.from(
      new Set([...catalogModels(brand), ...(carModels || []), ...(partModels || [])]),
    )
      .map((model) => (typeof model === "string" ? model.trim() : ""))
      .filter(isRealName)
      .sort((a, b) => a.localeCompare(b, "ru"));

    const payload = { models: normalized };
    await setCachedResponse("market-meta", cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const isBlobUrl = (value) => typeof value === "string" && value.startsWith("blob:");

const parseArrayField = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const getCurrentUserName = async (userId) => {
  const user = await User.findById(userId).select("userName");
  return user?.userName?.trim() || "";
};

const hasFilters = (query) => {
  const skip = new Set(["mine", "page", "limit"]);
  return Object.keys(query).some((k) => !skip.has(k) && query[k] != null && String(query[k]).trim() !== "");
};

export const getDryCleaningListings = async (req, res) => {
  try {
    const mine = String(req.query?.mine || "").toLowerCase();
    const isMine = mine === "1" || mine === "true";
    const baseFilter = isMine ? { author: req.userId } : moderationApprovedFilter;
    const filtered = hasFilters(req.query);
    const clauses = [baseFilter];
    if (req.query.q) {
      const re = new RegExp(escapeRegExp(req.query.q), "i");
      clauses.push({ $or: [{ title: re }, { category: re }, { location: re }] });
    }
    if (req.query.category) clauses.push({ category: new RegExp(escapeRegExp(req.query.category), "i") });
    if (req.query.location) clauses.push({ location: new RegExp(escapeRegExp(req.query.location), "i") });
    const priceMin = parseFloat(req.query.priceMin);
    const priceMax = parseFloat(req.query.priceMax);
    if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
      const pr = {};
      if (Number.isFinite(priceMin) && priceMin >= 0) pr.$gte = priceMin;
      if (Number.isFinite(priceMax) && priceMax >= 0) pr.$lte = priceMax;
      clauses.push({ price: pr });
    }
    const filter = clauses.length > 1
      ? (clauses.length === 2 ? clauses.reduce((a, b) => ({ ...a, ...b }), {}) : { $and: clauses })
      : clauses[0];

    if (filtered) {
      const listings = await MarketDryCleaningListing.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      return res.status(200).json(listings);
    }

    const { page, limit, skip } = parseListQueryOptions(req, { mine: isMine });
    const cached = await getCachedMarketList("dry-cleaning", { filter, page, limit });
    if (cached) {
      return res.status(200).json(cached);
    }
    const listings = await MarketDryCleaningListing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    await setCachedMarketList("dry-cleaning", { filter, page, limit }, listings);
    return res.status(200).json(listings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createDryCleaningListing = async (req, res) => {
  try {
    const { title, category, location, rating, reviews, price, badge, tags } = req.body;
    const uploadedImage = req.file ? buildPublicFileUrl(req, req.file) : "";
    const image = uploadedImage || (typeof req.body.image === "string" ? req.body.image.trim() : "");

    if (isBlobUrl(image)) {
      return res
        .status(400)
        .json({ message: "Invalid image value (blob: URL). Please upload a real file or provide an http(s) URL." });
    }

    if (!title || !category || !location || !image) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice)) {
      return res.status(400).json({ message: "Invalid price" });
    }

    const socialNickname = await getCurrentUserName(req.userId);
    const pendingModeration = isAiModerationEnabled();
    const moderationProvider = pendingModeration ? getAiModerationProvider() : "";

    const listing = await MarketDryCleaningListing.create({
      id: buildId(),
      title: String(title).trim(),
      category: String(category).trim(),
      location: String(location).trim(),
      rating: Number(rating) || 0,
      reviews: Number(reviews) || 0,
      price: numericPrice,
      image: String(image).trim(),
      badge: badge ? String(badge).trim() : "",
      tags: parseArrayField(tags),
      socialNickname,
      author: req.userId,
      moderationStatus: pendingModeration ? "pending" : "approved",
      moderationProvider,
    });

    if (pendingModeration) {
      enqueueMarketModerationById("dry-cleaning", listing._id);
    }

    await invalidateMarketListCache("dry-cleaning");

    return res.status(201).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getGames = async (req, res) => {
  try {
    const games = await MarketGame.find({ isActive: true }).sort({ createdAt: -1 }).limit(200).lean();
    return res.status(200).json(games);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createGame = async (req, res) => {
  try {
    const { title, description, category, image, url, isActive } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const game = await MarketGame.create({
      id: buildId(),
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      category: category ? String(category).trim() : "Игры",
      image: image ? String(image).trim() : "",
      url: url ? String(url).trim() : "",
      isActive: typeof isActive === "boolean" ? isActive : true,
      author: req.userId,
    });

    return res.status(201).json(game);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getEcoTips = async (req, res) => {
  try {
    const mine = String(req.query?.mine || "").toLowerCase();
    const filter =
      mine === "1" || mine === "true"
        ? { author: req.userId }
        : { $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }] };

    const tips = await MarketEcoTip.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return res.status(200).json(tips);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createEcoTip = async (req, res) => {
  try {
    const { title, description, category, date } = req.body;
    const uploadedImage = req.file ? buildPublicFileUrl(req, req.file) : "";
    const image = uploadedImage || (typeof req.body.image === "string" ? req.body.image.trim() : "");

    if (!title || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (isBlobUrl(image)) {
      return res
        .status(400)
        .json({ message: "Invalid image value (blob: URL). Please upload a real file or provide an http(s) URL." });
    }

    const pendingModeration = isAiModerationEnabled();
    const moderationProvider = pendingModeration ? getAiModerationProvider() : "";

    const tip = await MarketEcoTip.create({
      id: buildId(),
      title: String(title).trim(),
      description: String(description).trim(),
      category: category ? String(category).trim() : "Вождение",
      date: date ? String(date).trim() : "",
      image: image ? String(image).trim() : "",
      author: req.userId,
      moderationStatus: pendingModeration ? "pending" : "approved",
      moderationProvider,
    });

    if (pendingModeration) {
      enqueueMarketModerationById("eco-tips", tip._id);
    }

    return res.status(201).json(tip);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getHelpRequests = async (req, res) => {
  try {
    const mine = String(req.query?.mine || "").toLowerCase();
    const filter =
      mine === "1" || mine === "true"
        ? { author: req.userId }
        : { $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }] };

    const requests = await MarketHelpRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean({ getters: true });
    return res.status(200).json(requests);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createHelpRequest = async (req, res) => {
  try {
    const { location, description, coordinates } = req.body;

    if (!location || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const coords =
      coordinates &&
      typeof coordinates.lat === "number" &&
      typeof coordinates.lng === "number" &&
      Number.isFinite(coordinates.lat) &&
      Number.isFinite(coordinates.lng)
        ? { lat: coordinates.lat, lng: coordinates.lng }
        : { lat: null, lng: null };

    const userLabel = (await getCurrentUserName(req.userId)) || "Вы";
    const pendingModeration = isAiModerationEnabled();
    const moderationProvider = pendingModeration ? getAiModerationProvider() : "";

    const request = await MarketHelpRequest.create({
      id: `hr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      user: userLabel,
      time: "только что",
      location: String(location).trim(),
      coordinates: coords,
      description: String(description).trim(),
      status: "active",
      author: req.userId,
      moderationStatus: pendingModeration ? "pending" : "approved",
      moderationProvider,
    });

    if (pendingModeration) {
      enqueueMarketModerationById("help-requests", request._id);
    }

    return res.status(201).json(request);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateHelpRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { location, description, status, coordinates } = req.body;

    const request = await MarketHelpRequest.findOne({ _id: id, author: req.userId });
    if (!request) {
      return res.status(404).json({ message: "Not found" });
    }

    let contentChanged = false;
    if (typeof location === "string" && location.trim() !== request.location) {
      request.location = location.trim();
      if (
        coordinates &&
        typeof coordinates.lat === "number" &&
        typeof coordinates.lng === "number" &&
        Number.isFinite(coordinates.lat) &&
        Number.isFinite(coordinates.lng)
      ) {
        request.coordinates = { lat: coordinates.lat, lng: coordinates.lng };
      } else {
        request.coordinates = { lat: null, lng: null };
      }
      contentChanged = true;
    }
    if (typeof description === "string" && description.trim() !== request.description) {
      request.description = description.trim();
      contentChanged = true;
    }
    if (status === "active" || status === "resolved") request.status = status;

    if (contentChanged && isAiModerationEnabled()) {
      request.moderationStatus = "pending";
      request.moderationProvider = getAiModerationProvider();
      request.moderationReasons = [];
      request.moderationCheckedAt = null;
      request.moderationLastError = "";
    }

    await request.save();

    if (contentChanged && isAiModerationEnabled()) {
      enqueueMarketModerationById("help-requests", request._id);
    }

    return res.status(200).json(request);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteHelpRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketHelpRequest.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Not found" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getCompareState = async (req, res) => {
  try {
    const state = await MarketCompareState.findOne({ user: req.userId }).lean();
    return res.status(200).json(state?.items || []);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const saveCompareState = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    const sanitized = items
      .map((item) => ({
        id: Number(item?.id) || 0,
        type: typeof item?.type === "string" ? item.type.trim() : "",
      }))
      .filter((item) => item.id > 0 && item.type);

    const next = await MarketCompareState.findOneAndUpdate(
      { user: req.userId },
      { user: req.userId, items: sanitized },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    return res.status(200).json(next?.items || []);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDrivingCourseModes = async (_req, res) => {
  return res.status(200).json([
    {
      id: "exam",
      title: "Режим Экзамена",
      questionsCount: 20,
      durationMinutes: 20,
      accent: "#2563eb",
    },
    {
      id: "practice",
      title: "Режим Тренировки",
      questionsCount: 20,
      durationMinutes: 0,
      accent: "#e85d04",
    },
    {
      id: "marathon",
      title: "Марафон",
      questionsCount: 800,
      durationMinutes: 0,
      accent: "#9333ea",
    },
  ]);
};

export const getKidsActivities = async (req, res) => {
  try {
    const activities = await MarketKidsActivity.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.status(200).json(activities);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createKidsActivity = async (req, res) => {
  try {
    const { title, description, type, progress, image } = req.body;

    if (!title || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (type !== "Game" && type !== "Coloring" && type !== "Cartoon") {
      return res.status(400).json({ message: "Invalid type" });
    }

    const activity = await MarketKidsActivity.create({
      id: buildId(),
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      type,
      progress: typeof progress === "number" ? progress : progress ? Number(progress) : null,
      image: image ? String(image).trim() : "",
      author: req.userId,
    });

    return res.status(201).json(activity);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getKidsLeaderboard = async (_req, res) => {
  return res.status(200).json([
    { rank: 1, name: "SpeedRacer", score: "15 420", initial: "S" },
    { rank: 2, name: "CarMaster", score: "14 850", initial: "C" },
    { rank: 3, name: "DriftKing", score: "13 200", initial: "D" },
  ]);
};

// UPDATE контроллеры
export const updateDryCleaningListing = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await MarketDryCleaningListing.findOne({ _id: id, author: req.userId });

    if (!listing) {
      return res.status(404).json({ message: "Услуга не найдена" });
    }

    const updatable = ["title", "category", "location", "price", "image", "badge"];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "price") {
          listing[field] = Number(req.body[field]) || 0;
        } else {
          listing[field] = String(req.body[field]).trim();
        }
      }
    });

    if (req.body.tags && Array.isArray(req.body.tags)) {
      listing.tags = req.body.tags;
    }
    if (typeof req.body.tags === "string") {
      listing.tags = parseArrayField(req.body.tags);
    }

    if (req.file) {
      listing.image = buildPublicFileUrl(req, req.file);
    }

    if (isAiModerationEnabled()) {
      listing.moderationStatus = "pending";
      listing.moderationProvider = getAiModerationProvider();
    }

    await listing.save();

    if (isAiModerationEnabled()) {
      enqueueMarketModerationById("dry-cleaning", listing._id);
    }

    await invalidateMarketListCache("dry-cleaning");
    return res.status(200).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteDryCleaningListing = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketDryCleaningListing.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Услуга не найдена" });
    }

    await invalidateMarketListCache("dry-cleaning");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateEcoTip = async (req, res) => {
  try {
    const { id } = req.params;
    const tip = await MarketEcoTip.findOne({ _id: id, author: req.userId });

    if (!tip) {
      return res.status(404).json({ message: "Совет не найден" });
    }

    const updatable = ["title", "description", "category", "date", "image"];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        tip[field] = String(req.body[field]).trim();
      }
    });

    if (req.file) {
      tip.image = buildPublicFileUrl(req, req.file);
    }

    if (isAiModerationEnabled()) {
      tip.moderationStatus = "pending";
      tip.moderationProvider = getAiModerationProvider();
    }

    await tip.save();

    if (isAiModerationEnabled()) {
      enqueueMarketModerationById("eco-tips", tip._id);
    }

    return res.status(200).json(tip);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteEcoTip = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketEcoTip.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Совет не найден" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateGame = async (req, res) => {
  try {
    const { id } = req.params;
    const game = await MarketGame.findOne({ _id: id, author: req.userId });

    if (!game) {
      return res.status(404).json({ message: "Игра не найдена" });
    }

    const updatable = ["title", "description", "category", "image", "url", "isActive"];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "isActive") {
          game[field] = Boolean(req.body[field]);
        } else {
          game[field] = String(req.body[field]).trim();
        }
      }
    });

    await game.save();
    return res.status(200).json(game);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteGame = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketGame.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Игра не найдена" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateKidsActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await MarketKidsActivity.findOne({ _id: id, author: req.userId });

    if (!activity) {
      return res.status(404).json({ message: "Активность не найдена" });
    }

    const updatable = ["title", "description", "progress", "image"];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "progress") {
          activity[field] = typeof req.body[field] === "number" ? req.body[field] : Number(req.body[field]);
        } else {
          activity[field] = String(req.body[field]).trim();
        }
      }
    });

    await activity.save();
    return res.status(200).json(activity);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteKidsActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketKidsActivity.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Активность не найдена" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
