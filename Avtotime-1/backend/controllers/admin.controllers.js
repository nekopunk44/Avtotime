import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import { MARKET_KINDS, MARKET_KIND_MODELS, getMarketModelByKind } from "../config/marketKinds.js";
import { checkIsAdminByUser } from "../config/admin.js";
import { createNotification } from "./notification.controllers.js";
import { invalidateAuthSession } from "../services/authSessionCache.js";

const getModelByKind = (kind) => getMarketModelByKind(kind);

export const getAdminStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select("userName email").lean();
    const isAdmin = checkIsAdminByUser({ ...user, _id: userId });
    return res.status(200).json({ ok: true, isAdmin, userId, userName: user?.userName || "" });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to check admin" });
  }
};

export const getPendingMarketListings = async (req, res) => {
  try {
    const kind = String(req.query?.type || "");
    const Model = getModelByKind(kind);
    if (!Model) {
      return res.status(400).json({ message: "Unknown listing type" });
    }

    const items = await Model.find({ moderationStatus: "pending" })
      .sort({ createdAt: -1 })
      .populate("author", "userName name profileImage")
      .lean();

    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load pending listings" });
  }
};

export const getAppealedMarketListings = async (req, res) => {
  try {
    const kind = String(req.query?.type || "");
    const Model = getModelByKind(kind);
    if (!Model) {
      return res.status(400).json({ message: "Unknown listing type" });
    }

    const items = await Model.find({ moderationStatus: "pending", appealedAt: { $ne: null } })
      .sort({ appealedAt: -1 })
      .populate("author", "userName name profileImage")
      .lean();

    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load appealed listings" });
  }
};

export const approveMarketListing = async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = getModelByKind(type);
    if (!Model) {
      return res.status(400).json({ message: "Unknown listing type" });
    }

    const updated = await Model.findByIdAndUpdate(
      id,
      {
        $set: {
          moderationStatus: "approved",
          moderationCheckedAt: new Date(),
          moderationProvider: "admin",
          moderationReasons: [],
        },
      },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (updated.author) {
      createNotification({
        recipient: updated.author,
        actor: req.userId,
        type: "listing_approved",
        title: "Объявление одобрено",
        description: "Ваше объявление прошло проверку модератора и теперь видно всем пользователям.",
        relatedId: updated._id,
        relatedType: "market_listing",
        link: "/market",
      }).catch(() => {});
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to approve" });
  }
};

