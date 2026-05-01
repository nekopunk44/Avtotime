export const notFoundHandler = (req, res, next) => {
  res.status(404).json({ message: "Not Found" });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = Number.isFinite(err?.status) ? err.status : 500;
  const message = err?.message || "Server Error";

  if (process.env.NODE_ENV !== "production") {
    // Keep logs useful in dev; avoid leaking internals in production responses.
    console.error(err);
  }

  res.status(status).json({ message });
};

