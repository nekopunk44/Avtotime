import express from 'express';
import { sendCarRequest } from '../controllers/carRequest.controllers.js';

const router = express.Router();

router.post('/send-car-request', sendCarRequest);

export default router;
