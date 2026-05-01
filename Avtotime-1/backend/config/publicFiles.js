import path from "node:path";

export const buildPublicFileUrl = (req, file) => {
  if (!file) return "";

  const filename = path.basename(file.path || file.filename || "");
  if (!filename) return "";

  const host = req?.get?.("host");
  const protocol = req?.protocol || "http";
  if (!host) {
    return `/api/public/${encodeURIComponent(filename)}`;
  }

  return `${protocol}://${host}/api/public/${encodeURIComponent(filename)}`;
};

