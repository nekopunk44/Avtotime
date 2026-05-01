import Stripe from 'stripe';
import User from '../models/user.model.js';
import Payment from '../models/payment.model.js';
import { getPlanLimits, serializePlanLimits, getEffectivePlan } from '../config/planLimits.js';
import { applyUserPlanToListings } from '../services/applyUserPlanToListings.js';

const PLAN_PRICES = {
  pro:      { amount: 2900, label: 'Pro Seller' },
  business: { amount: 7900, label: 'Business' },
};
const CURRENCY = 'eur';
const PLAN_DURATION_DAYS = 30;

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY не настроен');
  return new Stripe(key, { apiVersion: '2024-06-20' });
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

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
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
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

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

    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: 'succeeded' } },
      { status: 'succeeded', periodStart: now, periodEnd: expiresAt },
      { new: true },
    );

    if (!updatedPayment) {
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

    const effectivePlan = getEffectivePlan(plan, expiresAt);
    const planLimits = serializePlanLimits(getPlanLimits(effectivePlan));

    applyUserPlanToListings(req.userId, effectivePlan).catch((err) =>
      console.error('Failed to apply plan to listings:', err)
    );

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

      if (userId && plan && PLAN_PRICES[plan]) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000);
        const payment = await Payment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id, status: { $ne: 'succeeded' } },
          { status: 'succeeded', periodStart: now, periodEnd: expiresAt },
          { new: true },
        );

        if (payment) {
          await User.updateOne(
            { _id: userId },
            { plan, planActivatedAt: now, planExpiresAt: expiresAt, planExpiryWarnedThreshold: null },
          );
          applyUserPlanToListings(userId, plan).catch((err) =>
            console.error('Failed to apply plan to listings (webhook):', err)
          );
        }
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { status: 'failed' },
      ).catch(() => {});
    }
  } catch {
    // webhook processing errors should not fail the response
  }

  return res.status(200).json({ received: true });
};
