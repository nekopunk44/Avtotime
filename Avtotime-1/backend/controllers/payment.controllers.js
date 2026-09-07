import Stripe from 'stripe';
import geoip from 'geoip-lite';
import { Types } from 'mongoose';
import User from '../models/user.model.js';
import Payment from '../models/payment.model.js';
import { getPlanLimits, serializePlanLimits, getEffectivePlan } from '../config/planLimits.js';
import { applyUserPlanToListings } from '../services/applyUserPlanToListings.js';

const CIS_COUNTRIES = new Set(['RU', 'BY', 'KZ', 'UZ', 'AZ', 'AM', 'GE', 'KG', 'MD', 'TJ', 'TM']);

export const getGeo = (req, res) => {
  const ip = req.ip || '';
  const geo = geoip.lookup(ip);
  const country = geo?.country || null;
  return res.json({ country, isCis: CIS_COUNTRIES.has(country) });
};

const PLAN_PRICES = {
  pro:      { amount: 2900, label: 'Pro Seller' },
  business: { amount: 7900, label: 'Business' },
};
const CURRENCY = 'eur';
const PLAN_DURATION_DAYS = 30;

const STRIPE_TIMEOUT_MS = 10_000;

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY не настроен');
  return new Stripe(key, { apiVersion: '2024-06-20', timeout: STRIPE_TIMEOUT_MS });
};

const audit = (action, data) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), action, ...data }));
};

