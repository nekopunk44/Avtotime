export const getAuthCookieName = () => {
  const fromEnv = process.env.AUTH_COOKIE_NAME || process.env.COOKIE_NAME;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();

  // In dev, scope auth cookies per backend port so that running multiple local servers
  // (or "new localhost" on another port) doesn't reuse an old session cookie.
  if (process.env.NODE_ENV !== "production") {
    const port = String(process.env.PORT || "8000").trim();
    return `token_${port || "8000"}`;
  }

  return "token";
};

