import express from 'express';
import isAuth from '../middlewars/isAuth.js';
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
} from '../controllers/payment.controllers.js';

const paymentRouter = express.Router();

paymentRouter.get('/status', isAuth, getPaymentStatus);
paymentRouter.post('/create-intent', isAuth, createPaymentIntent);
paymentRouter.post('/confirm', isAuth, confirmPayment);

export default paymentRouter;
