import User from "../models/user.model.js";
import MarketCarServiceListing from "../models/marketCarServiceListing.model.js";
import MarketAutoTuningListing from "../models/marketAutoTuningListing.model.js";
import MarketConsultationExpert from "../models/marketConsultationExpert.model.js";
import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import MarketDryCleaningListing from "../models/marketDryCleaningListing.model.js";
import uploadOnCloudinary from "../config/cloudinary.js";
import { buildPublicFileUrl } from "../config/publicFiles.js";
import { getMarketModelByKind } from "../config/marketKinds.js";
import { getAiModerationProvider, isAiModerationEnabled } from "../services/aiModeration.js";
import {
  getCachedMarketList,
  invalidateMarketListCache,
  setCachedMarketList,
} from "../services/marketListCache.js";
import { invalidateCachedResponse } from "../services/responseCache.js";
import { enqueueMarketModerationById } from "../moderation/marketModerationWorker.js";
import { normalizeVideoUrl } from "../services/videoUrl.js";

const buildId = () => Date.now() + Math.floor(Math.random() * 1000);

const getCurrentUserName = async (userId) => {
  const user = await User.findById(userId).select("userName");
  return user?.userName?.trim() || "";
};

const getCurrentUserProfile = async (userId) => {
  const user = await User.findById(userId).select("name userName profileImage");
  return {
    name: user?.name?.trim() || "",
    userName: user?.userName?.trim() || "",
    profileImage: user?.profileImage || "",
  };
};

const formatMoney = (currency, amount) => {
  const symbol = typeof currency === "string" && currency.trim() ? currency.trim() : "$";
  const numeric = Number(amount) || 0;
  const spaced = numeric.toLocaleString("en-US").replace(/,/g, " ");
  return `${symbol}${spaced}`;
};

const formatMileage = (value) => {
  const numeric = Number(value) || 0;
  return `${numeric.toLocaleString("ru-RU")} км`;
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

const buildAndQuery = (clauses) => {
  const filtered = clauses.filter(Boolean);
  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];
  return { $and: filtered };
};

const moderationApprovedFilter = {
  $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }],
};

const getListingPriceValue = (listing) => {
  if (!listing || typeof listing !== "object") return 0;

  if (Number.isFinite(listing.price)) return listing.price;
  if (Number.isFinite(listing.hourlyRate)) return listing.hourlyRate;

  if (typeof listing.price === "string") {
    return Number(String(listing.price || "0").replace(/\D/g, "")) || 0;
  }

  return 0;
};

const buildMarketListFilter = (mine, userId) =>
  mine === "1" || mine === "true" ? { author: userId } : moderationApprovedFilter;

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

// A factory, not a constant: `new Date()` in a module-level object would be
// evaluated once at process start, so listings expiring later would never be
// filtered out on a long-running server.
const notExpiredFilter = () => ({
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Парсит числовое значение из строки вида "$25 000" → 25000
const parseNumericFromString = (str) =>
  Number(String(str || "").replace(/\D/g, "")) || 0;

// Строит numeric-поля из сырых данных (используется при create/update)
const deriveNumericFields = ({ price, year, mileage } = {}) => ({
  priceNumeric: parseNumericFromString(price),
  yearNumeric: parseInt(String(year || ""), 10) || 0,
  mileageNumeric: parseNumericFromString(mileage),
});

const parseMultiParam = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  const str = String(val).trim();
  if (!str) return [];
  try { const p = JSON.parse(str); if (Array.isArray(p)) return p.map(String).filter(Boolean); } catch { /* */ }
  return str.split(",").map((s) => s.trim()).filter(Boolean);
};

const buildCarFilterClauses = (q, baseFilter) => {
  const clauses = [baseFilter];

  if (q.q) {
    const re = new RegExp(escapeRe(q.q), "i");
    clauses.push({ $or: [{ title: re }, { brand: re }, { model: re }, { description: re }] });
  }
  if (q.type) clauses.push({ type: new RegExp(`^${escapeRe(q.type)}$`, "i") });
  const brands = parseMultiParam(q.brand);
  if (brands.length) clauses.push({ brand: { $in: brands.map((b) => new RegExp(`^${escapeRe(b)}$`, "i")) } });
  const models = parseMultiParam(q.model);
  if (models.length) clauses.push({ model: { $in: models.map((m) => new RegExp(`^${escapeRe(m)}$`, "i")) } });

  const yearFrom = parseInt(q.yearFrom, 10);
  const yearTo = parseInt(q.yearTo, 10);
  if (Number.isFinite(yearFrom) || Number.isFinite(yearTo)) {
    const yr = {};
    if (Number.isFinite(yearFrom) && yearFrom > 0) yr.$gte = yearFrom;
    if (Number.isFinite(yearTo) && yearTo > 0) yr.$lte = yearTo;
    if (Object.keys(yr).length) clauses.push({ yearNumeric: yr });
  }

  const priceMin = parseFloat(q.priceMin);
  const priceMax = parseFloat(q.priceMax);
  if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
    const pr = {};
    if (Number.isFinite(priceMin) && priceMin >= 0) pr.$gte = priceMin;
    if (Number.isFinite(priceMax) && priceMax >= 0) pr.$lte = priceMax;
    if (Object.keys(pr).length) clauses.push({ priceNumeric: pr });
  }

  const mileageMin = parseInt(q.mileageMin, 10);
  const mileageMax = parseInt(q.mileageMax, 10);
  if (Number.isFinite(mileageMin) || Number.isFinite(mileageMax)) {
    const ml = {};
    if (Number.isFinite(mileageMin) && mileageMin >= 0) ml.$gte = mileageMin;
    if (Number.isFinite(mileageMax) && mileageMax >= 0) ml.$lte = mileageMax;
    if (Object.keys(ml).length) clauses.push({ mileageNumeric: ml });
  }

  const fuels = parseMultiParam(q.fuel);
  if (fuels.length) clauses.push({ fuel: { $in: fuels.map((f) => new RegExp(`^${escapeRe(f)}$`, "i")) } });

  const gearboxes = parseMultiParam(q.gearbox);
  if (gearboxes.length) clauses.push({ transmission: { $in: gearboxes.map((g) => new RegExp(`^${escapeRe(g)}$`, "i")) } });

  const bodies = parseMultiParam(q.bodyType);
  if (bodies.length) clauses.push({ bodyType: { $in: bodies.map((b) => new RegExp(`^${escapeRe(b)}$`, "i")) } });

  const drives = parseMultiParam(q.driveType);
  if (drives.length) clauses.push({ driveType: { $in: drives.map((d) => new RegExp(`^${escapeRe(d)}$`, "i")) } });
  if (q.seats) clauses.push({ seats: new RegExp(escapeRe(q.seats), "i") });
  if (q.region) clauses.push({ $or: [{ region: new RegExp(escapeRe(q.region), "i") }, { location: new RegExp(escapeRe(q.region), "i") }] });
  if (q.registrationPlace) clauses.push({ registrationPlace: new RegExp(escapeRe(q.registrationPlace), "i") });

  return clauses;
};

