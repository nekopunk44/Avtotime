import ColoringDrawing from '../models/coloringDrawing.model.js';
import isAuth from '../middlewars/isAuth.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MAX_AUTO_COLOR_CACHE = 500;
const autoColorCache = new Map();

const COLOR_PALETTE = [
  '#FF6B6B',
  '#FFD93D',
  '#6BCB77',
  '#4D96FF',
  '#9D4EDD',
  '#FF922B',
  '#2EC4B6',
  '#F06595',
  '#74C0FC',
  '#51CF66',
];

const isProbablySvgMarkup = (value) => typeof value === 'string' && value.trim().startsWith('<');

const asDataUrlSvg = (svgMarkup) => {
  const base64 = Buffer.from(String(svgMarkup), 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
};

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const readSvgFromPublicUrl = async (svgUrl) => {
  const raw = String(svgUrl || '');
  const marker = '/api/public/';
  const idx = raw.indexOf(marker);
  if (idx === -1) {
    throw new Error('Only /api/public/* URLs are supported for auto coloring');
  }

  let rel = raw.slice(idx + marker.length);
  rel = rel.split('?')[0].split('#')[0];
  rel = safeDecodeURIComponent(rel);

  // Prevent path traversal
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid public SVG path');
  }

  const fullPath = path.join(PUBLIC_DIR, rel);
  return fs.readFile(fullPath, 'utf8');
};

const extractSvgMarkup = async (svgContent) => {
  const raw = String(svgContent || '').trim();
  if (!raw) throw new Error('Missing svgContent');

  if (raw.startsWith('data:image/svg+xml')) {
    // data:image/svg+xml;base64,... OR data:image/svg+xml;utf8,...
    const comma = raw.indexOf(',');
    if (comma === -1) throw new Error('Invalid data URL');
    const meta = raw.slice(0, comma);
    const data = raw.slice(comma + 1);
    if (meta.includes(';base64')) {
      return Buffer.from(data, 'base64').toString('utf8');
    }
    return safeDecodeURIComponent(data);
  }

  if (isProbablySvgMarkup(raw)) {
    return raw;
  }

  // Treat as URL to /api/public/*
  if (raw.includes('/api/public/')) {
    return readSvgFromPublicUrl(raw);
  }

  throw new Error('Unsupported svgContent format');
};

