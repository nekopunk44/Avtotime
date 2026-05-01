import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import MarketCarServiceListing from "../models/marketCarServiceListing.model.js";
import MarketAutoTuningListing from "../models/marketAutoTuningListing.model.js";
import MarketDryCleaningListing from "../models/marketDryCleaningListing.model.js";
import MarketConsultationExpert from "../models/marketConsultationExpert.model.js";
import { createNotification } from "./notification.controllers.js";
import { getAdminUsers } from "../config/admin.js";

const APPEAL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 day between appeals
const APPEAL_MESSAGE_MAX_LEN = 500;

const getModelByType = (type) => {
  switch (String(type || "").toLowerCase()) {
    case "cars":
      return MarketCarListing;
    case "parts":
      return MarketPartListing;
    case "car-services":
      return MarketCarServiceListing;
    case "auto-tuning":
      return MarketAutoTuningListing;
    case "dry-cleaning":
      return MarketDryCleaningListing;
    case "consultations":
      return MarketConsultationExpert;
    default:
      return null;
  }
};

const getListingTitle = (doc) =>
  doc.title || doc.name || "Объявление";

export const submitAppeal = async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = getModelByType(type);
    if (!Model) {
      return res.status(400).json({ message: "Неизвестный тип объявления" });
    }

    const listing = await Model.findOne({ _id: id, author: req.userId });
    if (!listing) {
      return res.status(404).json({ message: "Объявление не найдено" });
    }
    if (listing.moderationStatus !== "rejected") {
      return res.status(400).json({ message: "Апелляцию можно подать только на отклонённое объявление" });
    }

    // Cooldown: prevent repeated appeals within 24 hours
    if (listing.appealedAt && Date.now() - listing.appealedAt.getTime() < APPEAL_COOLDOWN_MS) {
      return res.status(429).json({ message: "Апелляция уже была подана. Повторная подача возможна через 24 часа." });
    }

    const message = typeof req.body?.message === "string"
      ? req.body.message.trim().slice(0, APPEAL_MESSAGE_MAX_LEN)
      : "";

    // Reset listing to pending so it appears in admin queue
    await Model.updateOne(
      { _id: id },
      {
        $set: {
          moderationStatus: "pending",
          moderationProvider: "",
          appealMessage: message,
          appealedAt: new Date(),
        },
      },
    );

    const title = getListingTitle(listing);
    const adminUsers = await getAdminUsers();

    for (const admin of adminUsers) {
      // eslint-disable-next-line no-await-in-loop
      await createNotification({
        recipient: admin._id,
        actor: req.userId,
        type: "listing_appeal",
        title: "Апелляция на объявление",
        description: message
          ? `Пользователь оспаривает отклонение объявления «${title}»: "${message.slice(0, 100)}"`
          : `Пользователь оспаривает отклонение объявления «${title}»`,
        relatedId: listing._id,
        relatedType: "market_listing",
        link: "/admin/market",
      }).catch(() => {});
    }

    return res.status(200).json({ message: "Апелляция отправлена администратору. Ожидайте решения." });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Ошибка при подаче апелляции" });
  }
};
