import jwt from "jsonwebtoken";
import { getAuthCookieName } from "../config/authCookie.js";

// Best-effort auth: sets req.userId when a valid JWT arrives via cookie (web)
// or Authorization: Bearer (mobile), and NEVER rejects the request. Use it on
// public endpoints that behave slightly differently for logged-in users, so
// controllers stop re-implementing cookie/bearer parsing by hand.
const optionalAuth = (req, _res, next) => {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.[getAuthCookieName()] || bearer;
    if (token) {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      if (verified?.userId) req.userId = verified.userId;
    }
  } catch {
    // Invalid/expired token on a public route is not an error.
  }
  next();
};

export default optionalAuth;
