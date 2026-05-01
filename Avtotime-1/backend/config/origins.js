const DEFAULT_ORIGINS = [
  /^http:\/\/localhost:(5173|3000|5174|5175)$/,
  "http://localhost:8000",
];

const normalizeOrigin = (origin) => {
  if (typeof origin !== "string") return origin;
  return origin.replace(/\/+$/, "");
};

export const getAllowedOrigins = () => {
  const raw = process.env.CLIENT_ORIGINS || process.env.FRONTEND_ORIGIN;
  if (!raw) return DEFAULT_ORIGINS;

  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = [
    ...DEFAULT_ORIGINS,
    ...list.map(normalizeOrigin),
  ];

  // Deduplicate string origins while keeping regex entries intact
  const seen = new Set();
  const unique = [];
  for (const origin of merged) {
    if (typeof origin !== "string") {
      unique.push(origin);
      continue;
    }
    if (seen.has(origin)) continue;
    seen.add(origin);
    unique.push(origin);
  }

  return unique.length ? unique : DEFAULT_ORIGINS;
};
