import express from "express";
import isAuth from "../middlewars/isAuth.js";
import isEmailVerified from "../middlewars/isEmailVerified.js";
import { upload } from "../middlewars/multer.js";
import { checkPlanLimits } from "../middlewars/checkPlanLimits.js";
import validateObjectId from "../middlewars/validateObjectId.js";
import { submitAppeal } from "../controllers/marketAppeal.controllers.js";
import {
  createAutoTuningListing,
  createCarListing,
  createPartListing,
  createCarServiceListing,
  createConsultationExpert,
  deleteAutoTuningListing,
  deleteCarListing,
  deletePartListing,
  deleteCarServiceListing,
  deleteConsultationExpert,
  filterMarketListings,
  getMarketListingById,
  getAutoTuningListings,
  getCarListings,
  getPartListings,
  getCarServiceListings,
  getConsultationExperts,
  searchMarketListings,
  updateAutoTuningListing,
  updateCarListing,
  updatePartListing,
  updateCarServiceListing,
  updateConsultationExpert,
} from "../controllers/market.controllers.js";
import {
  getMyAnalyticsSummary,
  recordListingLead,
  recordListingView,
} from "../controllers/marketAnalytics.controllers.js";
import {
  createKidsActivity,
  createDryCleaningListing,
  createEcoTip,
  createGame,
  createHelpRequest,
  deleteHelpRequest,
  deleteDryCleaningListing,
  deleteEcoTip,
  deleteGame,
  deleteKidsActivity,
  getDistinctBrands,
  getDistinctModels,
  getCompareState,
  getDrivingCourseModes,
  getDryCleaningListings,
  getEcoTips,
  getGames,
  getHelpRequests,
  getKidsActivities,
  getKidsLeaderboard,
  saveCompareState,
  updateHelpRequest,
  updateDryCleaningListing,
  updateEcoTip,
  updateGame,
  updateKidsActivity,
} from "../controllers/marketTabs.controllers.js";

const marketRouter = express.Router();

marketRouter.post("/:type/:id/appeal", isAuth, submitAppeal);

marketRouter.get("/analytics/summary", isAuth, getMyAnalyticsSummary);
marketRouter.post("/:type/:id/view", recordListingView);
marketRouter.post("/:type/:id/lead", isAuth, recordListingLead);

marketRouter.get("/search", isAuth, searchMarketListings);
marketRouter.get("/filter", isAuth, filterMarketListings);
marketRouter.get("/listing/:listingType/:id", isAuth, getMarketListingById);

marketRouter.get("/cars", isAuth, getCarListings);
marketRouter.post("/cars", isAuth, isEmailVerified, upload.array("images", 10), checkPlanLimits("cars"), createCarListing);
marketRouter.patch("/cars/:id", isAuth, validateObjectId("id"), upload.array("images", 10), updateCarListing);
marketRouter.delete("/cars/:id", isAuth, validateObjectId("id"), deleteCarListing);

marketRouter.get("/parts", isAuth, getPartListings);
marketRouter.post("/parts", isAuth, isEmailVerified, upload.array("images", 10), checkPlanLimits("parts"), createPartListing);
marketRouter.patch("/parts/:id", isAuth, validateObjectId("id"), upload.array("images", 10), updatePartListing);
marketRouter.delete("/parts/:id", isAuth, validateObjectId("id"), deletePartListing);

marketRouter.get("/brands", isAuth, getDistinctBrands);
marketRouter.get("/models", isAuth, getDistinctModels);

marketRouter.get("/car-services", isAuth, getCarServiceListings);
marketRouter.post("/car-services", isAuth, isEmailVerified, upload.single("image"), checkPlanLimits("car-services"), createCarServiceListing);
marketRouter.patch("/car-services/:id", isAuth, validateObjectId("id"), upload.single("image"), updateCarServiceListing);
marketRouter.delete("/car-services/:id", isAuth, validateObjectId("id"), deleteCarServiceListing);

marketRouter.get("/auto-tuning", isAuth, getAutoTuningListings);
marketRouter.post("/auto-tuning", isAuth, isEmailVerified, upload.single("image"), checkPlanLimits("auto-tuning"), createAutoTuningListing);
marketRouter.patch("/auto-tuning/:id", isAuth, validateObjectId("id"), upload.single("image"), updateAutoTuningListing);
marketRouter.delete("/auto-tuning/:id", isAuth, validateObjectId("id"), deleteAutoTuningListing);

marketRouter.get("/consultations", isAuth, getConsultationExperts);
marketRouter.post("/consultations", isAuth, isEmailVerified, upload.single("avatar"), checkPlanLimits("consultations"), createConsultationExpert);
marketRouter.patch("/consultations/:id", isAuth, validateObjectId("id"), upload.single("avatar"), updateConsultationExpert);
marketRouter.delete("/consultations/:id", isAuth, validateObjectId("id"), deleteConsultationExpert);

marketRouter.get("/dry-cleaning", isAuth, getDryCleaningListings);
marketRouter.post("/dry-cleaning", isAuth, isEmailVerified, upload.single("image"), checkPlanLimits("dry-cleaning"), createDryCleaningListing);
marketRouter.patch("/dry-cleaning/:id", isAuth, validateObjectId("id"), upload.single("image"), updateDryCleaningListing);
marketRouter.delete("/dry-cleaning/:id", isAuth, validateObjectId("id"), deleteDryCleaningListing);

marketRouter.get("/games", isAuth, getGames);
marketRouter.post("/games", isAuth, isEmailVerified, createGame);
marketRouter.patch("/games/:id", isAuth, validateObjectId("id"), updateGame);
marketRouter.delete("/games/:id", isAuth, validateObjectId("id"), deleteGame);

marketRouter.get("/eco-tips", isAuth, getEcoTips);
marketRouter.post("/eco-tips", isAuth, isEmailVerified, upload.single("image"), createEcoTip);
marketRouter.patch("/eco-tips/:id", isAuth, validateObjectId("id"), upload.single("image"), updateEcoTip);
marketRouter.delete("/eco-tips/:id", isAuth, validateObjectId("id"), deleteEcoTip);

marketRouter.get("/help-others/requests", isAuth, getHelpRequests);
marketRouter.post("/help-others/requests", isAuth, isEmailVerified, checkPlanLimits("help-others"), createHelpRequest);
marketRouter.patch("/help-others/requests/:id", isAuth, updateHelpRequest);
marketRouter.delete("/help-others/requests/:id", isAuth, deleteHelpRequest);

marketRouter.get("/compare", isAuth, getCompareState);
marketRouter.put("/compare", isAuth, saveCompareState);

marketRouter.get("/driving-courses/modes", isAuth, getDrivingCourseModes);

marketRouter.get("/kids/activities", isAuth, getKidsActivities);
marketRouter.post("/kids/activities", isAuth, isEmailVerified, createKidsActivity);
marketRouter.patch("/kids/activities/:id", isAuth, updateKidsActivity);
marketRouter.delete("/kids/activities/:id", isAuth, deleteKidsActivity);
marketRouter.get("/kids/leaderboard", isAuth, getKidsLeaderboard);

export default marketRouter;
