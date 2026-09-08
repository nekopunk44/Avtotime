import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['pro', 'business'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'eur' },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    stripePaymentIntentId: { type: String, default: null },
    stripeCustomerId: { type: String, default: null },
    // Покупки в сторах. provider отличает источник; storeTransactionId — ключ
    // идемпотентности: у Google это purchaseToken (стабилен через продления),
    // у Apple — originalTransactionId (тоже переживает продления).
    provider: { type: String, enum: ['stripe', 'google', 'apple'], default: 'stripe' },
    storeProductId: { type: String, default: null },
    storeTransactionId: { type: String, default: null },
    storeExpiresAt: { type: Date, default: null },
    // Последний чек Apple: нужен, чтобы по уведомлению стора перепроверить
    // подписку СВОИМ запросом к Apple, а не доверять содержимому уведомления.
    latestReceipt: { type: String, default: null, select: false },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ stripePaymentIntentId: 1 }, { sparse: true });
paymentSchema.index({ provider: 1, storeTransactionId: 1 }, { unique: true, sparse: true });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
