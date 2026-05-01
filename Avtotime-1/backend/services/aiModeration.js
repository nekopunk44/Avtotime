import mongoose from "mongoose";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { moderateTextAndImagesLocal } from "./localModeration.js";

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());

export const isAiModerationEnabled = () => truthy(process.env.AI_MODERATION_ENABLED);

const isModerationDebugEnabled = () => truthy(process.env.AI_MODERATION_DEBUG);

const logModerationDebug = (message, payload) => {
  if (!isModerationDebugEnabled()) return;
  try {
    // Avoid noisy logs: keep payload compact.
    // eslint-disable-next-line no-console
    console.log(`[moderation] ${message}`, payload ?? "");
  } catch {
    // eslint-disable-next-line no-console
    console.log(`[moderation] ${message}`);
  }
};

export const getAiModerationProvider = () => {
  const configured = String(process.env.AI_MODERATION_PROVIDER || "").trim().toLowerCase();
  if (configured === "openai" || configured === "local") return configured;
  return String(process.env.OPENAI_API_KEY || "").trim() ? "openai" : "local";
};

const getOpenAiBaseUrl = () => {
  const raw = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const buildReasons = (categories) => {
  if (!categories || typeof categories !== "object") return [];
  return Object.entries(categories)
    .filter(([, flagged]) => Boolean(flagged))
    .map(([category]) => category);
};

const getLocalModelDirUrl = () => {
  const configured = String(process.env.AI_MODERATION_NSFWJS_MODEL_DIR || "").trim();
  if (configured) return pathToFileURL(path.resolve(configured) + path.sep).toString();
  const here = path.dirname(fileURLToPath(import.meta.url));
  return pathToFileURL(path.resolve(here, "..", "moderation", "models", "nsfwjs") + path.sep).toString();
};

const moderateWithOpenAi = async ({ text, imageUrls }) => {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("AI moderation provider is openai but OPENAI_API_KEY is missing");
  }

  const normalizedText = typeof text === "string" ? text.trim() : "";
  const urls = Array.isArray(imageUrls) ? imageUrls : [];
  const maxImages = Number(process.env.AI_MODERATION_MAX_IMAGES) || 5;
  const limited = urls
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter(Boolean)
    .slice(0, maxImages);

  const input = [];
  if (normalizedText) {
    input.push({ type: "text", text: normalizedText });
  }
  for (const url of limited) {
    input.push({ type: "image_url", image_url: { url } });
  }

  if (input.length === 0) {
    return { skipped: false, flagged: false, reasons: [], provider: "openai", categories: {}, scores: {} };
  }

  logModerationDebug("openai request", {
    model: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest",
    text: normalizedText ? `${normalizedText.slice(0, 200)}${normalizedText.length > 200 ? "…" : ""}` : "",
    images: limited.length,
  });

  const response = await fetch(`${getOpenAiBaseUrl()}/moderations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest",
      input,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI moderation failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`);
  }

  const data = await response.json();
  const result = Array.isArray(data?.results) ? data.results[0] : null;
  const flagged = Boolean(result?.flagged);
  const categories = result?.categories || {};
  const scores = result?.category_scores || {};
  const reasons = buildReasons(categories);

  logModerationDebug("openai response", {
    id: typeof data?.id === "string" ? data.id : null,
    model: typeof data?.model === "string" ? data.model : null,
    flagged,
    reasons,
  });

  return {
    skipped: false,
    flagged,
    reasons,
    provider: "openai",
    categories,
    scores,
    rawId: typeof data?.id === "string" ? data.id : null,
    rawModel: typeof data?.model === "string" ? data.model : null,
  };
};

const moderateWithLocal = async ({ text, imageUrls }) => {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  const urls = Array.isArray(imageUrls) ? imageUrls : [];
  const maxImages = Number(process.env.AI_MODERATION_MAX_IMAGES) || 5;
  const limited = urls
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter(Boolean)
    .slice(0, maxImages);

  const result = await moderateTextAndImagesLocal({
    text: normalizedText,
    imageUrls: limited,
    nsfwjsModelDirUrl: getLocalModelDirUrl(),
  });

  logModerationDebug("local result", {
    flagged: Boolean(result?.flagged),
    reasons: Array.isArray(result?.reasons) ? result.reasons : [],
  });

  return result;
};

export const moderateTextAndImages = async ({ text, imageUrls }) => {
  if (!isAiModerationEnabled()) {
    return { skipped: true, flagged: false, reasons: [], provider: null, categories: null, scores: null };
  }

  const provider = getAiModerationProvider();
  if (provider === "openai") return moderateWithOpenAi({ text, imageUrls });
  return moderateWithLocal({ text, imageUrls });
};

export const isMongoConnected = () => mongoose.connection?.readyState === 1;
