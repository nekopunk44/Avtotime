import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import MarketCarServiceListing from "../models/marketCarServiceListing.model.js";
import MarketAutoTuningListing from "../models/marketAutoTuningListing.model.js";
import MarketConsultationExpert from "../models/marketConsultationExpert.model.js";
import MarketDryCleaningListing from "../models/marketDryCleaningListing.model.js";
import MarketEcoTip from "../models/marketEcoTip.model.js";
import MarketHelpRequest from "../models/marketHelpRequest.model.js";
import { isAiModerationEnabled, isMongoConnected, moderateTextAndImages } from "../services/aiModeration.js";
import { createNotification } from "../controllers/notification.controllers.js";

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
const isModerationDebugEnabled = () => truthy(process.env.AI_MODERATION_DEBUG);
const logModerationDebug = (message, payload) => {
  if (!isModerationDebugEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`[moderation-worker] ${message}`, payload ?? "");
  } catch {
    // eslint-disable-next-line no-console
    console.log(`[moderation-worker] ${message}`);
  }
};

const buildText = (parts) =>
  parts
    .flat()
    .map((value) => (typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()))
    .filter(Boolean)
    .join("\n");

const getTruthyStringArray = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim()) : []);

const MODEL_CONFIGS = [
  {
    key: "cars",
    model: MarketCarListing,
    buildInput: (doc) => ({
      text: buildText([
        doc.title,
        doc.description,
        [doc.brand, doc.model].filter(Boolean).join(" "),
        doc.location,
        doc.type,
      ]),
      imageUrls: getTruthyStringArray(doc.images?.length ? doc.images : [doc.image]),
    }),
  },
  {
    key: "parts",
    model: MarketPartListing,
    buildInput: (doc) => ({
      text: buildText([
        doc.title,
        doc.description,
        [doc.brand, doc.model].filter(Boolean).join(" "),
        doc.partGroup,
        doc.partCategory,
        doc.partCategoryKey,
        doc.location,
        doc.type,
      ]),
      imageUrls: getTruthyStringArray(doc.images?.length ? doc.images : [doc.image]),
    }),
  },
  {
    key: "car-services",
    model: MarketCarServiceListing,
    buildInput: (doc) => ({
      text: buildText([doc.title, doc.category, doc.location, `${doc.pricePrefix || ""} ${doc.price || ""} ${doc.unit || ""}`]),
      imageUrls: getTruthyStringArray([doc.image]),
    }),
  },
  {
    key: "auto-tuning",
    model: MarketAutoTuningListing,
    buildInput: (doc) => ({
      text: buildText([doc.title, doc.category, doc.location, getTruthyStringArray(doc.tags).join(", ")]),
      imageUrls: getTruthyStringArray([doc.image]),
    }),
  },
  {
    key: "consultations",
    model: MarketConsultationExpert,
    buildInput: (doc) => ({
      text: buildText([
        doc.name,
        getTruthyStringArray(doc.specialties).join(", "),
        getTruthyStringArray(doc.tags).join(", "),
        doc.location,
      ]),
      imageUrls: getTruthyStringArray([doc.avatar]),
    }),
  },
  {
    key: "dry-cleaning",
    model: MarketDryCleaningListing,
    buildInput: (doc) => ({
      text: buildText([doc.title, doc.category, doc.location, getTruthyStringArray(doc.tags).join(", ")]),
      imageUrls: getTruthyStringArray([doc.image]),
    }),
  },
  {
    key: "eco-tips",
    model: MarketEcoTip,
    buildInput: (doc) => ({
      text: buildText([doc.title, doc.description, doc.category, doc.date]),
      imageUrls: getTruthyStringArray([doc.image]),
    }),
  },
  {
    key: "help-requests",
    model: MarketHelpRequest,
    buildInput: (doc) => ({
      text: buildText([doc.location, doc.description]),
      imageUrls: [],
    }),
  },
];

const REASON_LABELS = {
  "text:phone": "содержит номер телефона",
  "text:url": "содержит внешнюю ссылку",
  "text:banned_word": "содержит запрещённое слово",
  "image:nsfw:porn": "содержит неприемлемый контент",
  "image:nsfw:hentai": "содержит неприемлемый контент",
  "image:nsfw:sexy": "содержит откровенный контент",
};

const buildRejectionDescription = (reasons) => {
  if (!Array.isArray(reasons) || !reasons.length) {
    return "Ваше объявление не прошло автоматическую проверку. Вы можете подать апелляцию администратору.";
  }
  const labels = reasons.map((r) => REASON_LABELS[r] || r).join(", ");
  return `Ваше объявление отклонено: ${labels}. Вы можете подать апелляцию администратору.`;
};

const now = () => new Date();

const canClaimFilter = () => ({
  moderationStatus: "pending",
  $or: [{ moderationLock: { $exists: false } }, { moderationLock: null }, { moderationLock: { $lte: new Date(Date.now() - 5 * 60 * 1000) } }],
});

