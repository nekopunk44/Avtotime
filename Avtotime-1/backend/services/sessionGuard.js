import User from "../models/user.model.js";
import { getCachedAuthSession, setCachedAuthSession } from "./authSessionCache.js";

/**
 * The one answer to "is this token still good?" — shared by the HTTP middleware
 * and the socket handshake.
 *
 * Before this existed the two paths disagreed: HTTP checked tokenVersion and
 * the ban flag, while the socket handshake stopped at jwt.verify — so a
 * password change or a ban closed the REST API to the old token but left it a
 * perfectly working realtime channel: messages, presence, notifications.
 *
 * Cache-first for the same reason isAuth was: this runs on every authenticated
 * request. `fromCache: false` tells the HTTP caller the user document was
 * actually read, so it may do its throttled lastSeenAt update.
 */
export const checkSession = async (userId, tokenVersionInJwt) => {
  const cached = await getCachedAuthSession(userId);
  if (cached) {
    if ((cached.tokenVersion ?? 0) !== tokenVersionInJwt) {
      return { ok: false, reason: "stale", fromCache: true };
    }
    if (cached.isBanned) {
      return { ok: false, reason: "banned", banReason: cached.banReason ?? null, fromCache: true };
    }
    return { ok: true, fromCache: true };
  }

  const user = await User.findById(userId).select("tokenVersion lastSeenAt isBanned banReason");
  if (!user) {
    return { ok: false, reason: "missing", fromCache: false };
  }
  if ((user.tokenVersion ?? 0) !== tokenVersionInJwt) {
    return { ok: false, reason: "stale", fromCache: false };
  }
  if (user.isBanned) {
    return { ok: false, reason: "banned", banReason: user.banReason ?? null, fromCache: false };
  }

  await setCachedAuthSession(userId, {
    tokenVersion: user.tokenVersion ?? 0,
    isBanned: user.isBanned ?? false,
    banReason: user.banReason ?? null,
  });

  return { ok: true, fromCache: false, lastSeenAt: user.lastSeenAt ?? null };
};