const autoColorizeSvg = (svgMarkup, seed) => {
  const palette = COLOR_PALETTE;
  let colorIndex = 0;

  const pick = () => {
    const c = palette[colorIndex % palette.length];
    colorIndex += 1;
    return c;
  };

  const salt = seed ? String(seed) : '';
  if (salt) {
    // simple deterministic shift based on seed
    const h = crypto.createHash('sha1').update(salt).digest();
    colorIndex = h[0] || 0;
  }

  const applyToTag = (tagName) => {
    const re = new RegExp(`<${tagName}\\b([^>]*?)(\\/?)>`, 'gi');
    return (match, attrs, selfClose) => {
      const hasFill = /\\bfill\\s*=\\s*['"][^'"]*['"]/i.test(attrs);
      const isFillNone = /\\bfill\\s*=\\s*['"]\\s*(none|transparent)\\s*['"]/i.test(attrs);

      let nextAttrs = attrs;
      if (isFillNone) {
        nextAttrs = nextAttrs.replace(/\\bfill\\s*=\\s*['"][^'"]*['"]/i, `fill="${pick()}"`);
        if (!/\\bfill-opacity\\s*=\\s*['"][^'"]*['"]/i.test(nextAttrs)) {
          nextAttrs += ` fill-opacity="0.85"`;
        }
      } else if (!hasFill) {
        nextAttrs += ` fill="${pick()}" fill-opacity="0.85"`;
      }

      return `<${tagName}${nextAttrs}${selfClose}>`;
    };
  };

  let out = String(svgMarkup);
  out = out.replace(/<\\?xml[^>]*>/gi, '');

  // Color only common shape primitives.
  out = out.replace(new RegExp(`<path\\b([^>]*?)(\\/?)>`, 'gi'), applyToTag('path'));
  out = out.replace(new RegExp(`<rect\\b([^>]*?)(\\/?)>`, 'gi'), applyToTag('rect'));
  out = out.replace(new RegExp(`<circle\\b([^>]*?)(\\/?)>`, 'gi'), applyToTag('circle'));
  out = out.replace(new RegExp(`<ellipse\\b([^>]*?)(\\/?)>`, 'gi'), applyToTag('ellipse'));
  out = out.replace(new RegExp(`<polygon\\b([^>]*?)(\\/?)>`, 'gi'), applyToTag('polygon'));
  out = out.replace(new RegExp(`<polyline\\b([^>]*?)(\\/?)>`, 'gi'), applyToTag('polyline'));

  return out;
};

const toTemplateId = (filename) => {
  const base = path.basename(filename, path.extname(filename));
  const normalized = base
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0400-\u04FF-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || base || filename;
};

const toTitleFromFilename = (filename) => {
  const base = path.basename(filename, path.extname(filename));
  return base.replace(/[_-]+/g, ' ').trim() || filename;
};

// Сохранить рисунок пользователя
export const saveColoringDrawing = async (req, res) => {
  try {
    const userId = req.userId;
    const { templateId, title, imageData, progress, brushSize, colorsUsed } = req.body;

    // Проверяем обязательные поля
    if (!templateId || !imageData || !title) {
      return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
    }

    // Создаем или обновляем рисунок
    const drawing = await ColoringDrawing.findOneAndUpdate(
      { userId, templateId },
      {
        userId,
        templateId,
        title,
        imageData,
        progress: progress || 0,
        brushSize: brushSize || 20,
        colorsUsed: colorsUsed || [],
        updatedAt: new Date()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      drawing: {
        id: drawing._id,
        templateId,
        title,
        progress,
        savedAt: drawing.updatedAt
      }
    });
  } catch (error) {
    console.error('Ошибка при сохранении рисунка:', error);
    res.status(500).json({ error: 'Ошибка при сохранении рисунка' });
  }
};

// Получить сохраненные рисунки пользователя
// Public list of available SVG templates stored under backend/public/*
// GET /api/coloring/templates?collection=coloring|coloring_mult
export const listColoringTemplates = async (req, res) => {
  try {
    const collectionRaw = String(req.query.collection || 'coloring');
    const collection = collectionRaw === 'coloring_mult' ? 'coloring_mult' : 'coloring';

    const dirPath = path.join(PUBLIC_DIR, collection);

    const listSvgsRecursively = async (baseDir, relPrefix = '') => {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const out = [];
      for (const entry of entries) {
        const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        const full = path.join(baseDir, entry.name);
        if (entry.isDirectory()) {
          out.push(...(await listSvgsRecursively(full, rel)));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
          out.push(rel);
        }
      }
      return out;
    };

    const svgFilenames = (await listSvgsRecursively(dirPath))
      .sort((a, b) => a.localeCompare(b, 'ru'));

    // For "coloring" we try to enrich metadata from manifest.json (optional).
    const manifestByFilename = new Map();
    if (collection === 'coloring') {
      try {
        const manifestPath = path.join(dirPath, 'manifest.json');
        const manifestText = await fs.readFile(manifestPath, 'utf8');
        const manifestJson = JSON.parse(manifestText);
        const items = Array.isArray(manifestJson?.templates) ? manifestJson.templates : [];
        for (const item of items) {
          if (item?.filename) {
            const key = String(item.filename);
            manifestByFilename.set(key, item);
            // also allow matching by basename (in case files were moved into folders later)
            manifestByFilename.set(path.basename(key), item);
          }
        }
      } catch {
        // ignore missing/invalid manifest
      }
    }

    const templates = svgFilenames.map((filename) => {
      const fromManifest = manifestByFilename.get(filename) || manifestByFilename.get(path.basename(filename));
      const category = String(fromManifest?.category || (collection === 'coloring_mult' ? 'cartoons' : 'cars'));
      return {
        filename,
        id: String(fromManifest?.id || toTemplateId(filename)),
        title: String(fromManifest?.title || toTitleFromFilename(filename)),
        subtitle: String(fromManifest?.subtitle || ''),
        emoji: String(fromManifest?.emoji || (collection === 'coloring_mult' ? '🎬' : '🚗')),
        category,
        collection,
      };
    });

    const filteredTemplates =
      collection === 'coloring_mult'
        ? templates.filter((t) => !/^\d+$/.test(String(t.title || '').trim()))
        : templates;

    res.json({ templates: filteredTemplates });
  } catch (error) {
    console.error('Error listing coloring templates:', error);
    res.status(500).json({ error: 'Failed to list coloring templates' });
  }
};

// POST /api/coloring/auto
// Body: { svgContent: "<svg...>" | "data:image/svg+xml..." | "http://.../api/public/..." , templateId?: string }
// Returns: { success: boolean, coloredSvg?: string, error?: string }
export const autoColorSvg = async (req, res) => {
  try {
    const svgContent = req.body?.svgContent;
    const templateId = req.body?.templateId;

    const cacheKey = crypto
      .createHash('sha1')
      .update(String(templateId || ''))
      .update('|')
      .update(String(svgContent || ''))
      .digest('hex');

    const cached = autoColorCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, coloredSvg: cached });
    }

    const svgMarkup = await extractSvgMarkup(svgContent);
    const coloredMarkup = autoColorizeSvg(svgMarkup, templateId);
    const coloredDataUrl = asDataUrlSvg(coloredMarkup);

    if (autoColorCache.size >= MAX_AUTO_COLOR_CACHE) {
      autoColorCache.delete(autoColorCache.keys().next().value);
    }
    autoColorCache.set(cacheKey, coloredDataUrl);

    return res.json({ success: true, coloredSvg: coloredDataUrl });
  } catch (error) {
    return res.status(400).json({ success: false, error: error?.message || 'Failed to color SVG' });
  }
};

export const getUserColoringDrawings = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 10 } = req.query;

    const drawings = await ColoringDrawing.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ColoringDrawing.countDocuments({ userId });

    res.json({
      drawings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Ошибка при загрузке рисунков:', error);
    res.status(500).json({ error: 'Ошибка при загрузке рисунков' });
  }
};

// Получить конкретный рисунок
export const getColoringDrawing = async (req, res) => {
  try {
    const userId = req.userId;
    const { drawingId } = req.params;

    const drawing = await ColoringDrawing.findOne({ _id: drawingId, userId });

    if (!drawing) {
      return res.status(404).json({ error: 'Рисунок не найден' });
    }

    res.json(drawing);
  } catch (error) {
    console.error('Ошибка при загрузке рисунка:', error);
    res.status(500).json({ error: 'Ошибка при загрузке рисунка' });
  }
};
