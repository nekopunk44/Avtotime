import { getAllowedOrigins } from '../config/origins.js';

const matchOrigin = (origin, allowed) => {
  if (allowed instanceof RegExp) return allowed.test(origin);
  return allowed === origin;
};

export const csrfOriginCheck = (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    return res.status(403).json({ message: 'Forbidden: missing Origin header' });
  }
  const allowed = getAllowedOrigins();
  if (!allowed.some((a) => matchOrigin(origin, a))) {
    return res.status(403).json({ message: 'Forbidden: invalid origin' });
  }
  next();
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The repo-wide CSRF floor, mounted on all of /api.
 *
 * The auth cookie ships with SameSite=None, so the browser attaches it to
 * requests started by ANY site, and `cors()` is no defence: it only withholds
 * response headers, the request itself still executes — which is all a CSRF
 * needs. Before this, only two payment routes checked Origin; every other
 * mutating endpoint (change password, delete profile, follow, post) was open.
 *
 * The rule: a state-changing request that carries a browser Origin must carry
 * an allowed one. Requests with no Origin at all pass — that is mobile apps,
 * curl and Stripe's webhooks, none of which hold a browser's cookie jar. The
 * literal string "null" (sandboxed iframes — a standard CSRF vehicle) is not
 * in any allowlist, so it fails the same way any foreign origin does.
 *
 * The stricter per-route csrfOriginCheck above stays on the payment routes:
 * where money moves, a missing Origin is also refused.
 */
export const rejectForgedOrigin = (req, res, next) => {
  if (!MUTATING.has(req.method)) return next();

  const origin = req.headers.origin;
  if (origin === undefined) return next();

  const allowed = getAllowedOrigins();
  if (!allowed.some((a) => matchOrigin(origin, a))) {
    return res.status(403).json({ message: "Forbidden: invalid origin", requestId: req?.id });
  }
  return next();
};
