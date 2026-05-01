import express from "express";
import isAuth from "../middlewars/isAuth.js";
import {
  createNotification,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  updateNotificationPreferences,
  getNotificationPreferences,
  clearAllNotifications,
} from "../controllers/notification.controllers.js";

const notificationRouter = express.Router();

notificationRouter.get("/", isAuth, getNotifications);
notificationRouter.get("/count/unread", isAuth, getUnreadCount);
notificationRouter.get("/preferences", isAuth, getNotificationPreferences);
notificationRouter.patch("/:notificationId/read", isAuth, markAsRead);
notificationRouter.patch("/mark-all-read", isAuth, markAllAsRead);
notificationRouter.patch("/preferences", isAuth, updateNotificationPreferences);
notificationRouter.delete("/:notificationId", isAuth, deleteNotification);
notificationRouter.delete("/", isAuth, clearAllNotifications);

export default notificationRouter;
export { createNotification };
