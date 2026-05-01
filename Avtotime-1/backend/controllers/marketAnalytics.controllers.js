import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import User from "../models/user.model.js";
import { getEffectivePlan, getPlanLimits } from "../config/planLimits.js";

const LISTING_MODELS = {
  cars: MarketCarListing,
  parts: MarketPartListing,
};

const getModelByType = (type) => LISTING_MODELS[String(type || "").toLowerCase()] || null;

const todayKey = (now = new Date()) => {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const lastNDayKeys = (n, now = new Date()) => {
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(todayKey(dt));
  }
  return keys;
};

const requireAnalytics = async (userId) => {
  const user = await User.findById(userId).select("plan planExpiresAt").lean();
  if (!user) return { allowed: false, reason: "USER_NOT_FOUND" };
  const effective = getEffectivePlan(user.plan, user.planExpiresAt);
  const limits = getPlanLimits(effective);
  if (!limits.analyticsEnabled) {
    return { allowed: false, reason: "ANALYTICS_DISABLED", effectivePlan: effective };
  }
  return { allowed: true, effectivePlan: effective };
};

const incCounter = async (Model, listingId, kind) => {
  const day = todayKey();
  const totalField = kind === "view" ? "viewsTotal" : "leadsTotal";
  const dayField = kind === "view" ? "viewsByDay" : "leadsByDay";
  await Model.updateOne(
    { id: Number(listingId) },
    { $inc: { [totalField]: 1, [`${dayField}.${day}`]: 1 } },
  );
};

export const recordListingView = async (req, res) => {
  try {
    const Model = getModelByType(req.params.type);
    if (!Model) return res.status(404).json({ message: "Unknown listing type" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

    const exists = await Model.exists({ id });
    if (!exists) return res.status(404).json({ message: "Listing not found" });

    await incCounter(Model, id, "view");
    return res.json({ ok: true });
  } catch (err) {
    console.error("recordListingView:", err?.message || err);
    return res.status(500).json({ message: "Failed to record view" });
  }
};

export const recordListingLead = async (req, res) => {
  try {
    const Model = getModelByType(req.params.type);
    if (!Model) return res.status(404).json({ message: "Unknown listing type" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

    const exists = await Model.exists({ id });
    if (!exists) return res.status(404).json({ message: "Listing not found" });

    await incCounter(Model, id, "lead");
    return res.json({ ok: true });
  } catch (err) {
    console.error("recordListingLead:", err?.message || err);
    return res.status(500).json({ message: "Failed to record lead" });
  }
};

const dayMapToObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value === "object") return value;
  return {};
};

const buildDailySeries = (listing, days) => {
  const views = dayMapToObject(listing.viewsByDay);
  const leads = dayMapToObject(listing.leadsByDay);
  return days.map((day) => ({
    day,
    views: Number(views[day]) || 0,
    leads: Number(leads[day]) || 0,
  }));
};

const sumSeries = (series) =>
  series.reduce(
    (acc, point) => {
      acc.views += point.views;
      acc.leads += point.leads;
      return acc;
    },
    { views: 0, leads: 0 },
  );

export const getMyAnalyticsSummary = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const access = await requireAnalytics(userId);
    if (!access.allowed) {
      return res.status(403).json({
        message: "Аналитика доступна на тарифах Pro и Business.",
        code: access.reason,
      });
    }

    const days = lastNDayKeys(7);

    const [cars, parts] = await Promise.all([
      MarketCarListing.find({ author: userId })
        .select("id title viewsTotal leadsTotal viewsByDay leadsByDay createdAt image")
        .sort({ createdAt: -1 })
        .lean(),
      MarketPartListing.find({ author: userId })
        .select("id title viewsTotal leadsTotal viewsByDay leadsByDay createdAt image")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const buildEntry = (kind) => (listing) => {
      const series = buildDailySeries(listing, days);
      const last7 = sumSeries(series);
      return {
        kind,
        id: listing.id,
        _id: String(listing._id),
        title: listing.title,
        image: listing.image || "",
        viewsTotal: Number(listing.viewsTotal) || 0,
        leadsTotal: Number(listing.leadsTotal) || 0,
        last7DaysViews: last7.views,
        last7DaysLeads: last7.leads,
        series,
      };
    };

    const listings = [
      ...cars.map(buildEntry("cars")),
      ...parts.map(buildEntry("parts")),
    ];

    const totals = listings.reduce(
      (acc, l) => {
        acc.viewsTotal += l.viewsTotal;
        acc.leadsTotal += l.leadsTotal;
        acc.last7DaysViews += l.last7DaysViews;
        acc.last7DaysLeads += l.last7DaysLeads;
        return acc;
      },
      { viewsTotal: 0, leadsTotal: 0, last7DaysViews: 0, last7DaysLeads: 0 },
    );

    const dailyTotals = days.map((day) => {
      const sum = listings.reduce(
        (acc, l) => {
          const point = l.series.find((p) => p.day === day);
          if (point) {
            acc.views += point.views;
            acc.leads += point.leads;
          }
          return acc;
        },
        { views: 0, leads: 0 },
      );
      return { day, ...sum };
    });

    return res.json({
      effectivePlan: access.effectivePlan,
      days,
      dailyTotals,
      totals,
      listings,
    });
  } catch (err) {
    console.error("getMyAnalyticsSummary:", err?.message || err);
    return res.status(500).json({ message: "Failed to load analytics" });
  }
};