export const createPaymentIntent = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ message: 'Неверный тариф' });
    }

    // Серверное зеркало гео-блока. Клиентская проверка обходится одним
    // curl'ом и открывается при любой ошибке сети — юридическое ограничение
    // не может держаться на вежливости браузера. Неопределившийся IP
    // пропускаем: наказывать пользователя за пробел в geo-базе нельзя,
    // а обход через VPN неустраним на любом уровне.
    const country = geoip.lookup(req.ip || '')?.country || null;
    if (country && CIS_COUNTRIES.has(country)) {
      audit('payment.geo_blocked', { userId: String(req.userId), country });
      return res.status(403).json({
        message: 'Оплата картой недоступна в вашем регионе',
        country,
      });
    }

    const stripe = getStripe();
    const user = await User.findById(req.userId).select('email stripeCustomerId name');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.name || undefined,
        metadata: { userId: String(user._id) },
      });
      customerId = customer.id;
      await User.updateOne({ _id: user._id }, { stripeCustomerId: customerId });
    }

    const { amount, label } = PLAN_PRICES[plan];

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: CURRENCY,
      customer: customerId,
      description: `AVTOTIME Market — ${label} (1 месяц)`,
      metadata: { userId: String(user._id), plan },
      automatic_payment_methods: { enabled: true },
    });

    await Payment.create({
      user: user._id,
      plan,
      amount,
      currency: CURRENCY,
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      stripeCustomerId: customerId,
    });

    audit('payment.intent_created', { userId: String(user._id), plan, amount, piId: paymentIntent.id });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      amount,
      currency: CURRENCY,
      label,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Ошибка создания платежа' });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ message: 'paymentIntentId is required' });

    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId, user: req.userId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const stripe = getStripe();
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (stripeErr) {
      const status = stripeErr?.statusCode === 404 ? 404 : 502;
      return res.status(status).json({ message: stripeErr?.message || 'Ошибка Stripe' });
    }

    if (paymentIntent.metadata?.userId !== String(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: `Payment is not completed (status: ${paymentIntent.status})` });
    }

    const plan = paymentIntent.metadata?.plan;
    if (!PLAN_PRICES[plan]) return res.status(400).json({ message: 'Invalid plan in payment intent' });

    if (payment.status === 'succeeded') {
      const user = await User.findById(req.userId).select('plan planActivatedAt planExpiresAt').lean();
      const effectivePlan = getEffectivePlan(user?.plan, user?.planExpiresAt);
      const planLimits = serializePlanLimits(getPlanLimits(effectivePlan));

      return res.status(200).json({
        plan: user?.plan || plan,
        effectivePlan,
        planActivatedAt: user?.planActivatedAt || payment.periodStart || null,
        planExpiresAt: user?.planExpiresAt || payment.periodEnd || null,
        planLimits,
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Grant the entitlement first, settle the Payment row last: the row is the
    // retry marker, so a crash in between leaves it `pending` and the webhook
    // (or a repeat call) re-runs the activation instead of losing it. Writing
    // absolute dates keeps repeats idempotent, including concurrent calls.
    await User.updateOne(
      { _id: req.userId },
      { plan, planActivatedAt: now, planExpiresAt: expiresAt, planExpiryWarnedThreshold: null },
    );

    const effectivePlan = getEffectivePlan(plan, expiresAt);
    const planLimits = serializePlanLimits(getPlanLimits(effectivePlan));

    try {
      await applyUserPlanToListings(req.userId, effectivePlan);
    } catch (err) {
      console.error('[payment] applyUserPlanToListings failed for user %s: %s', req.userId, err?.message);
    }

    await Payment.updateOne(
      { _id: payment._id, status: { $ne: 'succeeded' } },
      { status: 'succeeded', periodStart: now, periodEnd: expiresAt },
    );

    audit('payment.confirmed', { userId: String(req.userId), plan, piId: paymentIntentId, expiresAt });

    return res.status(200).json({
      plan,
      effectivePlan,
      planActivatedAt: now,
      planExpiresAt: expiresAt,
      planLimits,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Payment confirmation failed' });
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('plan planExpiresAt planActivatedAt')
      .lean();
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const payments = await Payment.find({ user: req.userId, status: 'succeeded' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      plan: user.plan || 'free',
      planExpiresAt: user.planExpiresAt || null,
      planActivatedAt: user.planActivatedAt || null,
      payments,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Ошибка получения статуса' });
  }
};

// ─── Stripe webhook ───────────────────────────────────────────────────────────

export const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ message: 'Webhook secret not configured' });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err?.message}` });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(event.data.object);
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const updated = await Payment.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { status: 'failed' },
        { new: true },
      );
      if (updated) {
        audit('payment.failed', { userId: String(updated.user), plan: updated.plan, piId: pi.id });
      }
    }
  } catch (err) {
    // Never answer 200 on a processing failure: Stripe only redelivers on a
    // non-2xx, and the paid-for entitlement is granted inside the handler.
    console.error('[webhook] processing error for event %s: %s', event.id, err?.message);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }

  return res.status(200).json({ received: true });
};

/**
 * Grants the paid plan, then records the payment as settled.
 *
 * Order matters: the Payment row is the retry marker, so it is written LAST.
 * If the process dies half-way the row is still `pending`, Stripe redelivers
 * and the whole thing runs again. Doing it the other way round (mark paid,
 * then activate) loses the entitlement permanently, because the retry no
 * longer matches the `status: { $ne: 'succeeded' }` filter.
 *
 * Re-runs are safe: the plan window is written as absolute dates, and an
 * already-settled payment whose entitlement is present is skipped.
 * Throws on failure so the caller can answer 500 and trigger a Stripe retry.
 */
const handlePaymentIntentSucceeded = async (pi) => {
  const userId = pi.metadata?.userId;
  const plan = pi.metadata?.plan;

  if (!userId || !Types.ObjectId.isValid(userId) || !plan || !PLAN_PRICES[plan]) {
    // Nothing to retry — the metadata will never change. Swallow it.
    console.error('[webhook] payment_intent.succeeded missing/invalid metadata: pi=%s userId=%s plan=%s', pi.id, userId, plan);
    return;
  }

  const existing = await Payment.findOne({ stripePaymentIntentId: pi.id }).lean();
  const alreadySettled = existing?.status === 'succeeded';

  // Reuse the already-recorded window on a redelivery so a retry cannot keep
  // sliding the expiry date forward.
  const periodStart = alreadySettled && existing.periodStart ? new Date(existing.periodStart) : new Date();
  const periodEnd = alreadySettled && existing.periodEnd
    ? new Date(existing.periodEnd)
    : new Date(periodStart.getTime() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const user = await User.findById(userId).select('plan planExpiresAt').lean();
  if (!user) {
    // The account is gone; retrying forever helps nobody. Keep the money trail.
    console.error('[webhook] user not found for userId=%s pi=%s', userId, pi.id);
  } else {
    const currentExpiry = user.planExpiresAt ? new Date(user.planExpiresAt).getTime() : 0;
    const entitlementGranted = user.plan === plan && currentExpiry >= periodEnd.getTime();

    if (!entitlementGranted) {
      await User.updateOne(
        { _id: new Types.ObjectId(userId) },
        { plan, planActivatedAt: periodStart, planExpiresAt: periodEnd, planExpiryWarnedThreshold: null },
      );
      audit('payment.webhook_activated', { userId, plan, piId: pi.id, expiresAt: periodEnd });
      await applyUserPlanToListings(userId, plan);
    }
  }

  if (alreadySettled) return;

  await Payment.findOneAndUpdate(
    { stripePaymentIntentId: pi.id },
    {
      $set: { status: 'succeeded', periodStart, periodEnd },
      $setOnInsert: {
        user: new Types.ObjectId(userId),
        plan,
        amount: pi.amount_received ?? pi.amount ?? PLAN_PRICES[plan].amount,
        currency: pi.currency || CURRENCY,
        stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null,
      },
    },
    { upsert: true },
  );
};
