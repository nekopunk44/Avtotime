// Development conveniences. Deliberately NOT trusted in production: the auth
// cookie is issued with SameSite=None there, so the browser attaches it to
// cross-site requests, and csrfOriginCheck is the thing standing in the way. An
// allowlist that always contains localhost means any page a developer (or an
// attacker) can get to run on the victim's machine passes that check.
const DEFAULT_ORIGINS = [
  /^http:\/\/localhost:(5173|3000|5174|5175)$/,
  "http://localhost:8000",
];

const normalizeOrigin = (origin) => {
  if (typeof origin !== "string") return origin;
  return origin.replace(/\/+$/, "");
};

const isProduction = () => process.env.NODE_ENV === "production";

let warnedAboutMissingOrigins = false;

export const getAllowedOrigins = () => {
  const raw = process.env.CLIENT_ORIGINS || process.env.FRONTEND_ORIGIN;
  const configured = String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  if (isProduction()) {
    if (configured.length) return dedupe(configured);

    // Nothing configured in production. Falling back to the localhost defaults
    // does not actually serve the site — its real origin is not in them either —
    // so this is a misconfiguration worth shouting about rather than a mode to
    // support silently.
    if (!warnedAboutMissingOrigins) {
      warnedAboutMissingOrigins = true;
      console.error(
        "[origins] NODE_ENV=production but neither CLIENT_ORIGINS nor FRONTEND_ORIGIN is set — " +
          "falling back to the localhost development allowlist, which will not serve the real site.",
      );
    }
    return DEFAULT_ORIGINS;
  }

  const merged = [...DEFAULT_ORIGINS, ...configured];
  return merged.length ? dedupe(merged) : DEFAULT_ORIGINS;
};

// Deduplicates string origins while keeping regex entries intact.
function dedupe(origins) {
  const seen = new Set();
  const unique = [];
  for (const origin of origins) {
    if (typeof origin !== "string") {
      unique.push(origin);
      continue;
    }
    if (seen.has(origin)) continue;
    seen.add(origin);
    unique.push(origin);
  }
  return unique;
}
