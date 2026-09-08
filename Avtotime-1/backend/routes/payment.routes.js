import express from 'express';
import isAuth from '../middlewars/isAuth.js';
import { csrfOriginCheck } from '../middlewars/csrfOrigin.js';
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
  getGeo,
} from '../controllers/payment.controllers.js';
import {
  getStoreBillingConfig,
  verifyStorePurchase,
  googleStoreNotify,
  appleStoreNotify,
} from '../controllers/storeBilling.controllers.js';

const paymentRouter = express.Router();

paymentRouter.get('/geo', getGeo);
paymentRouter.get('/status', isAuth, getPaymentStatus);
paymentRouter.post('/create-intent', isAuth, csrfOriginCheck, createPaymentIntent);
paymentRouter.post('/confirm', isAuth, csrfOriginCheck, confirmPayment);

// ── Подписки через сторы (мобилка) ──────────────────────────────────────────
// Без csrfOriginCheck: мобильные запросы не несут Origin, а строгая проверка
// требует его наличия. CSRF-пол на весь /api при этом действует: браузерный
// запрос с чужим Origin сюда всё равно не пройдёт.
paymentRouter.get('/store/config', isAuth, getStoreBillingConfig);
paymentRouter.post('/store/verify', isAuth, verifyStorePurchase);

// Вебхуки сторов. Аутентификации у входов нет намеренно: их содержимое — лишь
// указатель, состояние перечитывается нашим запросом к стору (см. контроллер).
paymentRouter.post('/store/google-notify', googleStoreNotify);
paymentRouter.post('/store/apple-notify', appleStoreNotify);

export default paymentRouter;
