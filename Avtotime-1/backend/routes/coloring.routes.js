import express from 'express';
import { saveColoringDrawing, getUserColoringDrawings, getColoringDrawing, listColoringTemplates, autoColorSvg } from '../controllers/coloring.controllers.js';
import isAuth from '../middlewars/isAuth.js';

const router = express.Router();

// Сохранить рисунок
router.post('/save', isAuth, async (req, res) => {
  await saveColoringDrawing(req, res);
});

// Получить все рисунки пользователя
router.get('/user-drawings', isAuth, async (req, res) => {
  await getUserColoringDrawings(req, res);
});

// Получить конкретный рисунок
router.get('/drawing/:drawingId', isAuth, async (req, res) => {
  await getColoringDrawing(req, res);
});

// Public list of available templates (no auth)
router.get('/templates', async (req, res) => {
  await listColoringTemplates(req, res);
});

// Auto-color SVG (public; used by kids puzzle previews)
router.post('/auto', async (req, res) => {
  await autoColorSvg(req, res);
});

export default router;
