import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import { getPlanLimits, serializePlanLimits, getEffectivePlan } from "../config/planLimits.js";
import {
  isGoogleConfigured,
  isAppleConfigured,
  verifyGoogleSubscription,
  acknowledgeGoogleSubscription,
  verifyAppleReceipt,
  activateStorePlan,
} from "../services/storeBilling.js";

const planResponse = async (userId) => {
  const user = await User.findById(userId).select("plan planActivatedAt planExpiresAt").lean();
  const effectivePlan = getEffectivePlan(user?.plan, user?.planExpiresAt);
  return {
    plan: user?.plan || "free",
    effectivePlan,
    planActivatedAt: user?.planActivatedAt || null,
    planExpiresAt: user?.planExpiresAt || null,
    planLimits: serializePlanLimits(getPlanLimits(effectivePlan)),
  };
};

/** Мобилка спрашивает, какие платформы реально настроены, и прячет остальное. */
export const getStoreBillingConfig = (req, res) =>
  res.status(200).json({ google: isGoogleConfigured(), apple: isAppleConfigured() });

/**
 * Единственная точка выдачи тарифа за сторовую покупку. Клиент приносит токен;
 * состояние подписки сервер выясняет сам у стора. Повторный вызов с тем же
 * токеном безопасен и используется мобилкой для «восстановить покупки» и для
 * подхвата продлений при старте приложения.
 */
export const verifyStorePurchase = async (req, res) => {
  try {
    const { platform } = req.body || {};

    if (platform === "google") {
      if (!isGoogleConfigured()) {
        return res.status(503).json({ message: "Оплата через Google Play пока не настроена" });
      }
      const purchaseToken = String(req.body.purchaseToken || "").trim();
      if (!purchaseToken) return res.status(400).json({ message: "purchaseToken обязателен" });

      const sub = await verifyGoogleSubscription(purchaseToken);
      if (!sub.active || !sub.productId) {
        return res.status(400).json({ message: `Подписка не активна (${sub.state})` });
      }

      const activated = await activateStorePlan({
        userId: req.userId,
        provider: "google",
        productId: sub.productId,
        transactionId: purchaseToken,
        expiresAt: sub.expiresAt,
      });
      // Без подтверждения Google сам вернёт деньги через три дня.
      if (!sub.acknowledged) {
        await acknowledgeGoogleSubscription(sub.productId, purchaseToken).catch((e) =>
          console.error("[store] google acknowledge failed:", e?.message),
        );
      }
      return res.status(200).json(await planResponse(activated.userId));
    }

    if (platform === "apple") {
      if (!isAppleConfigured()) {
        return res.status(503).json({ message: "Оплата через App Store пока не настроена" });
      }
      const receipt = String(req.body.receipt || "").trim();
      if (!receipt) return res.status(400).json({ message: "receipt обязателен" });

      const sub = await verifyAppleReceipt(receipt);
      if (!sub.active || !sub.productId) {
        return res.status(400).json({ message: "Активная подписка в чеке не найдена" });
      }

      const activated = await activateStorePlan({
        userId: req.userId,
        provider: "apple",
        productId: sub.productId,
        transactionId: sub.originalTransactionId,
        expiresAt: sub.expiresAt,
        latestReceipt: sub.latestReceipt,
      });
      return res.status(200).json(await planResponse(activated.userId));
    }

    return res.status(400).json({ message: "platform должен быть google или apple" });
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 502;
    return res.status(status).json({ message: error?.message || "Не удалось проверить покупку" });
  }
};

/**
 * RTDN от Google (Pub/Sub push). Аутентификации у входа нет намеренно:
 * содержимому мы не верим — уведомление лишь называет purchaseToken, а
 * состояние мы перечитываем своим запросом к Google. Чужой или выдуманный
 * токен просто ничего не обновит. Ответ всегда 200, иначе Pub/Sub будет
 * ретраить вечно.
 */
export const googleStoreNotify = async (req, res) => {
  try {
    const raw = req.body?.message?.data;
    if (!raw) return res.status(200).json({ ok: true });

    const payload = JSON.parse(Buffer.from(String(raw), "base64").toString("utf8"));
    const purchaseToken = payload?.subscriptionNotification?.purchaseToken;
    if (!purchaseToken || !isGoogleConfigured()) return res.status(200).json({ ok: true });

    // Обновляем только известные покупки: во время verify запись уже создана.
    const known = await Payment.findOne({ provider: "google", storeTransactionId: purchaseToken })
      .select("_id")
      .lean();
    if (!known) return res.status(200).json({ ok: true });

    const sub = await verifyGoogleSubscription(purchaseToken);
    if (sub.active && sub.productId) {
      await activateStorePlan({
        userId: null, // владелец возьмётся из существующей записи
        provider: "google",
        productId: sub.productId,
        transactionId: purchaseToken,
        expiresAt: sub.expiresAt,
      });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[store] google notify failed:", error?.message || error);
    return res.status(200).json({ ok: true });
  }
};

/**
 * Уведомления App Store. Из signedPayload берём ТОЛЬКО указатель — какой
 * originalTransactionId шевельнулся; дальше поднимаем сохранённый чек этой
 * покупки и перепроверяем его своим запросом к Apple. Так подделка
 * уведомления не даёт ничего, а честное — просто ускоряет продление.
 */
export const appleStoreNotify = async (req, res) => {
  try {
    const signedPayload = req.body?.signedPayload;
    if (!signedPayload || !isAppleConfigured()) return res.status(200).json({ ok: true });

    const decode = (jws) => {
      const part = String(jws).split(".")[1];
      if (!part) return null;
      try {
        return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
      } catch {
        return null;
      }
    };

    const payload = decode(signedPayload);
    const txn = payload?.data?.signedTransactionInfo ? decode(payload.data.signedTransactionInfo) : null;
    const originalTransactionId = txn?.originalTransactionId;
    if (!originalTransactionId) return res.status(200).json({ ok: true });

    const known = await Payment.findOne({ provider: "apple", storeTransactionId: originalTransactionId })
      .select("+latestReceipt")
      .lean();
    if (!known?.latestReceipt) return res.status(200).json({ ok: true });

    const sub = await verifyAppleReceipt(known.latestReceipt);
    if (sub.active && sub.productId) {
      await activateStorePlan({
        userId: null,
        provider: "apple",
        productId: sub.productId,
        transactionId: sub.originalTransactionId,
        expiresAt: sub.expiresAt,
        latestReceipt: sub.latestReceipt,
      });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[store] apple notify failed:", error?.message || error);
    return res.status(200).json({ ok: true });
  }
};
