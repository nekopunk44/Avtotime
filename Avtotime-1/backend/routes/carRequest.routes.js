import express from 'express';
import { sendCarRequest } from '../controllers/carRequest.controllers.js';
import { authLimiter } from '../middlewars/rateLimiters.js';
import optionalAuth from '../middlewars/optionalAuth.js';

const router = express.Router();

// Public endpoint that sends two emails per call — strict rate limit so it
// cannot be used as a spam relay.
router.post('/send-car-request', authLimiter, optionalAuth, sendCarRequest);

export default router;
