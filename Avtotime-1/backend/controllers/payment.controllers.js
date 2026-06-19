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

    // Atomic update prevents double-activation on concurrent confirmPayment calls
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: 'succeeded' } },
      { status: 'succeeded', periodStart: now, periodEnd: expiresAt },
      { new: true },
    );

    if (!updatedPayment) {
      // Another concurrent request already activated — return current state
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

    await User.updateOne(
      { _id: req.userId },
      { plan, planActivatedAt: now, planExpiresAt: expiresAt, planExpiryWarnedThreshold: null },
    );

    audit('payment.confirmed', { userId: String(req.userId), plan, piId: paymentIntentId, expiresAt });

    const effectivePlan = getEffectivePlan(plan, expiresAt);
    const planLimits = serializePlanLimits(getPlanLimits(effectivePlan));

    try {
      await applyUserPlanToListings(req.userId, effectivePlan);
    } catch (err) {
      console.error('[payment] applyUserPlanToListings failed for user %s: %s', req.userId, err?.message);
    }

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
      const pi = event.data.object;
      const userId = pi.metadata?.userId;
      const plan = pi.metadata?.plan;

      if (!userId || !Types.ObjectId.isValid(userId) || !plan || !PLAN_PRICES[plan]) {
        console.error('[webhook] payment_intent.succeeded missing/invalid metadata: pi=%s userId=%s plan=%s', pi.id, userId, plan);
      } else {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000);

        // findOneAndUpdate with $ne ensures idempotency on Stripe webhook retries
        const payment = await Payment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id, status: { $ne: 'succeeded' } },
          { status: 'succeeded', periodStart: now, periodEnd: expiresAt },
          { new: true },
        );

        if (payment) {
          const result = await User.updateOne(
            { _id: new Types.ObjectId(userId) },
            { plan, planActivatedAt: now, planExpiresAt: expiresAt, planExpiryWarnedThreshold: null },
          );
          if (result.matchedCount === 0) {
            console.error('[webhook] user not found for userId=%s pi=%s', userId, pi.id);
          } else {
            audit('payment.webhook_activated', { userId, plan, piId: pi.id, expiresAt });
            try {
              await applyUserPlanToListings(userId, plan);
            } catch (err) {
              console.error('[webhook] applyUserPlanToListings failed for user %s: %s', userId, err?.message);
            }
          }
        }
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const updated = await Payment.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { status: 'failed' },
        { new: true },
      ).catch(() => null);
      if (updated) {
        audit('payment.failed', { userId: String(updated.user), plan: updated.plan, piId: pi.id });
      }
    }
  } catch (err) {
    console.error('[webhook] processing error for event %s: %s', event.id, err?.message);
  }

  return res.status(200).json({ received: true });
};
