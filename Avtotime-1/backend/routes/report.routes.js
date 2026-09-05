import express from "express";
import isAuth from "../middlewars/isAuth.js";
import isAdmin from "../middlewars/isAdmin.js";
import validateObjectId from "../middlewars/validateObjectId.js";
import { authLimiter } from "../middlewars/rateLimiters.js";
import {
  createReport,
  getMyReports,
  getReportQueue,
  resolveReport,
} from "../controllers/report.controllers.js";

const reportRouter = express.Router();

// Filing a report is cheap for the reporter and expensive for the moderator, so
// it gets the strict limiter rather than the general API one. The unique index
// on (reporter, target) stops repeats; this stops breadth.
reportRouter.post("/", isAuth, authLimiter, createReport);
reportRouter.get("/mine", isAuth, getMyReports);

reportRouter.get("/queue", isAuth, isAdmin, getReportQueue);
reportRouter.patch("/:id/resolve", isAuth, isAdmin, validateObjectId("id"), resolveReport);

export default reportRouter;
