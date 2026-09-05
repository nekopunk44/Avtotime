/**
 * One place that decides what happens to an error nobody else handled.
 *
 * Before this existed the production error handler logged nothing at all — the
 * `console.error` was behind `NODE_ENV !== "production"` — so a 500 in
 * production left no trace anywhere and the first report came from a user.
 *
 * Sentry is optional: without SENTRY_DSN nothing is loaded and errors are still
 * written to stdout as one JSON line per error, which is what the docker
 * json-file driver keeps. Setting the DSN is the only step needed to turn on
 * real error tracking.
 */
let sentry = null;
let initPromise = null;

const getDsn = () => process.env.SENTRY_DSN?.trim();

export const initErrorReporting = async () => {
  const dsn = getDsn();
  if (!dsn) return { enabled: false, reason: "no_dsn" };
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const Sentry = await import("@sentry/node");
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || "development",
        release: process.env.APP_RELEASE || undefined,
        // Off by default: tracing multiplies event volume and the free tier is
        // small. Raise deliberately when there is a latency question to answer.
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
        // The app already reports through reportError(), and the process-level
        // handlers in index.js exit on purpose; letting the SDK also install
        // its own handlers would duplicate events and fight that decision.
        registerEsmLoaderHooks: false,
      });
      sentry = Sentry;
      console.log("[errors] Sentry reporting enabled");
      return { enabled: true };
    } catch (error) {
      initPromise = null;
      console.error("[errors] Sentry init failed, falling back to logs:", error?.message || error);
      return { enabled: false, reason: "init_failed" };
    }
  })();

  return initPromise;
};

/**
 * `context` must stay free of request bodies, headers and anything secret: it
 * goes to stdout and, when enabled, to a third party.
 */
export const reportError = (error, context = {}) => {
  const entry = {
    ts: new Date().toISOString(),
    level: "error",
    message: error?.message || String(error),
    name: error?.name || "Error",
    stack: error?.stack,
    ...context,
  };

  // One line per error: the json-file log driver stores a line at a time, and a
  // multi-line stack would be split across records.
  console.error(JSON.stringify(entry));

  if (sentry) {
    try {
      sentry.captureException(error, { extra: context });
    } catch (reportingError) {
      console.error("[errors] capture failed:", reportingError?.message || reportingError);
    }
  }
};

/**
 * Gives the transport a bounded chance to deliver before the process exits.
 *
 * The fatal handlers report and then exit, and that last event is the most
 * valuable one there is — without a flush it dies in the buffer.
 */
export const flushErrors = async (timeoutMs = 2000) => {
  if (!sentry) return true;
  try {
    return await sentry.flush(timeoutMs);
  } catch {
    return false;
  }
};

// Test seam: lets a test assert the fallback path without a real DSN.
export const __resetErrorReporting = () => {
  sentry = null;
  initPromise = null;
};