const handleMaxAttempts = async (model, doc) => {
  const max = Number(process.env.AI_MODERATION_MAX_ATTEMPTS);
  if (!Number.isFinite(max) || max <= 0) return false;
  const attempts = Number(doc?.moderationAttempts) || 0;
  if (attempts < max) return false;

  const action = String(process.env.AI_MODERATION_MAX_ATTEMPTS_ACTION || "approve").toLowerCase();
  const status = action === "reject" ? "rejected" : "approved";

  await model.updateOne(
    { _id: doc._id },
    {
      $set: {
        moderationStatus: status,
        moderationCheckedAt: new Date(),
        moderationLock: null,
        moderationLastError: doc?.moderationLastError || "Max moderation attempts reached",
      },
    },
  );
  return true;
};

const claimOne = async (model, extraFilter = {}) => {
  return model.findOneAndUpdate(
    { ...canClaimFilter(), ...extraFilter },
    { $set: { moderationLock: now() }, $inc: { moderationAttempts: 1 } },
    { sort: { createdAt: 1 }, new: true },
  );
};

const releaseLockWithError = async (model, id, error) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown moderation error");
  await model.updateOne(
    { _id: id },
    {
      $set: {
        moderationLastError: message,
        moderationLock: null,
      },
    },
  );
};

const applyResult = async (model, id, result) => {
  const status = result.flagged ? "rejected" : "approved";
  await model.updateOne(
    { _id: id },
    {
      $set: {
        moderationStatus: status,
        moderationFlagged: Boolean(result.flagged),
        moderationReasons: Array.isArray(result.reasons) ? result.reasons : [],
        moderationProvider: result.provider || "",
        moderationCheckedAt: now(),
        moderationCategories: result.categories || null,
        moderationScores: result.scores || null,
        moderationRawId: result.rawId || null,
        moderationRawModel: result.rawModel || null,
        moderationLastError: "",
        moderationLock: null,
      },
    },
  );

  logModerationDebug("applied", {
    id: String(id),
    status,
    provider: result.provider || "",
    reasons: Array.isArray(result.reasons) ? result.reasons : [],
  });

  return status;
};

const processDoc = async (config, doc) => {
  const { text, imageUrls } = config.buildInput(doc);
  const result = await moderateTextAndImages({ text, imageUrls });
  if (result.skipped) {
    await config.model.updateOne(
      { _id: doc._id },
      {
        $set: {
          moderationStatus: "approved",
          moderationProvider: "",
          moderationCheckedAt: now(),
          moderationLock: null,
          moderationLastError: "",
        },
      },
    );
    return;
  }
  const status = await applyResult(config.model, doc._id, result);
  if (status === "rejected" && doc.author) {
    createNotification({
      recipient: doc.author,
      actor: doc.author,
      type: "listing_rejected",
      title: "Объявление отклонено",
      description: buildRejectionDescription(result.reasons),
      relatedId: doc._id,
      relatedType: "market_listing",
      link: "/market",
    }).catch(() => {});
  }
};

export const enqueueMarketModerationById = (key, id) => {
  const config = MODEL_CONFIGS.find((c) => c.key === key);
  if (!config) return;
  if (!isAiModerationEnabled()) return;
  if (!id) return;

  setImmediate(async () => {
    if (!isMongoConnected()) return;
    const claimed = await claimOne(config.model, { _id: id }).catch(() => null);
    if (!claimed) return;
    if (await handleMaxAttempts(config.model, claimed).catch(() => false)) return;
    try {
      await processDoc(config, claimed);
    } catch (error) {
      await releaseLockWithError(config.model, claimed._id, error).catch(() => {});
    }
  });
};

export const startMarketModerationWorker = () => {
  const intervalMs = Number(process.env.AI_MODERATION_WORKER_INTERVAL_MS) || 15_000;
  const batchPerModel = Number(process.env.AI_MODERATION_BATCH_PER_MODEL) || 5;

  const tick = async () => {
    if (!isAiModerationEnabled()) return;
    if (!isMongoConnected()) return;

    for (const config of MODEL_CONFIGS) {
      // eslint-disable-next-line no-await-in-loop
      for (let i = 0; i < batchPerModel; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const doc = await claimOne(config.model).catch(() => null);
        if (!doc) break;
        // eslint-disable-next-line no-await-in-loop
        if (await handleMaxAttempts(config.model, doc).catch(() => false)) continue;
        try {
          // eslint-disable-next-line no-await-in-loop
          await processDoc(config, doc);
        } catch (error) {
          // eslint-disable-next-line no-await-in-loop
          await releaseLockWithError(config.model, doc._id, error).catch(() => {});
        }
      }
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();

  // Run once shortly after startup
  setTimeout(() => void tick(), 3_000).unref?.();
};
