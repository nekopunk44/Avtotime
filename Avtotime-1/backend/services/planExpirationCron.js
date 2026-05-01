import User from "../models/user.model.js";
import { applyUserPlanToListings } from "./applyUserPlanToListings.js";
import { createNotification } from "../controllers/notification.controllers.js";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 час
const WARNING_THRESHOLDS = [7, 3, 1]; // дни до истечения

let timer = null;
let running = false;

const PLAN_LABEL = { pro: "Pro Seller", business: "Business" };

const daysLeft = (planExpiresAt, now) =>
  Math.ceil((new Date(planExpiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

const pickThreshold = (left) => {
  for (const t of WARNING_THRESHOLDS) {
    if (left <= t) return t;
  }
  return null;
};

const sendExpiryWarning = async (user, threshold) => {
  const label = PLAN_LABEL[user.plan] || user.plan;
  const expiresAt = new Date(user.planExpiresAt);
  const formatted = expiresAt.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const description =
    threshold === 1
      ? `Подписка «${label}» истекает завтра — ${formatted}. Продлите тариф, чтобы сохранить приоритет в каталоге и расширенные лимиты.`
      : `Подписка «${label}» истекает через ${threshold} дн. (${formatted}). Не забудьте продлить, чтобы не потерять преимущества плана.`;

  await createNotification({
    recipient: user._id,
    actor: user._id, // система
    type: "system",
    title: `Тариф ${label} скоро истечёт`,
    description,
    relatedId: user._id,
    relatedType: "user",
    link: "/market?view=tariffs",
  });
};

/**
 * Находит пользователей с истёкшим планом и переводит их на free.
 * Так же пересчитывает priority/sellerBadge/expiresAt у их объявлений.
 * Дополнительно шлёт предупреждения о скором истечении (за 7/3/1 день).
 */
export const runPlanExpirationCheck = async () => {
  if (running) return { skipped: true };
  running = true;

  const now = new Date();
  let downgraded = 0;
  let warned = 0;

  try {
    const expiredUsers = await User.find({
      plan: { $in: ["pro", "business"] },
      planExpiresAt: { $ne: null, $lt: now },
    })
      .select("_id plan planExpiresAt")
      .lean();

    for (const user of expiredUsers) {
      try {
        await User.updateOne(
          { _id: user._id, planExpiresAt: user.planExpiresAt },
          {
            $set: {
              plan: "free",
              planActivatedAt: null,
              planExpiresAt: null,
              planExpiryWarnedThreshold: null,
            },
          },
        );

        await applyUserPlanToListings(user._id, "free");
        downgraded += 1;
      } catch (err) {
        console.error(
          `planExpirationCron: failed to downgrade user ${user._id}:`,
          err?.message || err,
        );
      }
    }

    // Предупреждения: пользователи с активным планом, истекающим в ближайшие 7 дней
    const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const soonUsers = await User.find({
      plan: { $in: ["pro", "business"] },
      planExpiresAt: { $gt: now, $lte: soonThreshold },
    })
      .select("_id plan planExpiresAt planExpiryWarnedThreshold")
      .lean();

    for (const user of soonUsers) {
      const left = daysLeft(user.planExpiresAt, now);
      const threshold = pickThreshold(left);
      if (!threshold) continue;

      const last = user.planExpiryWarnedThreshold;
      // Шлём только если новый порог меньше уже отправленного (или ещё не слали)
      if (last !== null && last !== undefined && last <= threshold) continue;

      try {
        await sendExpiryWarning(user, threshold);
        await User.updateOne(
          { _id: user._id, planExpiresAt: user.planExpiresAt },
          { $set: { planExpiryWarnedThreshold: threshold } },
        );
        warned += 1;
      } catch (err) {
        console.error(
          `planExpirationCron: failed to warn user ${user._id}:`,
          err?.message || err,
        );
      }
    }

    if (downgraded > 0) {
      console.log(`planExpirationCron: downgraded ${downgraded} users to free plan`);
    }
    if (warned > 0) {
      console.log(`planExpirationCron: sent ${warned} expiry warnings`);
    }

    return { downgraded, warned };
  } finally {
    running = false;
  }
};

export const startPlanExpirationCron = ({ intervalMs } = {}) => {
  if (timer) return;

  const ms = Math.max(
    60 * 1000, // не меньше минуты
    Number(intervalMs) ||
      Number(process.env.PLAN_EXPIRATION_INTERVAL_MS) ||
      DEFAULT_INTERVAL_MS,
  );

  // Первый запуск с задержкой, чтобы не блокировать старт сервера
  setTimeout(() => {
    runPlanExpirationCheck().catch((err) =>
      console.error("planExpirationCron: initial run failed:", err?.message || err),
    );
  }, 30 * 1000);

  timer = setInterval(() => {
    runPlanExpirationCheck().catch((err) =>
      console.error("planExpirationCron: tick failed:", err?.message || err),
    );
  }, ms);

  if (typeof timer.unref === "function") timer.unref();

  console.log(`planExpirationCron started (interval ${ms} ms)`);
};

export const stopPlanExpirationCron = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
