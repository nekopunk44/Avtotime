/**
 * Парсер ссылок на YouTube/Vimeo. Возвращает нормализованный embed-URL
 * или пустую строку, если ссылка не поддерживается.
 */
export const normalizeVideoUrl = (raw) => {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";

  let url;
  try {
    url = new URL(value);
  } catch {
    return "";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return "";

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube long form: youtube.com/watch?v=ID
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    if (id && /^[\w-]{6,}$/.test(id)) return `https://www.youtube.com/embed/${id}`;

    // youtube.com/embed/ID или youtube.com/shorts/ID
    const embedMatch = url.pathname.match(/^\/(embed|shorts)\/([\w-]{6,})/);
    if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[2]}`;
    return "";
  }

  // youtu.be/ID
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "");
    if (id && /^[\w-]{6,}$/.test(id)) return `https://www.youtube.com/embed/${id}`;
    return "";
  }

  // vimeo.com/12345
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const idMatch = url.pathname.match(/(\d{6,})/);
    if (idMatch) return `https://player.vimeo.com/video/${idMatch[1]}`;
    return "";
  }

  return "";
};
