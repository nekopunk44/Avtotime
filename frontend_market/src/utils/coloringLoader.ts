// Utility to load coloring SVG files from backend/public via /api/public/*

import { API_URL } from './config';
import type { ColoringTemplate, ColoringCategory, ColoringPart } from '../types/coloring';

export type ColoringCollection = 'coloring' | 'coloring_mult';

// Cache for loaded templates
const templateCache = new Map<string, ColoringTemplate>();

export const buildPublicSvgUrl = (collection: ColoringCollection, filename: string) => {
  // Note: encodeURIComponent is important for spaces/cyrillic filenames
  const normalized = String(filename || '').replace(/^\/+/, '');
  const encodedPath = normalized
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${API_URL}/public/${collection}/${encodedPath}`;
};

export type ColoringTemplateListItem = {
  filename: string;
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  category: ColoringCategory;
  collection: ColoringCollection;
};

export async function fetchColoringTemplateList(collection: ColoringCollection): Promise<ColoringTemplateListItem[]> {
  const url = `${API_URL}/coloring/templates?collection=${collection}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to load templates list (${response.status})`);
  }
  const data = await response.json();
  const templates = Array.isArray(data?.templates) ? data.templates : [];

  return templates
    .map((t: any) => ({
      filename: String(t.filename),
      id: String(t.id),
      title: String(t.title || t.id),
      subtitle: String(t.subtitle || ''),
      emoji: String(t.emoji || '🎨'),
      category: String(t.category) as ColoringCategory,
      collection: (t.collection === 'coloring_mult' ? 'coloring_mult' : 'coloring') as ColoringCollection,
    }))
    .filter((t: ColoringTemplateListItem) => !!t.filename && !!t.id);
}

function normalizeSvgForDisplay(svgContent: string): { svgContent: string; viewBox?: string; width?: number; height?: number } {
  // Many user-provided SVGs (e.g. from Inkscape) can have incorrect viewBox
  // and/or paths far outside the declared coordinate system. We compute a tight
  // bbox in a hidden DOM node and rewrite viewBox to avoid clipped rendering.
  if (typeof document === 'undefined') return { svgContent };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return { svgContent };

    const holder = document.createElement('div');
    holder.style.position = 'absolute';
    holder.style.left = '-100000px';
    holder.style.top = '-100000px';
    holder.style.width = '0';
    holder.style.height = '0';
    holder.style.overflow = 'hidden';
    holder.style.pointerEvents = 'none';
    holder.style.visibility = 'hidden';

    const liveSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Keep defs + inner drawing
    liveSvg.innerHTML = svg.innerHTML;
    liveSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    liveSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    holder.appendChild(liveSvg);
    document.body.appendChild(holder);

    let bbox: DOMRect | null = null;
    try {
      // SVGSVGElement implements getBBox in browsers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bbox = (liveSvg as any).getBBox?.() ?? null;
    } catch {
      bbox = null;
    }

    document.body.removeChild(holder);

    if (!bbox || !isFinite(bbox.x) || !isFinite(bbox.y) || !isFinite(bbox.width) || !isFinite(bbox.height)) {
      return { svgContent };
    }

    // Avoid zero-sized boxes
    const w = Math.max(1, Math.round(bbox.width));
    const h = Math.max(1, Math.round(bbox.height));
    const viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;

    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    // Drop explicit width/height so it scales correctly everywhere; keep numeric dims for canvas
    svg.removeAttribute('width');
    svg.removeAttribute('height');

    const serializer = new XMLSerializer();
    const normalized = serializer.serializeToString(svg);
    return { svgContent: normalized, viewBox, width: w, height: h };
  } catch {
    return { svgContent };
  }
}

/**
 * Parse SVG file content and extract coloring parts
 * For simple SVGs without data-part-id attributes, treats the whole SVG as one part
 */
export function parseColoringSVG(
  svgContent: string,
  metadata: {
    id: string;
    title: string;
    subtitle: string;
    emoji: string;
    category: ColoringCategory;
  }
): ColoringTemplate | null {
  try {
    const parser = new DOMParser();
    
    // Try parsing as SVG first
    let doc = parser.parseFromString(svgContent, 'image/svg+xml');
    let svg = doc.querySelector('svg');
    
    // If parsing failed, try as XML
    if (!svg) {
      doc = parser.parseFromString(svgContent, 'text/xml');
      svg = doc.querySelector('svg');
    }
    
    // If still no SVG, try wrapping in svg tags
    if (!svg) {
      const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
      doc = parser.parseFromString(wrapped, 'image/svg+xml');
      svg = doc.querySelector('svg');
    }
    
    if (!svg) {
      console.error('No SVG element found in content');
      return null;
    }

    // Extract viewBox and dimensions
    const viewBox = svg.getAttribute('viewBox') || '0 0 400 300';
    let width = parseInt(svg.getAttribute('width') || '400', 10);
    let height = parseInt(svg.getAttribute('height') || '300', 10);
    
    // If width/height are viewBox dimensions, extract from viewBox
    if (width < 50 && height < 50 && viewBox) {
      const viewBoxParts = viewBox.split(' ');
      if (viewBoxParts.length === 4) {
        width = parseInt(viewBoxParts[2], 10);
        height = parseInt(viewBoxParts[3], 10);
      }
    }
    
    if (metadata.category === 'cartoons') {
      console.log(`[Cartoon] Загружаем ${metadata.title}: viewBox=${viewBox}, size=${width}x${height}`);
    }

    // Find all parts (paths or groups with data-part-id)
    const parts: ColoringPart[] = [];
    const partElements = svg.querySelectorAll('[data-part-id]');
    
    if (partElements.length > 0) {
      // SVG has defined parts - use them
      partElements.forEach((el) => {
        const id = el.getAttribute('data-part-id');
        const name = el.getAttribute('data-part-name') || id || 'Часть';
        
        if (id) {
          // Get path data - for paths use 'd', for groups use all child paths
          let path = '';
          if (el.tagName.toLowerCase() === 'path') {
            path = el.getAttribute('d') || '';
          } else {
            // For groups, combine all child paths
            const paths = el.querySelectorAll('path');
            path = Array.from(paths).map(p => p.getAttribute('d') || '').join(' ');
          }
          
          if (path) {
            parts.push({ id, name, path });
          }
        }
      });
    } else {
      // No defined parts - treat the whole SVG as one colorable part
      // Extract all paths from the SVG
      const allPaths = svg.querySelectorAll('path');
      const combinedPath = Array.from(allPaths)
        .map(p => p.getAttribute('d'))
        .filter((d): d is string => !!d)
        .join(' ');
      
      if (combinedPath) {
        parts.push({
          id: 'body',
          name: 'Кузов',
          path: combinedPath
        });
      } else {
        // If no paths found, create a placeholder part
        parts.push({
          id: 'body',
          name: 'Машинка',
          path: 'M 50 150 L 350 150 L 350 200 L 50 200 Z'
        });
      }
    }

    return {
      id: metadata.id,
      title: metadata.title,
      subtitle: metadata.subtitle,
      emoji: metadata.emoji,
      category: metadata.category,
      viewBox,
      width,
      height,
      parts,
      svgContent: svgContent // Include raw SVG content for canvas mode
    };
  } catch (error) {
    console.error('Error parsing SVG:', error);
    return null;
  }
}

/**
 * Load coloring template from static imports or fetch from public folder
 */
export async function loadColoringTemplate(
  item: ColoringTemplateListItem,
  metadata: {
    id: string;
    title: string;
    subtitle: string;
    emoji: string;
    category: ColoringCategory;
  }
): Promise<ColoringTemplate | null> {
  // Check cache
  const cacheKey = `${item.collection}/${item.filename}-${metadata.id}`;
  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey)!;
  }

  try {
    const url = buildPublicSvgUrl(item.collection, item.filename);
    console.log(`[Loader] Fetching SVG from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`SVG file not found: ${item.filename} (${response.status})`);
      return null;
    }
    const originalSvg = await response.text();
    console.log(`[Loader] Loaded ${item.filename} (${originalSvg.length} bytes)`);

    const normalized = item.collection === 'coloring_mult' ? normalizeSvgForDisplay(originalSvg) : { svgContent: originalSvg };
    const svgContent = normalized.svgContent;
    
    const template = parseColoringSVG(svgContent, metadata);
    
    if (template) {
      template.svgContent = svgContent;
      if (normalized.viewBox) template.viewBox = normalized.viewBox;
      if (typeof normalized.width === 'number') template.width = normalized.width;
      if (typeof normalized.height === 'number') template.height = normalized.height;
      (template as any).filename = item.filename;
      (template as any).collection = item.collection;
      (template as any).svgUrl = url;
      templateCache.set(cacheKey, template);
    } else {
      console.error(`Failed to parse SVG: ${item.filename}`);
    }
    
    return template;
  } catch (error) {
    console.error(`Error loading ${item.filename}:`, error);
    return null;
  }
}

/**
 * Load all coloring templates from manifest
 */
export async function loadAllColoringTemplates(
  items: ColoringTemplateListItem[]
): Promise<ColoringTemplate[]> {
  const templates: ColoringTemplate[] = [];
  
  for (const item of items) {
    const template = await loadColoringTemplate(item, {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      emoji: item.emoji,
      category: item.category,
    });
    
    if (template) {
      templates.push(template);
    }
  }
  
  return templates;
}

/**
 * Group templates by category
 */
export function groupTemplatesByCategory(
  templates: ColoringTemplate[]
): Record<ColoringCategory, ColoringTemplate[]> {
  const grouped: Record<ColoringCategory, ColoringTemplate[]> = {
    cars: [],
    special: [],
    racing: [],
    trucks: [],
    cartoons: [],
  };

  templates.forEach(template => {
    if (grouped[template.category]) {
      grouped[template.category].push(template);
    }
  });

  return grouped;
}
