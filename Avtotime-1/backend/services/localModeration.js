import { setTimeout as delay } from "timers/promises";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());

const buildTextFindings = (text) => {
  const normalized = typeof text === "string" ? text : "";
  const findings = [];

  const urlRegex = /\b(?:https?:\/\/|www\.)\S+/i;
  if (urlRegex.test(normalized)) findings.push("text:link");

  // Very rough phone/contacts detection (7+ digits with optional separators)
  const phoneRegex = /(?:\+?\d[\s\-().]*){7,}\d/;
  if (phoneRegex.test(normalized)) findings.push("text:phone");

  // Custom banned words (comma-separated)
  const bannedRaw = String(process.env.AI_MODERATION_BANNED_WORDS || "").trim();
  if (bannedRaw) {
    const banned = bannedRaw
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    const lower = normalized.toLowerCase();
    for (const word of banned) {
      if (word && lower.includes(word)) {
        findings.push(`text:banned:${word}`);
      }
    }
  }

  return findings;
};

const fetchWithTimeout = async (url, { timeoutMs }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const bufferFromDataUrl = (dataUrl) => {
  if (typeof dataUrl !== "string") return null;
  if (!dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);
  try {
    return isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
  } catch {
    return null;
  }
};

let nsfwRuntime = null;
const loadNsfwRuntime = async () => {
  if (nsfwRuntime) return nsfwRuntime;

  // Optional deps; allow installs to skip them.
  let tf;
  let nsfwjs;
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    tf = await import("@tensorflow/tfjs-node");
    // eslint-disable-next-line import/no-extraneous-dependencies
    nsfwjs = await import("nsfwjs");
    nsfwRuntime = { ok: true, kind: "tfjs-node", tf, nsfwjs, modelPromise: null, sharp: null };
    return nsfwRuntime;
  } catch (error) {
    // Fallback: pure TFJS + sharp decoder (works on Windows/Linux without tfjs-node builds in many cases).
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies
      tf = await import("@tensorflow/tfjs");
      // eslint-disable-next-line import/no-extraneous-dependencies
      nsfwjs = await import("nsfwjs");
      // eslint-disable-next-line import/no-extraneous-dependencies
      const sharp = await import("sharp");
      nsfwRuntime = { ok: true, kind: "tfjs-sharp", tf, nsfwjs, modelPromise: null, sharp };
      return nsfwRuntime;
    } catch (fallbackError) {
      nsfwRuntime = { ok: false, error, fallbackError };
      return nsfwRuntime;
    }
  }
};

const loadNsfwModel = async (runtime, modelDirUrl) => {
  if (runtime.modelPromise) return runtime.modelPromise;
  const nsfw = runtime.nsfwjs?.default || runtime.nsfwjs;

  // If we have tfjs-node we can load from local folder via file:// URL.
  // Otherwise, default to bundled model (no extra files required).
  if (runtime.kind === "tfjs-node" && typeof modelDirUrl === "string" && modelDirUrl.startsWith("file:")) {
    const dirPath = fileURLToPath(modelDirUrl);
    const modelJson = path.join(dirPath, "model.json");
    if (!fs.existsSync(modelJson)) {
      throw new Error(`NSFWJS model files not found at ${dirPath}. Run: npm run download:nsfw-model`);
    }
    runtime.modelPromise = nsfw.load(modelDirUrl);
    return runtime.modelPromise;
  }

  runtime.modelPromise = nsfw.load();
  return runtime.modelPromise;
};

const decodeImageToTensor = async (runtime, imageBuffer) => {
  const tf = runtime.tf;
  if (runtime.kind === "tfjs-node") {
    return tf.node.decodeImage(imageBuffer, 3);
  }

  const sharp = runtime.sharp?.default || runtime.sharp;
  if (!sharp) {
    throw new Error("Local image decoding requires sharp when tfjs-node is unavailable.");
  }

  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info?.channels || 3;
  const width = info?.width;
  const height = info?.height;
  if (!width || !height) throw new Error("Failed to decode image dimensions");

  const uint8 = data instanceof Buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
  return tf.tensor3d(uint8, [height, width, channels], "int32");
};

const classifyOneImage = async (runtime, model, imageBuffer) => {
  const tf = runtime.tf;
  const imageTensor = await decodeImageToTensor(runtime, imageBuffer);
  try {
    const predictions = await model.classify(imageTensor);
    return Array.isArray(predictions) ? predictions : [];
  } finally {
    imageTensor.dispose?.();
  }
};

const predictionsToScores = (predictions) => {
  const scores = {};
  for (const item of predictions) {
    const cls = typeof item?.className === "string" ? item.className : "";
    const prob = Number(item?.probability);
    if (!cls || !Number.isFinite(prob)) continue;
    scores[cls] = prob;
  }
  return scores;
};