const buildPartFilterClauses = (q, baseFilter) => {
  const clauses = [baseFilter];

  if (q.q) {
    const re = new RegExp(escapeRe(q.q), "i");
    clauses.push({ $or: [{ title: re }, { brand: re }, { model: re }, { partGroup: re }, { partCategory: re }, { description: re }] });
  }
  if (q.type) clauses.push({ type: new RegExp(`^${escapeRe(q.type)}$`, "i") });
  const brands = parseMultiParam(q.brand);
  if (brands.length) clauses.push({ brand: { $in: brands.map((b) => new RegExp(`^${escapeRe(b)}$`, "i")) } });
  const models = parseMultiParam(q.model);
  if (models.length) clauses.push({ model: { $in: models.map((m) => new RegExp(`^${escapeRe(m)}$`, "i")) } });
  if (q.partCategoryKey) clauses.push({ partCategoryKey: q.partCategoryKey });
  if (q.partGroup) clauses.push({ partGroup: new RegExp(escapeRe(q.partGroup), "i") });
  if (q.region) clauses.push({ $or: [{ region: new RegExp(escapeRe(q.region), "i") }, { location: new RegExp(escapeRe(q.region), "i") }] });

  const yearFrom = parseInt(q.yearFrom, 10);
  const yearTo = parseInt(q.yearTo, 10);
  if (Number.isFinite(yearFrom) || Number.isFinite(yearTo)) {
    const yr = {};
    if (Number.isFinite(yearFrom) && yearFrom > 0) yr.$gte = yearFrom;
    if (Number.isFinite(yearTo) && yearTo > 0) yr.$lte = yearTo;
    if (Object.keys(yr).length) clauses.push({ yearNumeric: yr });
  }

  const priceMin = parseFloat(q.priceMin);
  const priceMax = parseFloat(q.priceMax);
  if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
    const pr = {};
    if (Number.isFinite(priceMin) && priceMin >= 0) pr.$gte = priceMin;
    if (Number.isFinite(priceMax) && priceMax >= 0) pr.$lte = priceMax;
    if (Object.keys(pr).length) clauses.push({ priceNumeric: pr });
  }

  return clauses;
};

// Возвращает true, если запрос содержит хотя бы один реальный фильтр (кроме mine/page/limit)
const hasFilters = (query) => {
  const skip = new Set(["mine", "page", "limit"]);
  return Object.keys(query).some((k) => !skip.has(k) && query[k] != null && String(query[k]).trim() !== "");
};

// One minute, matching the cache key bucket in marketListCache.js.
const CACHE_TIME_BUCKET_MS = 60000;

// The cache key must come from normalized request parameters, never from the
// Mongo filter object: the filter carries a fresh `new Date()` (unique key on
// every request, so the cache never hit) and RegExp instances that stringify
// away to `{}`. These endpoints only cache the unfiltered listing pages, so
// mine/page/limit fully describe the query.
const buildListCacheKey = ({ isMine, userId, page, limit, timeSensitive = false }) => ({
  v: 1,
  mine: isMine ? String(userId || "") : "",
  page,
  limit,
  // The `expiresAt > now` bound moves with the clock; bucketing it keeps the
  // key reusable while capping how long an expired listing can be served.
  bucket: timeSensitive ? Math.floor(Date.now() / CACHE_TIME_BUCKET_MS) : 0,
});

const getMarketList = async ({ scope, model, filter, page, limit, skip, sort, cacheKey }) => {
  const effectiveSort = sort || { createdAt: -1 };
  const key = cacheKey || { filter, page, limit };
  const cached = await getCachedMarketList(scope, key);
  if (cached) return cached;

  const listings = await model.find(filter).sort(effectiveSort).skip(skip).limit(limit).lean();
  return setCachedMarketList(scope, key, listings);
};

