import Favorite from "../models/favorite.model.js";
import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import MarketCarServiceListing from "../models/marketCarServiceListing.model.js";
import MarketAutoTuningListing from "../models/marketAutoTuningListing.model.js";
import MarketConsultationExpert from "../models/marketConsultationExpert.model.js";
import MarketDryCleaningListing from "../models/marketDryCleaningListing.model.js";
import MarketEcoTip from "../models/marketEcoTip.model.js";
import MarketGame from "../models/marketGame.model.js";
import MarketKidsActivity from "../models/marketKidsActivity.model.js";
import MarketHelpRequest from "../models/marketHelpRequest.model.js";

const getModelByType = (type) => {
  const typeMap = {
    car: MarketCarListing,
    part: MarketPartListing,
    "car-service": MarketCarServiceListing,
    "auto-tuning": MarketAutoTuningListing,
    consultation: MarketConsultationExpert,
    "dry-cleaning": MarketDryCleaningListing,
    "eco-tip": MarketEcoTip,
    game: MarketGame,
    "kids-activity": MarketKidsActivity,
    "help-request": MarketHelpRequest,
  };
  return typeMap[type];
};

export const addToFavorites = async (req, res) => {
  try {
    const { listingId, listingType, listingTitle, listingImage, listingPrice } =
      req.body;

    if (!listingId || !listingType) {
      return res
        .status(400)
        .json({ message: "Требуются listingId и listingType" });
    }

    // Check if listing exists
    const Model = getModelByType(listingType);
    if (!Model) {
      return res.status(400).json({ message: "Неверный тип объявления" });
    }

    const listing = await Model.findById(listingId).lean();
    if (!listing) {
      return res.status(404).json({ message: "Объявление не найдено" });
    }

    const favorite = await Favorite.create({
      user: req.userId,
      listingId,
      listingType,
      listingTitle: listingTitle || listing.title || listing.name || "",
      listingImage: listingImage || listing.image || listing.avatar || "",
      listingPrice: listingPrice || listing.price || listing.hourlyRate || "",
    });

    return res.status(201).json(favorite);
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error - already in favorites
      return res
        .status(200)
        .json({ message: "Уже в избранном" });
    }
    return res.status(500).json({ message: error.message });
  }
};

export const removeFromFavorites = async (req, res) => {
  try {
    const { listingId, listingType } = req.body;

    if (!listingId || !listingType) {
      return res
        .status(400)
        .json({ message: "Требуются listingId и listingType" });
    }

    const deleted = await Favorite.findOneAndDelete({
      user: req.userId,
      listingId,
      listingType,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Не в избранном" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFavorites = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { user: req.userId };

    if (type) {
      filter.listingType = String(type).toLowerCase();
    }

    const favorites = await Favorite.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(favorites);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const checkIfFavorite = async (req, res) => {
  try {
    const { listingId, listingType } = req.query;

    if (!listingId || !listingType) {
      return res
        .status(400)
        .json({ isFavorite: false, message: "Требуются параметры" });
    }

    const favorite = await Favorite.findOne({
      user: req.userId,
      listingId,
      listingType,
    }).lean();

    return res.status(200).json({ isFavorite: !!favorite });
  } catch (error) {
    return res.status(500).json({ isFavorite: false, message: error.message });
  }
};

export const countFavorites = async (req, res) => {
  try {
    const count = await Favorite.countDocuments({ user: req.userId });
    return res.status(200).json({ count });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