const shouldFlagFromNsfwScores = (scores) => {
  const thresholdPorn = Number(process.env.AI_MODERATION_NSFW_PORN_THRESHOLD) || 0.8;
  const thresholdHentai = Number(process.env.AI_MODERATION_NSFW_HENTAI_THRESHOLD) || 0.8;
  const thresholdSexy = Number(process.env.AI_MODERATION_NSFW_SEXY_THRESHOLD) || 0.9;

  const porn = Number(scores?.Porn) || 0;
  const hentai = Number(scores?.Hentai) || 0;
  const sexy = Number(scores?.Sexy) || 0;

  if (porn >= thresholdPorn) return { flagged: true, reason: "image:nsfw:porn" };
  if (hentai >= thresholdHentai) return { flagged: true, reason: "image:nsfw:hentai" };
  if (sexy >= thresholdSexy) return { flagged: true, reason: "image:nsfw:sexy" };
  return { flagged: false, reason: null };
};

const moderateImagesLocal = async ({ imageUrls, nsfwjsModelDirUrl }) => {
  const urls = Array.isArray(imageUrls) ? imageUrls : [];
  if (urls.length === 0) return { flagged: false, reasons: [], categories: {}, scores: {} };

  const runtime = await loadNsfwRuntime();
  if (!runtime.ok) {
    const required = truthy(process.env.AI_MODERATION_LOCAL_IMAGE_REQUIRED ?? "true");
    if (required) {
      const msg1 = runtime.error instanceof Error ? runtime.error.message : String(runtime.error || "Missing deps");
      const msg2 =
        runtime.fallbackError instanceof Error ? runtime.fallbackError.message : String(runtime.fallbackError || "");
      throw new Error(
        `Local image moderation requires dependencies. Install either (@tensorflow/tfjs-node, nsfwjs) or (@tensorflow/tfjs, nsfwjs, sharp). Or set AI_MODERATION_LOCAL_IMAGE_REQUIRED=false. Details: ${msg1}${msg2 ? ` | ${msg2}` : ""}`,
      );
    }
    return { flagged: false, reasons: ["image:model_unavailable"], categories: { "image:model_unavailable": true }, scores: {} };
  }

  const model = await loadNsfwModel(runtime, nsfwjsModelDirUrl);
  const timeoutMs = Number(process.env.AI_MODERATION_IMAGE_FETCH_TIMEOUT_MS) || 10_000;
  const maxBytes = Number(process.env.AI_MODERATION_MAX_IMAGE_BYTES) || 5_000_000;

  let anyFlagged = false;
  const reasons = [];
  const categories = {};
  const scores = {};

  for (const url of urls) {
    let buf = bufferFromDataUrl(url);
    if (!buf) {
      // eslint-disable-next-line no-await-in-loop
      const resp = await fetchWithTimeout(url, { timeoutMs });
      if (!resp.ok) {
        throw new Error(`Failed to fetch image for moderation: ${resp.status} ${resp.statusText}`);
      }

      const contentLength = Number(resp.headers.get("content-length")) || 0;
      if (contentLength && contentLength > maxBytes) {
        throw new Error(`Image too large for moderation (${contentLength} bytes > ${maxBytes})`);
      }

      // eslint-disable-next-line no-await-in-loop
      buf = Buffer.from(await resp.arrayBuffer());
    }
    if (buf.length > maxBytes) throw new Error(`Image too large for moderation (${buf.length} bytes > ${maxBytes})`);

    // eslint-disable-next-line no-await-in-loop
    const predictions = await classifyOneImage(runtime, model, buf);
    const oneScores = predictionsToScores(predictions);
    const decision = shouldFlagFromNsfwScores(oneScores);

    scores[url] = oneScores;
    if (decision.flagged) {
      anyFlagged = true;
      if (decision.reason) reasons.push(decision.reason);
      if (decision.reason) categories[decision.reason] = true;
    }

    // Small delay to avoid CPU spikes if many images
    // eslint-disable-next-line no-await-in-loop
    await delay(10);
  }

  return { flagged: anyFlagged, reasons, categories, scores };
};

export const moderateTextAndImagesLocal = async ({ text, imageUrls, nsfwjsModelDirUrl }) => {
  const textFindings = buildTextFindings(text);
  const textFlag = truthy(process.env.AI_MODERATION_TEXT_STRICT ?? "false") && textFindings.length > 0;

  const imageResult = await moderateImagesLocal({ imageUrls, nsfwjsModelDirUrl });

  const flagged = Boolean(textFlag || imageResult.flagged);
  const reasons = [...textFindings, ...(imageResult.reasons || [])];
  const categories = {
    ...(textFindings.length ? Object.fromEntries(textFindings.map((r) => [r, true])) : {}),
    ...(imageResult.categories || {}),
  };

  return {
    skipped: false,
    flagged,
    reasons,
    provider: "local",
    categories,
    scores: imageResult.scores || {},
    rawId: null,
    rawModel: "nsfwjs",
  };
};
