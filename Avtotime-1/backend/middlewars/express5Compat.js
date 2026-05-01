export function makeReqQueryWritable(req, _res, next) {
  try {
    const query = req.query;
    if (!query) return next();

    const desc = Object.getOwnPropertyDescriptor(req, "query");
    const isWritableDataProp = Boolean(desc && "value" in desc && desc.writable);
    if (isWritableDataProp) return next();

    Object.defineProperty(req, "query", {
      value: query,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } catch {
    // If anything goes wrong, don't block the request pipeline.
  }
  next();
}

