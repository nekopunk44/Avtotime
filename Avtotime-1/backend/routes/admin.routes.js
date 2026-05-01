import express from "express";
import isAuth from "../middlewars/isAuth.js";
import isAdmin from "../middlewars/isAdmin.js";
import validateObjectId from "../middlewars/validateObjectId.js";
import {
  approveMarketListing,
  getAdminStatus,
  getAdminStats,
  getPendingMarketListings,
  getAppealedMarketListings,
  rejectMarketListing,
  getAdminUsersList,
  getAdminUserStats,
  grantAdmin,
  revokeAdmin,
  banUser,
  unbanUser,
} from "../controllers/admin.controllers.js";

const adminRouter = express.Router();

adminRouter.get("/status", isAuth, getAdminStatus);
adminRouter.get("/stats", isAuth, isAdmin, getAdminStats);

adminRouter.get("/market/pending", isAuth, isAdmin, getPendingMarketListings);
adminRouter.get("/market/appeals", isAuth, isAdmin, getAppealedMarketListings);
adminRouter.post("/market/:type/:id/approve", isAuth, isAdmin, validateObjectId("id"), approveMarketListing);
adminRouter.post("/market/:type/:id/reject", isAuth, isAdmin, validateObjectId("id"), rejectMarketListing);

adminRouter.get("/users", isAuth, isAdmin, getAdminUsersList);
adminRouter.get("/users/:id", isAuth, isAdmin, validateObjectId("id"), getAdminUserStats);
adminRouter.post("/users/:id/grant-admin", isAuth, isAdmin, validateObjectId("id"), grantAdmin);
adminRouter.post("/users/:id/revoke-admin", isAuth, isAdmin, validateObjectId("id"), revokeAdmin);
adminRouter.post("/users/:id/ban", isAuth, isAdmin, validateObjectId("id"), banUser);
adminRouter.post("/users/:id/unban", isAuth, isAdmin, validateObjectId("id"), unbanUser);

export default adminRouter;
