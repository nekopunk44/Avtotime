const normalizeServerUrl = (raw) => {
  const fallback = typeof window !== "undefined" ? window.location.origin : "http://localhost:8000";
  if (typeof raw !== "string") return fallback;

  let value = raw.trim();
  if (!value) return fallback;

  // Some envs are configured as ":8000" (port only) — normalize to an origin.
  if (value.startsWith(":")) value = `http://localhost${value}`;
  if (/^\d+$/.test(value)) value = `http://localhost:${value}`;

  // Remove trailing slashes and accidental "/api" suffix (we append "/api" in requests).
  value = value.replace(/\/+$/, "");
  value = value.replace(/\/api$/, "");

  // If a user provided "localhost:8000" (without protocol), add it.
  if (!/^https?:\/\//i.test(value) && /^[\w.-]+:\d+/.test(value)) {
    value = `http://${value}`;
  }

  return value || fallback;
};

export const serverURL = normalizeServerUrl(import.meta.env.VITE_API_URL);

export default serverURL;
