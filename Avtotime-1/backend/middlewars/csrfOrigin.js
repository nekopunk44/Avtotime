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
