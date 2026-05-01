import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 600),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_PER_15_MIN || 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many auth attempts, try again later." },
  skip: (req) => req.method === "OPTIONS",
});