export const rejectMarketListing = async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = getModelByKind(type);
    if (!Model) {
      return res.status(400).json({ message: "Unknown listing type" });
    }

    const reasons = Array.isArray(req.body?.reasons)
      ? req.body.reasons.map((r) => String(r || "").trim()).filter(Boolean)
      : typeof req.body?.reason === "string"
        ? [req.body.reason.trim()].filter(Boolean)
        : [];

    const updated = await Model.findByIdAndUpdate(
      id,
      {
        $set: {
          moderationStatus: "rejected",
          moderationCheckedAt: new Date(),
          moderationProvider: "admin",
          moderationReasons: reasons,
        },
      },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (updated.author) {
      const reasonText = reasons.length
        ? `Причина: ${reasons.join(", ")}.`
        : "Причина не указана.";
      createNotification({
        recipient: updated.author,
        actor: req.userId,
        type: "listing_rejected",
        title: "Объявление отклонено модератором",
        description: `Ваше объявление не прошло проверку. ${reasonText} Вы можете подать апелляцию.`,
        relatedId: updated._id,
        relatedType: "market_listing",
        link: "/market",
      }).catch(() => {});
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to reject" });
  }
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const isoDate = (d) => {
  if (!(d instanceof Date)) return "";
  return d.toISOString().slice(0, 10);
};

const buildDailySeries = (days, byDateMap, key) =>
  days.map((date) => ({
    date,
    [key]: Number(byDateMap.get(date) || 0) || 0,
  }));

export const getAdminStats = async (req, res) => {
  try {
    const range = String(req.query?.range || "week").toLowerCase();
    const allowedRanges = new Set(["day", "week", "month", "half-year", "year"]);
    const safeRange = allowedRanges.has(range) ? range : "week";

    const todayStart = startOfToday();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const seriesConfig = (() => {
      switch (safeRange) {
        case "day":
          return { bucket: "hour", points: 24, since: since24h, label: "День" };
        case "month":
          return { bucket: "day", points: 30, since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), label: "Месяц" };
        case "half-year":
          return { bucket: "week", points: 26, since: new Date(Date.now() - 182 * 24 * 60 * 60 * 1000), label: "Полгода" };
        case "year":
          return { bucket: "month", points: 12, since: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), label: "Год" };
        case "week":
        default:
          return { bucket: "day", points: 7, since: since7d, label: "Неделя" };
      }
    })();

    const formatForBucket = (bucket) => {
      switch (bucket) {
        case "hour":
          return "%Y-%m-%d %H";
        case "week":
          // week of year (Sunday-based). Keep in sync with series key generation below.
          return "%Y-%U";
        case "month":
          return "%Y-%m";
        case "day":
        default:
          return "%Y-%m-%d";
      }
    };

    const seriesKeys = (() => {
      const out = [];
      const now = new Date();
      const bucket = seriesConfig.bucket;

      if (bucket === "hour") {
        const end = new Date(now);
        end.setMinutes(0, 0, 0);
        for (let i = seriesConfig.points - 1; i >= 0; i -= 1) {
          const d = new Date(end.getTime() - i * 60 * 60 * 1000);
          out.push(`${isoDate(d)} ${String(d.getHours()).padStart(2, "0")}`);
        }
        return out;
      }

      if (bucket === "day") {
        const end = new Date(todayStart);
        for (let i = seriesConfig.points - 1; i >= 0; i -= 1) {
          const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
          out.push(isoDate(d));
        }
        return out;
      }

      if (bucket === "month") {
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        for (let i = seriesConfig.points - 1; i >= 0; i -= 1) {
          const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
          out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
        return out;
      }

      // week
      // MongoDB `$dateToString` defaults to UTC unless `timezone` is provided.
      // Use UTC computations here so our generated keys match `%Y-%U` output.
      const end = new Date();
      end.setUTCHours(0, 0, 0, 0);
      // align to start of week (Sun) to match %U behavior
      end.setUTCDate(end.getUTCDate() - end.getUTCDay());
      for (let i = seriesConfig.points - 1; i >= 0; i -= 1) {
        const d = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const year = d.getUTCFullYear();
        const yearStartUtc = Date.UTC(year, 0, 1);
        const dayUtc = Date.UTC(year, d.getUTCMonth(), d.getUTCDate());
        const daysSinceYearStart = Math.floor((dayUtc - yearStartUtc) / (24 * 60 * 60 * 1000));
        const yearStartDay = new Date(yearStartUtc).getUTCDay();
        const weekNo = Math.floor((daysSinceYearStart + yearStartDay) / 7); // %U style
        out.push(`${year}-${String(weekNo).padStart(2, "0")}`);
      }
      return out;
    })();

    const [
      totalUsers,
      newUsersToday,
      newUsers7d,
      activeUsers24h,
      activeUsers7d,
      usersDailyAgg,
    ] = await Promise.all([
      User.estimatedDocumentCount(),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: since7d } }),
      User.countDocuments({ lastSeenAt: { $gte: since24h } }),
      User.countDocuments({ lastSeenAt: { $gte: since7d } }),
      User.aggregate([
        { $match: { createdAt: { $gte: seriesConfig.since } } },
        {
          $group: {
            _id: { $dateToString: { format: formatForBucket(seriesConfig.bucket), date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const usersDailyMap = new Map();
    for (const row of usersDailyAgg || []) {
      usersDailyMap.set(String(row?._id || ""), Number(row?.count || 0) || 0);
    }

    // Every kind from the shared registry: the local copy this replaced was
    // missing "parts", so the section was absent from the counters, from the
    // pending total and from the charts.
    const kinds = MARKET_KINDS;

    const listingsByType = {};
    let listingsTotal = 0;
    let listingsNewToday = 0;
    let listingsPending = 0;
    const listingsDailyMap = new Map();

    // Per-type counters, all kinds in flight at once: sequentially this was
    // six round trips per kind, and adding "parts" made the wait longer still.
    const perKind = await Promise.all(
      kinds.map(async ({ key, Model }) => {
        const [total, newToday, pending, approved, rejected, dailyAgg] = await Promise.all([
          Model.estimatedDocumentCount(),
          Model.countDocuments({ createdAt: { $gte: todayStart } }),
          Model.countDocuments({ moderationStatus: "pending" }),
          Model.countDocuments({ moderationStatus: "approved" }),
          Model.countDocuments({ moderationStatus: "rejected" }),
          Model.aggregate([
            { $match: { createdAt: { $gte: seriesConfig.since } } },
            {
              $group: {
                _id: { $dateToString: { format: formatForBucket(seriesConfig.bucket), date: "$createdAt" } },
                count: { $sum: 1 },
              },
            },
          ]),
        ]);
        return { key, total, newToday, pending, approved, rejected, dailyAgg };
      }),
    );

    for (const { key, total, newToday, pending, approved, rejected, dailyAgg } of perKind) {
      listingsByType[key] = {
        total: Number(total || 0) || 0,
        newToday: Number(newToday || 0) || 0,
        pending: Number(pending || 0) || 0,
        approved: Number(approved || 0) || 0,
        rejected: Number(rejected || 0) || 0,
      };

      listingsTotal += Number(total || 0) || 0;
      listingsNewToday += Number(newToday || 0) || 0;
      listingsPending += Number(pending || 0) || 0;

      for (const row of dailyAgg || []) {
        const date = String(row?._id || "");
        const count = Number(row?.count || 0) || 0;
        if (!date) continue;
        listingsDailyMap.set(date, (Number(listingsDailyMap.get(date) || 0) || 0) + count);
      }
    }

    const daily = seriesKeys.map((key) => ({
      date: key,
      newUsers: Number(usersDailyMap.get(key) || 0) || 0,
      newListings: Number(listingsDailyMap.get(key) || 0) || 0,
    }));

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      range: safeRange,
      rangeLabel: seriesConfig.label,
      bucket: seriesConfig.bucket,
      users: {
        total: Number(totalUsers || 0) || 0,
        newToday: Number(newUsersToday || 0) || 0,
        new7d: Number(newUsers7d || 0) || 0,
        active24h: Number(activeUsers24h || 0) || 0,
        active7d: Number(activeUsers7d || 0) || 0,
      },
      listings: {
        total: Number(listingsTotal || 0) || 0,
        newToday: Number(listingsNewToday || 0) || 0,
        pending: Number(listingsPending || 0) || 0,
        byType: listingsByType,
      },
      daily,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load admin stats" });
  }
};

export const getAdminUsersList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const search = String(req.query.search || "").trim();

    const filter = search
      ? { $or: [
          { userName: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ] }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("_id userName name email profileImage plan isAdmin createdAt lastSeenAt followers following posts loops")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const requestingUser = await User.findById(req.userId).select("userName email isAdmin").lean();
    const usersWithAdminFlag = users.map((u) => ({
      ...u,
      isAdmin: u.isAdmin === true || checkIsAdminByUser({ ...u }),
    }));

    return res.status(200).json({ ok: true, users: usersWithAdminFlag, total, page, limit });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load users" });
  }
};

export const getAdminUserStats = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select("_id userName name email profileImage plan isAdmin createdAt lastSeenAt followers following posts loops bio profession location")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    // Shared registry, so "parts" is counted here too — the local list this
    // replaced left it out.
    const listingModels = MARKET_KIND_MODELS;

    const [postsCount, listingsCounts] = await Promise.all([
      Post.countDocuments({ author: id }),
      Promise.all(listingModels.map((M) => M.countDocuments({ author: id }))),
    ]);

    const totalListings = listingsCounts.reduce((a, b) => a + b, 0);

    return res.status(200).json({
      ok: true,
      user: {
        ...user,
        isAdmin: user.isAdmin === true || checkIsAdminByUser({ ...user }),
      },
      stats: {
        posts: postsCount,
        loops: Array.isArray(user.loops) ? user.loops.length : 0,
        listings: totalListings,
        followers: Array.isArray(user.followers) ? user.followers.length : 0,
        following: Array.isArray(user.following) ? user.following.length : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load user stats" });
  }
};

export const grantAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.userId)) {
      return res.status(400).json({ message: "Нельзя изменить права своего аккаунта" });
    }
    const user = await User.findByIdAndUpdate(id, { isAdmin: true }, { new: true })
      .select("_id userName name email isAdmin").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to grant admin" });
  }
};

export const revokeAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.userId)) {
      return res.status(400).json({ message: "Нельзя изменить права своего аккаунта" });
    }
    const user = await User.findByIdAndUpdate(id, { isAdmin: false }, { new: true })
      .select("_id userName name email isAdmin").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to revoke admin" });
  }
};

export const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.userId)) {
      return res.status(400).json({ message: "Нельзя заблокировать свой аккаунт" });
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : null;
    const user = await User.findByIdAndUpdate(
      id,
      { isBanned: true, banReason: reason || null, bannedAt: new Date() },
      { new: true }
    ).select("_id userName name email isBanned banReason bannedAt").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    await invalidateAuthSession(String(id)).catch(() => {});
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to ban user" });
  }
};

export const unbanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(
      id,
      { isBanned: false, banReason: null, bannedAt: null },
      { new: true }
    ).select("_id userName name email isBanned").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    await invalidateAuthSession(String(id)).catch(() => {});
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to unban user" });
  }
};
