import rateLimit from "express-rate-limit";

// Limits are resolved once, when this module is first imported — i.e. before any
// app instance is built. Anything that needs different ceilings (the test suite
// raises them via vitest.config.js `test.env`) must set the variables before the
// first import of this file.
const readLimit = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const API_RATE_LIMIT_PER_MINUTE = readLimit("RATE_LIMIT_PER_MINUTE", 600);
export const AUTH_RATE_LIMIT_PER_15_MIN = readLimit("AUTH_RATE_LIMIT_PER_15_MIN", 20);

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: API_RATE_LIMIT_PER_MINUTE,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: AUTH_RATE_LIMIT_PER_15_MIN,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many auth attempts, try again later." },
  skip: (req) => req.method === "OPTIONS",
});