export const getCarListings = async (req, res) => {
  try {
    const mine = String(req.query?.mine || "").toLowerCase();
    const isMine = mine === "1" || mine === "true";
    const baseFilter = buildMarketListFilter(mine, req.userId);
    const filtered = hasFilters(req.query);

    let filter;
    if (filtered && !isMine) {
      const clauses = buildCarFilterClauses(req.query, buildAndQuery([baseFilter, notExpiredFilter()]));
      filter = buildAndQuery(clauses);
    } else if (!isMine) {
      filter = buildAndQuery([baseFilter, notExpiredFilter()]);
    } else if (filtered) {
      const clauses = buildCarFilterClauses(req.query, baseFilter);
      filter = buildAndQuery(clauses);
    } else {
      filter = baseFilter;
    }

    // Для фильтрованных запросов — повышенный лимит, кеш не используется
    const queryOptions = filtered
      ? { page: 1, limit: 500, skip: 0 }
      : parseListQueryOptions(req, { mine: isMine });
    const sort = isMine ? { createdAt: -1 } : { priority: -1, createdAt: -1 };

    let listings;
    if (filtered) {
      listings = await MarketCarListing.find(filter).sort(sort).skip(queryOptions.skip).limit(queryOptions.limit).lean();
    } else {
      listings = await getMarketList({
        scope: "cars",
        model: MarketCarListing,
        filter,
        sort,
        ...queryOptions,
        cacheKey: buildListCacheKey({
          isMine,
          userId: req.userId,
          page: queryOptions.page,
          limit: queryOptions.limit,
          timeSensitive: !isMine,
        }),
      });
    }

    return res.status(200).json(listings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getPartListings = async (req, res) => {
  try {
    const mine = String(req.query?.mine || "").toLowerCase();
    const isMine = mine === "1" || mine === "true";
    const baseFilter = buildMarketListFilter(mine, req.userId);
    const filtered = hasFilters(req.query);

    let filter;
    if (filtered && !isMine) {
      const clauses = buildPartFilterClauses(req.query, buildAndQuery([baseFilter, notExpiredFilter()]));
      filter = buildAndQuery(clauses);
    } else if (!isMine) {
      filter = buildAndQuery([baseFilter, notExpiredFilter()]);
    } else if (filtered) {
      const clauses = buildPartFilterClauses(req.query, baseFilter);
      filter = buildAndQuery(clauses);
    } else {
      filter = baseFilter;
    }

    const queryOptions = filtered
      ? { page: 1, limit: 500, skip: 0 }
      : parseListQueryOptions(req, { mine: isMine });
    const sort = isMine ? { createdAt: -1 } : { priority: -1, createdAt: -1 };

    let listings;
    if (filtered) {
      listings = await MarketPartListing.find(filter).sort(sort).skip(queryOptions.skip).limit(queryOptions.limit).lean();
    } else {
      listings = await getMarketList({
        scope: "parts",
        model: MarketPartListing,
        filter,
        sort,
        ...queryOptions,
        cacheKey: buildListCacheKey({
          isMine,
          userId: req.userId,
          page: queryOptions.page,
          limit: queryOptions.limit,
          timeSensitive: !isMine,
        }),
      });
    }

    return res.status(200).json(listings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createCarListing = async (req, res) => {
  try {
    const {
      offerType,
      brand,
      model,
      year,
      mileage,
      fuel,
      body,
      drive,
      gearbox,
      engineVolume,
      seats,
      registration,
      region,
      price,
      currency,
      title,
      description,
    } = req.body;

    const files = Array.isArray(req.files) ? req.files : [];
    const uploadedImages = [];

    for (const file of files) {
      if (!file?.path) continue;
      // eslint-disable-next-line no-await-in-loop
      const url = await uploadOnCloudinary(file.path);
      if (url) {
        uploadedImages.push(url);
      } else {
        const localUrl = buildPublicFileUrl(req, file);
        if (localUrl) uploadedImages.push(localUrl);
      }
    }

    const rawFallback = typeof req.body.image === "string" ? req.body.image.trim() : "";
    const isSafeUrl = rawFallback && /^https?:\/\//i.test(rawFallback) && !/^(blob:|data:|javascript:)/i.test(rawFallback);
    const imageFallback = isSafeUrl ? rawFallback : "";
    const images = uploadedImages.length > 0 ? uploadedImages : imageFallback ? [imageFallback] : [];

    if (!title || !price) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (images.length === 0) {
      return res.status(400).json({ message: "Images are required" });
    }

    const userProfile = await getCurrentUserProfile(req.userId);
    const socialNickname = userProfile.userName ? `@${userProfile.userName}` : "";
    const pendingModeration = isAiModerationEnabled();
    const moderationProvider = pendingModeration ? getAiModerationProvider() : "";

    const planLimits = req.planLimits || { priority: 0, listingDays: 30, badge: null, videoEnabled: false }
    const expiresAt = planLimits.listingDays
      ? new Date(Date.now() + planLimits.listingDays * 24 * 60 * 60 * 1000)
      : null

    const videoUrl = planLimits.videoEnabled
      ? normalizeVideoUrl(req.body?.videoUrl)
      : "";

    const rawPriceNum = Number(price) || 0;
    const listing = await MarketCarListing.create({
      sellerBadge: planLimits.badge ?? null,
      id: buildId(),
      image: images[0],
      images,
      videoUrl,
      price: formatMoney(currency, price),
      priceNumeric: rawPriceNum,
      yearNumeric: parseInt(String(year || ""), 10) || 0,
      mileageNumeric: Number(String(mileage || "").replace(/\D/g, "")) || 0,
      title: String(title).trim(),
      mileage: mileage ? formatMileage(mileage) : "",
      fuel: fuel ? String(fuel).trim() : "",
      transmission: gearbox ? String(gearbox).trim() : "",
      year: year ? String(year).trim() : "",
      location: region ? String(region).trim() : registration ? String(registration).trim() : "",
      seller: userProfile.name || userProfile.userName || "Пользователь",
      sellerAvatar:
        userProfile.profileImage ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          userProfile.userName || userProfile.name || "AV",
        )}&background=111827&color=ffffff&size=240&bold=true`,
      time: "только что",
      views: "0",
      type: offerType ? String(offerType).trim() : "Продажа",
      brand: brand ? String(brand).trim() : "",
      model: model ? String(model).trim() : "",
      bodyType: body ? String(body).trim() : "",
      driveType: drive ? String(drive).trim() : "",
      engineVolume: engineVolume ? String(engineVolume).trim() : "",
      seats: seats ? String(seats).trim() : "",
      registrationPlace: registration ? String(registration).trim() : "",
      region: region ? String(region).trim() : "",
      description: description ? String(description).trim() : "",
      socialNickname,
      author: req.userId,
      moderationStatus: pendingModeration ? "pending" : "approved",
      moderationProvider,
      priority: planLimits.priority ?? 0,
      expiresAt,
    });

    if (pendingModeration) {
      enqueueMarketModerationById("cars", listing._id);
    }
    await invalidateMarketListCache("cars");
    await invalidateCachedResponse("market-meta");

    return res.status(201).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const makePartCategoryKey = (group, category) => {
  const g = typeof group === "string" ? group.trim() : "";
  const c = typeof category === "string" ? category.trim() : "";
  if (!g || !c) return "";
  return `${g}::${c}`;
};

export const createPartListing = async (req, res) => {
  try {
    const {
      offerType,
      brand,
      model,
      year,
      region,
      price,
      currency,
      title,
      description,
      partGroup,
      partCategory,
      partCategoryKey,
    } = req.body;

    const files = Array.isArray(req.files) ? req.files : [];
    const uploadedImages = [];

    for (const file of files) {
      if (!file?.path) continue;
      // eslint-disable-next-line no-await-in-loop
      const url = await uploadOnCloudinary(file.path);
      if (url) {
        uploadedImages.push(url);
      } else {
        const localUrl = buildPublicFileUrl(req, file);
        if (localUrl) uploadedImages.push(localUrl);
      }
    }

    const rawFallback = typeof req.body.image === "string" ? req.body.image.trim() : "";
    const isSafeUrl = rawFallback && /^https?:\/\//i.test(rawFallback) && !/^(blob:|data:|javascript:)/i.test(rawFallback);
    const imageFallback = isSafeUrl ? rawFallback : "";
    const images = uploadedImages.length > 0 ? uploadedImages : imageFallback ? [imageFallback] : [];

    if (!title || !price) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (images.length === 0) {
      return res.status(400).json({ message: "Images are required" });
    }

    const userProfile = await getCurrentUserProfile(req.userId);
    const socialNickname = userProfile.userName ? `@${userProfile.userName}` : "";
    const pendingModeration = isAiModerationEnabled();
    const moderationProvider = pendingModeration ? getAiModerationProvider() : "";

    const resolvedPartKey =
      typeof partCategoryKey === "string" && partCategoryKey.trim()
        ? partCategoryKey.trim()
        : makePartCategoryKey(partGroup, partCategory);

    const planLimits = req.planLimits || { priority: 0, listingDays: 30, badge: null, videoEnabled: false }
    const expiresAt = planLimits.listingDays
      ? new Date(Date.now() + planLimits.listingDays * 24 * 60 * 60 * 1000)
      : null

    const videoUrl = planLimits.videoEnabled
      ? normalizeVideoUrl(req.body?.videoUrl)
      : "";

    const rawPartPriceNum = Number(price) || 0;
    const listing = await MarketPartListing.create({
      sellerBadge: planLimits.badge ?? null,
      id: buildId(),
      image: images[0],
      images,
      videoUrl,
      price: formatMoney(currency, price),
      priceNumeric: rawPartPriceNum,
      yearNumeric: parseInt(String(year || ""), 10) || 0,
      title: String(title).trim(),
      year: year ? String(year).trim() : "",
      location: region ? String(region).trim() : "",
      seller: userProfile.name || userProfile.userName || "Пользователь",
      sellerAvatar:
        userProfile.profileImage ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          userProfile.userName || userProfile.name || "AV",
        )}&background=111827&color=ffffff&size=240&bold=true`,
      time: "только что",
      views: "0",
      type: offerType ? String(offerType).trim() : "Продажа",
      brand: brand ? String(brand).trim() : "",
      model: model ? String(model).trim() : "",
      region: region ? String(region).trim() : "",
      description: description ? String(description).trim() : "",
      partGroup: partGroup ? String(partGroup).trim() : "",
      partCategory: partCategory ? String(partCategory).trim() : "",
      partCategoryKey: resolvedPartKey,
      socialNickname,
      author: req.userId,
      moderationStatus: pendingModeration ? "pending" : "approved",
      moderationProvider,
      mileage: "",
      fuel: "",
      transmission: "",
      priority: planLimits.priority ?? 0,
      expiresAt,
    });

    if (pendingModeration) {
      enqueueMarketModerationById("parts", listing._id);
    }
    await invalidateMarketListCache("parts");
    await invalidateCachedResponse("market-meta");

    return res.status(201).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updatePartListing = async (req, res) => {
  try {
    const { id } = req.params;

    const patch = {};
    const allowed = [
      "offerType",
      "brand",
      "model",
      "year",
      "region",
      "title",
      "description",
      "partGroup",
      "partCategory",
      "partCategoryKey",
    ];

    for (const key of allowed) {
      if (typeof req.body?.[key] === "string") {
        patch[key === "offerType" ? "type" : key] = req.body[key].trim();
      }
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const uploadedImages = [];

    for (const file of files) {
      if (!file?.path) continue;
      // eslint-disable-next-line no-await-in-loop
      const url = await uploadOnCloudinary(file.path);
      if (url) {
        uploadedImages.push(url);
      } else {
        const localUrl = buildPublicFileUrl(req, file);
        if (localUrl) uploadedImages.push(localUrl);
      }
    }

    if (uploadedImages.length > 0) {
      patch.images = uploadedImages;
      patch.image = uploadedImages[0];
    }

    if (typeof req.body?.price === "string" || typeof req.body?.price === "number") {
      const currency = typeof req.body?.currency === "string" ? req.body.currency.trim() : "$";
      patch.price = formatMoney(currency, req.body.price);
      patch.priceNumeric = Number(req.body.price) || 0;
    }
    if (patch.year) {
      patch.yearNumeric = parseInt(String(patch.year), 10) || 0;
    }

    if (!patch.partCategoryKey && (patch.partGroup || patch.partCategory)) {
      const group = patch.partGroup || req.body?.partGroup;
      const cat = patch.partCategory || req.body?.partCategory;
      const computed = makePartCategoryKey(group, cat);
      if (computed) patch.partCategoryKey = computed;
    }

    const updated = await MarketPartListing.findOneAndUpdate({ _id: id, author: req.userId }, { $set: patch }, { new: true }).lean();

    if (!updated) {
      return res.status(404).json({ message: "Объявление не найдено" });
    }

    await invalidateMarketListCache("parts");
    await invalidateCachedResponse("market-meta");
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deletePartListing = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketPartListing.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Объявление не найдено" });
    }

    await invalidateMarketListCache("parts");
    await invalidateCachedResponse("market-meta");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getCarServiceListings = async (req, res) => {
  try {
    const mine = String(req.query?.mine || "").toLowerCase();
    const isMine = mine === "1" || mine === "true";
    const baseFilter = buildMarketListFilter(mine, req.userId);
    const filtered = hasFilters(req.query);
    const clauses = [baseFilter];
    if (req.query.q) {
      const re = new RegExp(escapeRe(req.query.q), "i");
      clauses.push({ $or: [{ title: re }, { category: re }, { location: re }] });
    }
    if (req.query.category) clauses.push({ category: new RegExp(escapeRe(req.query.category), "i") });
    if (req.query.location) clauses.push({ location: new RegExp(escapeRe(req.query.location), "i") });
    const priceMin = parseFloat(req.query.priceMin);
    const priceMax = parseFloat(req.query.priceMax);
    if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
      const pr = {};
      if (Number.isFinite(priceMin) && priceMin >= 0) pr.$gte = priceMin;
      if (Number.isFinite(priceMax) && priceMax >= 0) pr.$lte = priceMax;
      clauses.push({ price: pr });
    }
    const minQuality = parseFloat(req.query.minQuality);
    if (Number.isFinite(minQuality) && minQuality > 0) clauses.push({ serviceQuality: { $gte: minQuality } });

    const filter = buildAndQuery(clauses);
    const queryOptions = filtered
      ? { page: 1, limit: 500, skip: 0 }
      : parseListQueryOptions(req, { mine: isMine });

    let listings;
    if (filtered) {
      listings = await MarketCarServiceListing.find(filter).sort({ createdAt: -1 }).skip(queryOptions.skip).limit(queryOptions.limit).lean();
    } else {
      listings = await getMarketList({
        scope: "car-services",
        model: MarketCarServiceListing,
        filter,
        ...queryOptions,
        cacheKey: buildListCacheKey({
          isMine,
          userId: req.userId,
          page: queryOptions.page,
          limit: queryOptions.limit,
        }),
      });
    }
    return res.status(200).json(listings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Картинки запроса одним списком: multer кладёт их по-разному — одну в
 * req.file, несколько в req.files (массивом или объектом полей). Приложение
 * шлёт «images», веб исторически шлёт «image», и оба должны работать.
 */
export const collectRequestFiles = (req) => {
  if (Array.isArray(req.files)) return req.files.filter(Boolean);
  if (req.files && typeof req.files === "object") {
    return [...(req.files.images || []), ...(req.files.image || [])].filter(Boolean);
  }
  return req.file ? [req.file] : [];
};

/** Загружает файлы запроса и возвращает публичные ссылки по порядку. */
export const uploadRequestImages = async (req) => {
  const urls = [];
  for (const file of collectRequestFiles(req)) {
    if (!file?.path) continue;
    // eslint-disable-next-line no-await-in-loop
    const url = await uploadOnCloudinary(file.path);
    if (url) {
      urls.push(url);
    } else {
      const localUrl = buildPublicFileUrl(req, file);
      if (localUrl) urls.push(localUrl);
    }
  }
  return urls;
};

export const createCarServiceListing = async (req, res) => {
  try {
    const { category, title, location, serviceQuality, reviews, price, pricePrefix, unit } = req.body;
    const uploaded = await uploadRequestImages(req);
    const fallback = typeof req.body.image === "string" ? req.body.image.trim() : "";
    const images = uploaded.length ? uploaded : fallback ? [fallback] : [];
    const image = images[0] || "";

    if (isBlobUrl(image)) {
      return res
        .status(400)
        .json({ message: "Invalid image value (blob: URL). Please upload a real file or provide an http(s) URL." });
    }

    const numericPrice = Number(price);
    if (!image || !category || !title || !location || !Number.isFinite(numericPrice)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const socialNickname = await getCurrentUserName(req.userId);
    const pendingModeration = isAiModerationEnabled();
    const moderationProvider = pendingModeration ? getAiModerationProvider() : "";

    const listing = await MarketCarServiceListing.create({
      id: buildId(),
      image,
      images,
      category,
      title,
      location,
      serviceQuality: Number(serviceQuality) || 0,
      reviews: Number(reviews) || 0,
      price: numericPrice,
      pricePrefix: pricePrefix || "",
      unit: unit || "",
      socialNickname,
      author: req.userId,
      moderationStatus: pendingModeration ? "pending" : "approved",
      moderationProvider,
    });

    if (pendingModeration) {
      enqueueMarketModerationById("car-services", listing._id);
    }
    await invalidateMarketListCache("car-services");

    return res.status(201).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAutoTuningListings = async (req, res) => {
  try {
    const mine = String(req.query?.mine || "").toLowerCase();
    const isMine = mine === "1" || mine === "true";
    const baseFilter = buildMarketListFilter(mine, req.userId);
    const filtered = hasFilters(req.query);
    const clauses = [baseFilter];
    if (req.query.q) {
      const re = new RegExp(escapeRe(req.query.q), "i");
      clauses.push({ $or: [{ title: re }, { category: re }, { location: re }] });
    }
    if (req.query.category) clauses.push({ category: new RegExp(escapeRe(req.query.category), "i") });
    if (req.query.location) clauses.push({ location: new RegExp(escapeRe(req.query.location), "i") });
    const priceMin = parseFloat(req.query.priceMin);
    const priceMax = parseFloat(req.query.priceMax);
    if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
      const pr = {};
      if (Number.isFinite(priceMin) && priceMin >= 0) pr.$gte = priceMin;
      if (Number.isFinite(priceMax) && priceMax >= 0) pr.$lte = priceMax;
      clauses.push({ price: pr });
    }
    const filter = buildAndQuery(clauses);
    const queryOptions = filtered
      ? { page: 1, limit: 500, skip: 0 }
      : parseListQueryOptions(req, { mine: isMine });

    let listings;
    if (filtered) {
      listings = await MarketAutoTuningListing.find(filter).sort({ createdAt: -1 }).skip(queryOptions.skip).limit(queryOptions.limit).lean();
    } else {
      listings = await getMarketList({
        scope: "auto-tuning",
        model: MarketAutoTuningListing,
        filter,
        ...queryOptions,
        cacheKey: buildListCacheKey({
          isMine,
          userId: req.userId,
          page: queryOptions.page,
          limit: queryOptions.limit,
        }),
      });
    }
    return res.status(200).json(listings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createAutoTuningListing = async (req, res) => {
  try {
    const { title, category, location, rating, reviews, price, badge, tags } = req.body;
    const uploaded = await uploadRequestImages(req);
    const fallback = typeof req.body.image === "string" ? req.body.image.trim() : "";
    const images = uploaded.length ? uploaded : fallback ? [fallback] : [];
    const image = images[0] || "";

    if (isBlobUrl(image)) {
      return res
        .status(400)
        .json({ message: "Invalid image value (blob: URL). Please upload a real file or provide an http(s) URL." });
    }

    const numericPrice = Number(price);
    if (!title || !category || !location || !image || !Number.isFinite(numericPrice)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const socialNickname = await getCurrentUserName(req.userId);
    const pendingModeration = isAiModerationEnabled();
    const moderationProvider = pendingModeration ? getAiModerationProvider() : "";

    const listing = await MarketAutoTuningListing.create({
      id: buildId(),
      images,
      title,
      category,
      location,
      rating: Number(rating) || 0,
      reviews: Number(reviews) || 0,
      price: numericPrice,
      image,
      badge: badge || "",
      tags: parseArrayField(tags),
      socialNickname,
      author: req.userId,
      moderationStatus: pendingModeration ? "pending" : "approved",
      moderationProvider,
    });

    if (pendingModeration) {
      enqueueMarketModerationById("auto-tuning", listing._id);
    }
    await invalidateMarketListCache("auto-tuning");

    return res.status(201).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getConsultationExperts = async (req, res) => {
  try {
    const mine = String(req.query?.mine || "").toLowerCase();
    const isMine = mine === "1" || mine === "true";
    const baseFilter = buildMarketListFilter(mine, req.userId);
    const filtered = hasFilters(req.query);
    const clauses = [baseFilter];
    if (req.query.q) {
      const re = new RegExp(escapeRe(req.query.q), "i");
      clauses.push({ $or: [{ name: re }, { location: re }, { specialties: re }, { tags: re }] });
    }
    if (req.query.location) clauses.push({ location: new RegExp(escapeRe(req.query.location), "i") });
    const specialties = parseMultiParam(req.query.specialties);
    if (specialties.length) clauses.push({ specialties: { $in: specialties.map((s) => new RegExp(escapeRe(s), "i")) } });
    const minRate = parseFloat(req.query.minRate);
    const maxRate = parseFloat(req.query.maxRate);
    if (Number.isFinite(minRate) || Number.isFinite(maxRate)) {
      const hr = {};
      if (Number.isFinite(minRate) && minRate >= 0) hr.$gte = minRate;
      if (Number.isFinite(maxRate) && maxRate >= 0) hr.$lte = maxRate;
      clauses.push({ hourlyRate: hr });
    }
    if (req.query.isVerified === "true" || req.query.isVerified === "1") clauses.push({ isVerified: true });

    const filter = buildAndQuery(clauses);
    const queryOptions = filtered
      ? { page: 1, limit: 500, skip: 0 }
      : parseListQueryOptions(req, { mine: isMine });

    let experts;
    if (filtered) {
      experts = await MarketConsultationExpert.find(filter).sort({ createdAt: -1 }).skip(queryOptions.skip).limit(queryOptions.limit).lean();
    } else {
      experts = await getMarketList({
        scope: "consultations",
        model: MarketConsultationExpert,
        filter,
        ...queryOptions,
        cacheKey: buildListCacheKey({
          isMine,
          userId: req.userId,
          page: queryOptions.page,
          limit: queryOptions.limit,
        }),
      });
    }
    return res.status(200).json(experts);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createConsultationExpert = async (req, res) => {
  try {
    const {
      name,
      isVerified,
      rating,
      reviewsCount,
      specialties,
      experience,
      consultations,
      hourlyRate,
      tags,
      location,
    } = req.body;

    const uploadedAvatar = req.file ? buildPublicFileUrl(req, req.file) : "";
    const avatar = uploadedAvatar || (typeof req.body.avatar === "string" ? req.body.avatar.trim() : "");

    if (isBlobUrl(avatar)) {
      return res
        .status(400)
        .json({ message: "Invalid avatar value (blob: URL). Please upload a real file or provide an http(s) URL." });
    }

    const numericHourlyRate = Number(hourlyRate);
    if (!name || !avatar || !location || !Number.isFinite(numericHourlyRate)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const socialNickname = await getCurrentUserName(req.userId);
    const pendingModeration = isAiModerationEnabled();
    const moderationProvider = pendingModeration ? getAiModerationProvider() : "";

    const expert = await MarketConsultationExpert.create({
      id: buildId(),
      name,
      avatar,
      socialNickname,
      isVerified: isVerified === true || isVerified === "true" || isVerified === "1",
      rating: Number(rating) || 0,
      reviewsCount: Number(reviewsCount) || 0,
      specialties: parseArrayField(specialties),
      experience: Number(experience) || 0,
      consultations: Number(consultations) || 0,
      hourlyRate: numericHourlyRate,
      tags: parseArrayField(tags),
      location,
      author: req.userId,
      moderationStatus: pendingModeration ? "pending" : "approved",
      moderationProvider,
    });

    if (pendingModeration) {
      enqueueMarketModerationById("consultations", expert._id);
    }
    await invalidateMarketListCache("consultations");

    return res.status(201).json(expert);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// UPDATE контроллеры
export const updateCarListing = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await MarketCarListing.findOne({ _id: id, author: req.userId });

    if (!listing) {
      return res.status(404).json({ message: "Объявление не найдено" });
    }

    const fieldMap = {
      title: "title",
      description: "description",
      fuel: "fuel",
      brand: "brand",
      model: "model",
      bodyType: "bodyType",
      driveType: "driveType",
      engineVolume: "engineVolume",
      seats: "seats",
      region: "region",
      gearbox: "transmission",
      registration: "registrationPlace",
      offerType: "type",
    };

    Object.entries(fieldMap).forEach(([inputField, targetField]) => {
      if (req.body[inputField] !== undefined) {
        listing[targetField] = String(req.body[inputField]).trim();
      }
    });

    if (req.body.price !== undefined) {
      listing.price = formatMoney(req.body.currency || "USD", req.body.price);
      listing.priceNumeric = Number(req.body.price) || 0;
    }

    if (req.body.mileage !== undefined) {
      listing.mileage = req.body.mileage ? formatMileage(req.body.mileage) : "";
      listing.mileageNumeric = Number(String(req.body.mileage || "").replace(/\D/g, "")) || 0;
    }

    if (req.body.year !== undefined) {
      listing.year = String(req.body.year).trim();
      listing.yearNumeric = parseInt(String(req.body.year || ""), 10) || 0;
    }

    if (req.body.region !== undefined || req.body.registration !== undefined) {
      const regionValue = req.body.region !== undefined ? String(req.body.region).trim() : listing.region;
      const registrationValue =
        req.body.registration !== undefined ? String(req.body.registration).trim() : listing.registrationPlace;
      listing.location = regionValue || registrationValue || "";
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const uploadedImages = [];

    for (const file of files) {
      if (!file?.path) continue;
      // eslint-disable-next-line no-await-in-loop
      const url = await uploadOnCloudinary(file.path);
      if (url) {
        uploadedImages.push(url);
      } else {
        const localUrl = buildPublicFileUrl(req, file);
        if (localUrl) uploadedImages.push(localUrl);
      }
    }

    if (uploadedImages.length > 0) {
      listing.images = uploadedImages;
      listing.image = uploadedImages[0];
    }

    const hadContentChanges = true; // Assuming update = content change
    if (hadContentChanges && isAiModerationEnabled()) {
      listing.moderationStatus = "pending";
      listing.moderationProvider = getAiModerationProvider();
      listing.moderationReasons = [];
      listing.moderationCheckedAt = null;
    }

    await listing.save();

    if (hadContentChanges && isAiModerationEnabled()) {
      enqueueMarketModerationById("cars", listing._id);
    }

    await invalidateMarketListCache("cars");
    await invalidateCachedResponse("market-meta");
    return res.status(200).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteCarListing = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketCarListing.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Объявление не найдено" });
    }

    await invalidateMarketListCache("cars");
    await invalidateCachedResponse("market-meta");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateCarServiceListing = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await MarketCarServiceListing.findOne({ _id: id, author: req.userId });

    if (!listing) {
      return res.status(404).json({ message: "Сервис не найден" });
    }

    const updatable = ["title", "category", "location", "price", "pricePrefix", "unit", "image"];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "price") {
          listing[field] = Number(req.body[field]) || 0;
        } else {
          listing[field] = String(req.body[field]).trim();
        }
      }
    });

    // Новые кадры заменяют прежние целиком: правка фото — это «вот теперь
    // такие», а не «добавьте к тем».
    const uploadedImages = await uploadRequestImages(req);
    if (uploadedImages.length) {
      listing.images = uploadedImages;
      listing.image = uploadedImages[0];
    }

    if (isAiModerationEnabled()) {
      listing.moderationStatus = "pending";
      listing.moderationProvider = getAiModerationProvider();
    }

    await listing.save();

    if (isAiModerationEnabled()) {
      enqueueMarketModerationById("car-services", listing._id);
    }

    await invalidateMarketListCache("car-services");
    return res.status(200).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteCarServiceListing = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketCarServiceListing.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Сервис не найден" });
    }

    await invalidateMarketListCache("car-services");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateAutoTuningListing = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await MarketAutoTuningListing.findOne({ _id: id, author: req.userId });

    if (!listing) {
      return res.status(404).json({ message: "Тюнинг не найден" });
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
    } else if (typeof req.body.tags === "string") {
      listing.tags = parseArrayField(req.body.tags);
    }

    // Новые кадры заменяют прежние целиком: правка фото — это «вот теперь
    // такие», а не «добавьте к тем».
    const uploadedImages = await uploadRequestImages(req);
    if (uploadedImages.length) {
      listing.images = uploadedImages;
      listing.image = uploadedImages[0];
    }

    if (isAiModerationEnabled()) {
      listing.moderationStatus = "pending";
      listing.moderationProvider = getAiModerationProvider();
    }

    await listing.save();

    if (isAiModerationEnabled()) {
      enqueueMarketModerationById("auto-tuning", listing._id);
    }

    await invalidateMarketListCache("auto-tuning");
    return res.status(200).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteAutoTuningListing = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketAutoTuningListing.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Тюнинг не найден" });
    }

    await invalidateMarketListCache("auto-tuning");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateConsultationExpert = async (req, res) => {
  try {
    const { id } = req.params;
    const expert = await MarketConsultationExpert.findOne({ _id: id, author: req.userId });

    if (!expert) {
      return res.status(404).json({ message: "Эксперт не найден" });
    }

    const updatable = ["name", "avatar", "location", "hourlyRate"];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "hourlyRate") {
          expert[field] = Number(req.body[field]) || 0;
        } else {
          expert[field] = String(req.body[field]).trim();
        }
      }
    });

    if (req.body.specialties && Array.isArray(req.body.specialties)) {
      expert.specialties = req.body.specialties;
    } else if (typeof req.body.specialties === "string") {
      expert.specialties = parseArrayField(req.body.specialties);
    }

    if (req.body.tags && Array.isArray(req.body.tags)) {
      expert.tags = req.body.tags;
    } else if (typeof req.body.tags === "string") {
      expert.tags = parseArrayField(req.body.tags);
    }

    if (req.body.isVerified !== undefined) {
      expert.isVerified = Boolean(req.body.isVerified);
    }

    if (req.file) {
      expert.avatar = buildPublicFileUrl(req, req.file);
    }

    if (isAiModerationEnabled()) {
      expert.moderationStatus = "pending";
      expert.moderationProvider = getAiModerationProvider();
    }

    await expert.save();

    if (isAiModerationEnabled()) {
      enqueueMarketModerationById("consultations", expert._id);
    }

    await invalidateMarketListCache("consultations");
    return res.status(200).json(expert);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteConsultationExpert = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MarketConsultationExpert.findOneAndDelete({ _id: id, author: req.userId });

    if (!deleted) {
      return res.status(404).json({ message: "Эксперт не найден" });
    }

    await invalidateMarketListCache("consultations");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Full listing by id — search/filter return trimmed projections, so clients
// (mobile details screen) refetch the complete document here. Accepts either
// the Mongo _id or the numeric public id.
export const getMarketListingById = async (req, res) => {
  try {
    const { listingType, id } = req.params;
    const model = getMarketModelByKind(listingType);
    if (!model) {
      return res.status(400).json({ message: "Неизвестный тип объявления" });
    }

    const or = [];
    if (/^[0-9a-fA-F]{24}$/.test(id)) or.push({ _id: id });
    const numericId = Number(id);
    if (Number.isFinite(numericId)) or.push({ id: numericId });
    if (!or.length) {
      return res.status(400).json({ message: "Некорректный id" });
    }

    const listing = await model.findOne(buildAndQuery([{ $or: or }, moderationApprovedFilter])).lean();
    if (!listing) {
      return res.status(404).json({ message: "Объявление не найдено" });
    }
    return res.status(200).json(listing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// SEARCH контроллеры

// Normalizes search/filter query params to the names the clause builders read.
// The mobile client sends priceMin/priceMax/region-style names, the web
// historically sent minPrice/maxPrice/location — accept both. `type` is
// deliberately stripped: in the builders it means offerType («Продажа»), while
// on these endpoints it selects the listing category.
const buildSearchFilterParams = (query) => {
  const { type, sortBy, minPrice, maxPrice, location, category, mine, page, limit, ...rest } = query;
  const fp = { ...rest };
  if (fp.priceMin == null && minPrice != null) fp.priceMin = minPrice;
  if (fp.priceMax == null && maxPrice != null) fp.priceMax = maxPrice;
  if (fp.region == null && location != null) fp.region = location;
  return fp;
};

// Price clause for the flat-price collections (services/tuning/consultations).
// Only added when the caller actually constrained the price, so listings with
// no price keep the old behavior of passing an unconstrained query.
const buildPriceClause = (field, min, max) => {
  const cl = {};
  if (min > 0) cl.$gte = min;
  if (Number.isFinite(max)) cl.$lte = max;
  return Object.keys(cl).length ? { [field]: cl } : null;
};

const SEARCH_RESULT_LIMIT = 300;

export const searchMarketListings = async (req, res) => {
  try {
    const { q, type, sortBy } = req.query;
    const fp = buildSearchFilterParams(req.query);
    const searchQuery = String(q || "").trim();
    const listingType = String(type || "").toLowerCase();
    const min = Number(fp.priceMin) || 0;
    const max = Number(fp.priceMax) || Infinity;
    const base = buildAndQuery([moderationApprovedFilter, notExpiredFilter()]);
    const regionClause = fp.region
      ? { location: new RegExp(escapeRe(fp.region), "i") }
      : null;
    const textClause = (fields) => searchQuery
      ? { $or: fields.map((f) => ({ [f]: new RegExp(escapeRe(searchQuery), "i") })) }
      : null;

    const results = [];

    // Search parts — full filter support via the shared clause builder
    // (brand/model/year/price/partGroup/region + text query).
    if (!listingType || listingType === "parts") {
      const parts = await MarketPartListing.find(buildAndQuery(buildPartFilterClauses(fp, base)))
        .select("id title price image type brand model year location region partGroup partCategory partCategoryKey")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...parts.map((p) => ({ ...p, listingType: "part" })));
    }

    // Search cars — full filter support (brand/model/year/mileage/fuel/
    // gearbox/bodyType/driveType/price/region + text query).
    if (!listingType || listingType === "cars") {
      const cars = await MarketCarListing.find(buildAndQuery(buildCarFilterClauses(fp, base)))
        .select("id title price image type brand model year location region registrationPlace")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...cars.map((c) => ({ ...c, listingType: "car" })));
    }

    // Search car services
    if (!listingType || listingType === "car-services") {
      const query = buildAndQuery([base, textClause(["title", "category"]), regionClause, buildPriceClause("price", min, max)]);
      const services = await MarketCarServiceListing.find(query)
        .select("id title price image category location")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...services.map((s) => ({ ...s, listingType: "car-service" })));
    }

    // Search auto tuning
    if (!listingType || listingType === "auto-tuning") {
      const query = buildAndQuery([base, textClause(["title", "category"]), regionClause, buildPriceClause("price", min, max)]);
      const tuning = await MarketAutoTuningListing.find(query)
        .select("id title price image category location badge")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...tuning.map((t) => ({ ...t, listingType: "auto-tuning" })));
    }

    // Search dry cleaning (was missing entirely — «Химчистка» always came back empty)
    if (!listingType || listingType === "dry-cleaning") {
      const query = buildAndQuery([base, textClause(["title", "category"]), regionClause, buildPriceClause("price", min, max)]);
      const cleaning = await MarketDryCleaningListing.find(query)
        .select("id title price image category location badge")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...cleaning.map((d) => ({ ...d, listingType: "dry-cleaning" })));
    }

    // Search consultations
    if (!listingType || listingType === "consultations") {
      const query = buildAndQuery([base, textClause(["name", "specialties"]), regionClause, buildPriceClause("hourlyRate", min, max)]);
      const experts = await MarketConsultationExpert.find(query)
        .select("id name avatar isVerified hourlyRate location specialties")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...experts.map((e) => ({ ...e, listingType: "consultation" })));
    }

    // Apply sorting
    if (sortBy === "price_asc") {
      results.sort((a, b) => {
        const aPrice = getListingPriceValue(a);
        const bPrice = getListingPriceValue(b);
        return aPrice - bPrice;
      });
    } else if (sortBy === "price_desc") {
      results.sort((a, b) => {
        const aPrice = getListingPriceValue(a);
        const bPrice = getListingPriceValue(b);
        return bPrice - aPrice;
      });
    } else if (sortBy === "newest") {
      results.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (sortBy === "oldest") {
      results.sort((a, b) => (a.id || 0) - (b.id || 0));
    }

    return res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const filterMarketListings = async (req, res) => {
  try {
    const { type, category, sortBy } = req.query;
    const fp = buildSearchFilterParams(req.query);
    const listingType = String(type || "").toLowerCase();
    const min = Number(fp.priceMin) || 0;
    const max = Number(fp.priceMax) || Infinity;
    const categoryValue = String(category || "").trim();
    const base = buildAndQuery([moderationApprovedFilter, notExpiredFilter()]);
    const regionClause = fp.region
      ? { location: new RegExp(escapeRe(fp.region), "i") }
      : null;

    const results = [];

    // Filter parts — full filter support via the shared clause builder.
    if (!listingType || listingType === "parts") {
      const clauses = buildPartFilterClauses(fp, base);
      if (categoryValue) {
        const re = new RegExp(escapeRe(categoryValue), "i");
        clauses.push({
          $or: [
            { partGroup: re },
            { partCategory: re },
            { partCategoryKey: re },
            { brand: re },
            { model: re },
          ],
        });
      }
      const parts = await MarketPartListing.find(buildAndQuery(clauses))
        .select("id title price image type brand model year location region partGroup partCategory partCategoryKey")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...parts.map((p) => ({ ...p, listingType: "part" })));
    }

    // Filter cars — full filter support via the shared clause builder.
    if (!listingType || listingType === "cars") {
      const clauses = buildCarFilterClauses(fp, base);
      if (categoryValue) clauses.push({ type: new RegExp(escapeRe(categoryValue), "i") });
      const cars = await MarketCarListing.find(buildAndQuery(clauses))
        .select("id title price image type brand model year location region")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...cars.map((c) => ({ ...c, listingType: "car" })));
    }

    // Filter car services
    if (!listingType || listingType === "car-services") {
      const categoryClause = categoryValue ? { category: new RegExp(escapeRe(categoryValue), "i") } : null;
      const query = buildAndQuery([base, regionClause, categoryClause, buildPriceClause("price", min, max)]);
      const services = await MarketCarServiceListing.find(query)
        .select("id title price image category location")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...services.map((s) => ({ ...s, listingType: "car-service" })));
    }

    // Filter auto tuning
    if (!listingType || listingType === "auto-tuning") {
      const categoryClause = categoryValue ? { category: new RegExp(escapeRe(categoryValue), "i") } : null;
      const query = buildAndQuery([base, regionClause, categoryClause, buildPriceClause("price", min, max)]);
      const tuning = await MarketAutoTuningListing.find(query)
        .select("id title price image category location")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...tuning.map((t) => ({ ...t, listingType: "auto-tuning" })));
    }

    // Filter dry cleaning (was missing entirely)
    if (!listingType || listingType === "dry-cleaning") {
      const categoryClause = categoryValue ? { category: new RegExp(escapeRe(categoryValue), "i") } : null;
      const query = buildAndQuery([base, regionClause, categoryClause, buildPriceClause("price", min, max)]);
      const cleaning = await MarketDryCleaningListing.find(query)
        .select("id title price image category location badge")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...cleaning.map((d) => ({ ...d, listingType: "dry-cleaning" })));
    }

    // Filter consultations
    if (!listingType || listingType === "consultations") {
      const categoryClause = categoryValue ? { specialties: new RegExp(escapeRe(categoryValue), "i") } : null;
      const query = buildAndQuery([base, regionClause, categoryClause, buildPriceClause("hourlyRate", min, max)]);
      const experts = await MarketConsultationExpert.find(query)
        .select("id name avatar isVerified hourlyRate location specialties")
        .sort({ createdAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      results.push(...experts.map((e) => ({ ...e, listingType: "consultation" })));
    }

    // Apply sorting
    if (sortBy === "price_asc") {
      results.sort((a, b) => {
        const aPrice = getListingPriceValue(a);
        const bPrice = getListingPriceValue(b);
        return aPrice - bPrice;
      });
    } else if (sortBy === "price_desc") {
      results.sort((a, b) => {
        const aPrice = getListingPriceValue(a);
        const bPrice = getListingPriceValue(b);
        return bPrice - aPrice;
      });
    } else if (sortBy === "newest") {
      results.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (sortBy === "oldest") {
      results.sort((a, b) => (a.id || 0) - (b.id || 0));
    }

    return res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
