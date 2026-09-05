import { randomUUID } from "node:crypto";

const HEADER = "x-request-id";

// Accepts an id from the proxy so one request can be followed across nginx and
// the app, but only a conservative shape: the value is echoed back in a header
// and written into logs, so an attacker must not be able to smuggle newlines or
// arbitrary length through it.
const isUsable = (value) => typeof value === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(value);

/**
 * Gives every request an id, exposes it on `req.id`, and echoes it back.
 *
 * Without it a production error in the logs cannot be tied to the request that
 * caused it, and a user reporting a failure has nothing to quote.
 */
export const requestId = (req, res, next) => {
  const incoming = req.headers[HEADER];
  req.id = isUsable(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
};
