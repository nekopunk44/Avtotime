import { reportError } from "../services/errorReporter.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({ message: "Not Found", requestId: req?.id });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = Number.isFinite(err?.status) ? err.status : 500;
  const isServerFault = status >= 500;

  // A 4xx is the caller's problem and is not worth an alert. A 5xx is ours, and
  // used to disappear entirely: the old handler logged only when NODE_ENV was
  // not "production", which is exactly when it mattered.
  if (isServerFault) {
    reportError(err, {
      requestId: req?.id,
      method: req?.method,
      // The route pattern where express knows it, the path otherwise. Never the
      // query string: it carries search terms and ids that do not belong in a
      // log line or a third-party error tracker.
      path: req?.route?.path || req?.path,
      status,
      userId: req?.userId ? String(req.userId) : undefined,
    });
  }

  // A 5xx message can quote internals — driver errors, file paths, connection
  // strings. It is logged in full above and replaced here. Kept verbatim
  // outside production so local debugging is not made harder.
  const hideDetails = isServerFault && process.env.NODE_ENV === "production";
  const message = hideDetails ? "Server Error" : err?.message || "Server Error";

  res.status(status).json({ message, requestId: req?.id });
};
