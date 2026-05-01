import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import { io } from "../socket.js";
import nodemailer from "nodemailer";
import {
  getCachedResponse,
  invalidateCachedResponse,
  setCachedResponse,
} from "../services/responseCache.js";

const transporter = process.env.EMAIL ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  }
}) : null;

const sendEmailNotification = async (recipient, notification, actor) => {
  if (!transporter || !recipient.email || !recipient.notificationPreferences?.emailNotifications) {
    return false;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL,
      to: recipient.email,
      subject: notification.title,
      html: `
        <h2>${notification.title}</h2>
        <p>${notification.description}</p>
        <a href="${process.env.CLIENT_URL}${notification.link}">Открыть</a>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};

const sendSocketNotificationWithRetry = async (recipientId, notification, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      io.to(recipientId.toString()).emit("notification", notification);
      
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[notification] emitted to ${recipientId.toString()} type=${notification.type} attempt=${attempt + 1}`
        );
      }
      
      return true;
    } catch (e) {
      console.error(`Socket.io error (attempt ${attempt + 1}):`, e);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
      }
    }
  }
  return false;
};

const invalidateNotificationCache = async (recipientId) => {
  const prefix = String(recipientId);
  await invalidateCachedResponse("notifications", `list:${prefix}:`);
  await invalidateCachedResponse("notifications", `count:${prefix}:`);
};

export const createNotification = async ({
  recipient,
  actor,
  type,
  title,
  description,
  relatedId,
  relatedType,
  image,
  link,
}) => {
  try {
    // Check preferences
    const recipientUser = await User.findById(recipient);
    if (!recipientUser) return null;

    // Respect notification preferences
    if (recipientUser.notificationPreferences?.[type] === false) {
      return null;
    }

    // Don't notify yourself unless it's a system-originated notification
    const selfAllowedTypes = new Set(["system", "listing_rejected", "listing_approved"]);
    if (recipient.toString() === actor.toString() && !selfAllowedTypes.has(type)) {
      return null;
    }

    // Try to find and update existing notification for deduplication (for likes/follows on same object)
    if (["like", "follow"].includes(type)) {
      const existingNotif = await Notification.findOne({
        recipient,
        type,
        relatedId,
        isRead: false,
        isBatched: false
      }).sort({ createdAt: -1 });

      if (existingNotif && !existingNotif.actors.includes(actor.toString())) {
        // Update existing notification
        if (!existingNotif.actors) existingNotif.actors = [existingNotif.actor];
        existingNotif.actors.push(actor);
        existingNotif.count = (existingNotif.count || 1) + 1;
        
        // Update description for batch
        const actorCount = existingNotif.actors.length;
        if (actorCount > 1) {
          const actorUser = await User.findById(actor).select('userName');
          existingNotif.description = `${actorUser?.userName} и ещё ${actorCount - 1} ${type === 'like' ? 'лайкнули' : 'подписались'}`;
          existingNotif.isBatched = true;
        }

        await existingNotif.save();
        await invalidateNotificationCache(recipient);
        await sendSocketNotificationWithRetry(recipient, existingNotif);
        return existingNotif;
      }
    }

    // Create new notification
    const notification = await Notification.create({
      recipient,
      actor,
      actors: [actor],
      type,
      title,
      description,
      relatedId,
      relatedType,
      image,
      link,
      count: 1,
      isBatched: false,
    });

    const populated = await notification.populate([
      { path: "recipient", select: "name userName profileImage" },
      { path: "actor", select: "name userName profileImage" },
      { path: "actors", select: "name userName profileImage" }
    ]);

    // Send via Socket.io with retry
    const socketSent = await sendSocketNotificationWithRetry(recipient, populated);
    notification.sendRetries = socketSent ? 0 : 3;
    notification.sentAt = new Date();

    // Send email if digest is instant
    if (recipientUser.notificationPreferences?.digestFrequency === 'instant') {
      const emailSent = await sendEmailNotification(recipientUser, notification, actor);
      notification.emailSent = emailSent;
    }

    await notification.save();
    await invalidateNotificationCache(recipient);
    return populated;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

export const getNotifications = async (req, res) => {
  try {
    const { isRead } = req.query;
    const filter = { recipient: req.userId };

    if (isRead === "true") {
      filter.isRead = true;
    } else if (isRead === "false") {
      filter.isRead = false;
    }

    const cacheKey = `list:${req.userId.toString()}:${isRead === undefined ? "all" : String(isRead)}`;
    const cached = await getCachedResponse("notifications", cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const notifications = await Notification.find(filter)
      .populate("actor", "name userName profileImage")
      .populate("actors", "name userName profileImage")
      .sort({ createdAt: -1 })
      .limit(50);

    await setCachedResponse("notifications", cacheKey, notifications);
    return res.status(200).json(notifications);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const cacheKey = `count:${req.userId.toString()}:unread`;
    const cached = await getCachedResponse("notifications", cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const count = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false,
    });

    const payload = { unreadCount: count };
    await setCachedResponse("notifications", cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.userId },
      { 
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    ).populate("actor", "name userName profileImage");

    if (!notification) {
      return res.status(404).json({ message: "Уведомление не найдено" });
    }

    await invalidateNotificationCache(req.userId);
    return res.status(200).json(notification);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.userId, isRead: false },
      { 
        isRead: true,
        readAt: new Date()
      }
    );

    await invalidateNotificationCache(req.userId);
    return res.status(200).json({ message: "Все уведомления прочитаны" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: req.userId
    });

    if (!notification) {
      return res.status(404).json({ message: "Уведомление не найдено" });
    }

    await invalidateNotificationCache(req.userId);
    return res.status(200).json({ message: "Уведомление удалено" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { notificationPreferences: preferences },
      { new: true }
    ).select("notificationPreferences");

    return res.status(200).json(user.notificationPreferences);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("notificationPreferences");
    return res.status(200).json(user?.notificationPreferences);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.userId });
    await invalidateNotificationCache(req.userId);
    return res.status(200).json({ message: "Все уведомления удалены" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
