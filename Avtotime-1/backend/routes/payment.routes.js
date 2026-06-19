import express from 'express';
import isAuth from '../middlewars/isAuth.js';
import { csrfOriginCheck } from '../middlewars/csrfOrigin.js';
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
  getGeo,
} from '../controllers/payment.controllers.js';

const paymentRouter = express.Router();

paymentRouter.get('/geo', getGeo);
paymentRouter.get('/status', isAuth, getPaymentStatus);
paymentRouter.post('/create-intent', isAuth, csrfOriginCheck, createPaymentIntent);
paymentRouter.post('/confirm', isAuth, csrfOriginCheck, confirmPayment);

export default paymentRouter;
