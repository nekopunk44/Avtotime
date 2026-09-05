import { Types } from "mongoose";
import Report, { REPORT_REASONS, REPORT_TARGET_TYPES, REPORT_STATUSES } from "../models/report.model.js";
import Post from "../models/post.model.js";
import Loop from "../models/loop.model.js";
import User from "../models/user.model.js";
import { getMarketModelByKind } from "../config/marketKinds.js";
import { createNotification } from "./notification.controllers.js";

const MAX_PAGE_SIZE = 100;

/**
 * Confirms the reported thing exists and returns who is responsible for it.
 *
 * Resolving the author now rather than at review time is deliberate: content is
 * frequently deleted right after it is reported, and a queue full of complaints
 * about nothing is what makes a moderation flow useless.
 */
const resolveTarget = async ({ targetType, targetId, targetKind }) => {
  if (targetType === "post") {
    const post = await Post.findById(targetId).select("author").lean();
    return post ? { ok: true, author: post.author } : { ok: false };
  }

  if (targetType === "loop") {
    const loop = await Loop.findById(targetId).select("author").lean();
    return loop ? { ok: true, author: loop.author } : { ok: false };
  }

  if (targetType === "user") {
    const user = await User.findById(targetId).select("_id").lean();
    return user ? { ok: true, author: user._id } : { ok: false };
  }

  if (targetType === "comment") {
    // A comment is a subdocument, so it has to be found through its parent.
    for (const Model of [Post, Loop]) {
      const parent = await Model.findOne({ "comments._id": targetId })
        .select({ comments: { $elemMatch: { _id: targetId } } })
        .lean();
      const comment = parent?.comments?.[0];
      if (comment) return { ok: true, author: comment.author };
    }
    return { ok: false };
  }

  if (targetType === "listing") {
    const Model = getMarketModelByKind(targetKind);
    if (!Model) return { ok: false, reason: "unknown_kind" };
    const listing = await Model.findById(targetId).select("author").lean();
    return listing ? { ok: true, author: listing.author } : { ok: false };
  }

  return { ok: false };
};

export const createReport = async (req, res) => {
  try {
    const { targetType, targetId, targetKind = "", reason, comment = "" } = req.body || {};

    if (!REPORT_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ message: "Неизвестный тип объекта жалобы" });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ message: "Неизвестная причина жалобы" });
    }
    if (!Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Некорректный идентификатор" });
    }
    if (targetType === "user" && String(targetId) === String(req.userId)) {
      return res.status(400).json({ message: "Нельзя пожаловаться на себя" });
    }

    const target = await resolveTarget({ targetType, targetId, targetKind });
    if (!target.ok) {
      return res.status(404).json({ message: "Объект жалобы не найден" });
    }

    // Checked explicitly rather than relying only on the unique index: mongoose
    // builds indexes in the background, so on a freshly created database there
    // is a window in which the index is not there yet and a duplicate slips
    // through. The index stays as the race-proof backstop below.
    const existing = await Report.exists({
      reporter: req.userId,
      targetType,
      targetId,
    });
    if (existing) {
      return res.status(409).json({ message: "Вы уже отправляли жалобу на этот объект" });
    }

    const report = await Report.create({
      reporter: req.userId,
      targetType,
      targetId,
      targetKind: targetType === "listing" ? targetKind : "",
      targetAuthor: target.author || null,
      reason,
      comment: String(comment).slice(0, 1000),
    });

    return res.status(201).json({ _id: report._id, status: report.status, createdAt: report.createdAt });
  } catch (error) {
    // The unique index is the anti-flood rule, so hitting it is an expected
    // outcome rather than a fault.
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Вы уже отправляли жалобу на этот объект" });
    }
    return res.status(500).json({ message: error?.message || "Не удалось отправить жалобу" });
  }
};

export const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ reporter: req.userId })
      .select("targetType targetKind reason status createdAt resolvedAt")
      .sort({ createdAt: -1 })
      .limit(MAX_PAGE_SIZE)
      .lean();

    return res.status(200).json(reports);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Не удалось получить жалобы" });
  }
};

export const getReportQueue = async (req, res) => {
  try {
    const status = REPORT_STATUSES.includes(req.query?.status) ? req.query.status : "open";
    const rawLimit = Number.parseInt(String(req.query?.limit || 50), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : 50;

    const reports = await Report.find({ status })
      // Oldest first: the queue exists to be emptied within a day, and newest
      // first is how the oldest complaint never gets looked at.
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate("reporter", "userName name profileImage")
      .populate("targetAuthor", "userName name profileImage isBanned")
      .lean();

    const total = await Report.countDocuments({ status });

    return res.status(200).json({ reports, total, status });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Не удалось получить очередь" });
  }
};

export const resolveReport = async (req, res) => {
  try {
    const { status, note = "" } = req.body || {};
    if (!["actioned", "dismissed"].includes(status)) {
      return res.status(400).json({ message: "Решение должно быть actioned или dismissed" });
    }

    const report = await Report.findOneAndUpdate(
      { _id: req.params.id, status: "open" },
      {
        status,
        resolvedBy: req.userId,
        resolvedAt: new Date(),
        resolutionNote: String(note).slice(0, 1000),
      },
      { new: true },
    );

    if (!report) {
      return res.status(404).json({ message: "Жалоба не найдена или уже рассмотрена" });
    }

    // Telling the reporter that somebody looked is what stops reporting from
    // feeling like shouting into a void — and app stores ask for evidence that
    // reports are acted on.
    createNotification({
      recipient: report.reporter,
      actor: req.userId,
      type: "system",
      title: status === "actioned" ? "Жалоба рассмотрена" : "Жалоба отклонена",
      description:
        status === "actioned"
          ? "Мы проверили ваше обращение и приняли меры."
          : "Мы проверили ваше обращение и не нашли нарушения правил.",
      relatedId: report._id,
      relatedType: "report",
    }).catch(() => {});

    return res.status(200).json({ _id: report._id, status: report.status, resolvedAt: report.resolvedAt });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Не удалось обновить жалобу" });
  }
};
