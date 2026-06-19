export type Dot = { x: number; y: number };

export type DotsTemplate = {
  id: string;
  title: string;
  dots: Dot[];
};

// Virtual coordinate space — dots are designed in this 400×250 box, then
// rescaled to the actual canvas size by the consumer.
export const VIRTUAL_W = 400;
export const VIRTUAL_H = 250;

const DOT_COUNT = 32;
const PADDING = 20;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const dist = (a: Dot, b: Dot) => Math.hypot(a.x - b.x, a.y - b.y);

const fitToCanvas = (points: Dot[]): Dot[] => {
  if (points.length === 0) return points;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min((VIRTUAL_W - PADDING * 2) / w, (VIRTUAL_H - PADDING * 2) / h);
  const tx = (VIRTUAL_W - w * scale) / 2 - minX * scale;
  const ty = (VIRTUAL_H - h * scale) / 2 - minY * scale;
  return points.map((p) => ({ x: p.x * scale + tx, y: p.y * scale + ty }));
};

const resampleClosedPolyline = (poly: Dot[], count: number): Dot[] => {
  if (poly.length < 2) return poly;
  const first = poly[0];
  const last = poly[poly.length - 1];
  const points = first.x === last.x && first.y === last.y ? poly : [...poly, first];

  const lengths = points.slice(1).map((p, i) => dist(points[i], p));
  const total = lengths.reduce((s, l) => s + l, 0);
  if (total <= 0) return Array.from({ length: count }, () => ({ ...points[0] }));

  const step = total / count;
  const sampled: Dot[] = [];

  let segIndex = 0;
  let segStart = points[0];
  let segEnd = points[1];
  let segLen = lengths[0];
  let segOffset = 0;

  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (segIndex < lengths.length - 1 && segOffset + segLen < target) {
      segOffset += segLen;
      segIndex += 1;
      segStart = points[segIndex];
      segEnd = points[segIndex + 1];
      segLen = lengths[segIndex];
    }
    const t = segLen === 0 ? 0 : (target - segOffset) / segLen;
    sampled.push({
      x: segStart.x + (segEnd.x - segStart.x) * t,
      y: segStart.y + (segEnd.y - segStart.y) * t,
    });
  }
  return sampled;
};

const buildDots = (outline: Dot[], count: number): Dot[] => {
  const fitted = fitToCanvas(outline);
  const sampled = resampleClosedPolyline(fitted, count);
  return sampled.map((p) => ({
    x: clamp(p.x, 8, VIRTUAL_W - 8),
    y: clamp(p.y, 8, VIRTUAL_H - 8),
  }));
};

// Half-circle arc going DOWNWARD: starts at (cx+r, y), curves down to (cx, y+r),
// then back up to (cx-r, y). Used for wheel arches that poke below the body line.
const arcDown = (cx: number, r: number, y: number, steps = 6): Dot[] => {
  const pts: Dot[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI * (i / steps);
    pts.push({ x: cx + r * Math.cos(a), y: y + r * Math.sin(a) });
  }
  return pts;
};

type VehicleSpec = {
  id: string;
  title: string;
  /** Y-coordinate of the body bottom (where wheel arches start). */
  bodyBottom: number;
  wheelR: number;
  frontWheelX: number;
  rearWheelX: number;
  /** Optional middle axle for buses / trucks. */
  midWheelX?: number;
  /** Upper outline points: front-bumper-bottom-left → over the roof → rear-bumper-bottom-right. */
  topPoints: Dot[];
};

const buildVehicleOutline = (s: VehicleSpec): Dot[] => {
  const pts: Dot[] = [...s.topPoints];

  // Travel back to the front along the bottom, adding wheel arches.
  pts.push({ x: s.rearWheelX + s.wheelR + 6, y: s.bodyBottom });
  pts.push(...arcDown(s.rearWheelX, s.wheelR, s.bodyBottom));
  pts.push({ x: s.rearWheelX - s.wheelR - 6, y: s.bodyBottom });

  if (s.midWheelX !== undefined) {
    pts.push({ x: s.midWheelX + s.wheelR + 6, y: s.bodyBottom });
    pts.push(...arcDown(s.midWheelX, s.wheelR, s.bodyBottom));
    pts.push({ x: s.midWheelX - s.wheelR - 6, y: s.bodyBottom });
  }

  pts.push({ x: s.frontWheelX + s.wheelR + 6, y: s.bodyBottom });
  pts.push(...arcDown(s.frontWheelX, s.wheelR, s.bodyBottom));
  pts.push({ x: s.frontWheelX - s.wheelR - 6, y: s.bodyBottom });

  return pts;
};

const VEHICLES: VehicleSpec[] = [
  {
    id: 'sedan',
    title: 'Седан',
    bodyBottom: 130,
    wheelR: 20,
    frontWheelX: 100,
    rearWheelX: 305,
    topPoints: [
      { x: 30, y: 130 },
      { x: 22, y: 116 },
      { x: 26, y: 100 },
      { x: 50, y: 88 },
      { x: 115, y: 84 },
      { x: 140, y: 80 },
      { x: 165, y: 62 },
      { x: 188, y: 48 },
      { x: 210, y: 44 },
      { x: 250, y: 44 },
      { x: 272, y: 48 },
      { x: 292, y: 62 },
      { x: 312, y: 80 },
      { x: 340, y: 86 },
      { x: 365, y: 96 },
      { x: 376, y: 110 },
      { x: 380, y: 130 },
    ],
  },
  {
    id: 'suv',
    title: 'Внедорожник',
    bodyBottom: 130,
    wheelR: 26,
    frontWheelX: 100,
    rearWheelX: 310,
    topPoints: [
      { x: 30, y: 130 },
      { x: 20, y: 110 },
      { x: 22, y: 88 },
      { x: 40, y: 72 },
      { x: 95, y: 64 },
      { x: 130, y: 60 },
      { x: 150, y: 42 },
      { x: 170, y: 28 },
      { x: 195, y: 22 },
      { x: 295, y: 22 },
      { x: 320, y: 30 },
      { x: 340, y: 50 },
      { x: 360, y: 72 },
      { x: 375, y: 96 },
      { x: 382, y: 130 },
    ],
  },
  {
    id: 'sport',
    title: 'Спорткар',
    bodyBottom: 142,
    wheelR: 18,
    frontWheelX: 90,
    rearWheelX: 315,
    topPoints: [
      { x: 18, y: 142 },
      { x: 15, y: 128 },
      { x: 28, y: 118 },
      { x: 70, y: 112 },
      { x: 125, y: 100 },
      { x: 160, y: 84 },
      { x: 195, y: 72 },
      { x: 230, y: 70 },
      { x: 260, y: 76 },
      { x: 295, y: 88 },
      { x: 335, y: 96 },
      { x: 370, y: 104 },
      { x: 384, y: 122 },
      { x: 385, y: 142 },
    ],
  },
  {
    id: 'pickup',
    title: 'Пикап',
    bodyBottom: 132,
    wheelR: 22,
    frontWheelX: 95,
    rearWheelX: 320,
    topPoints: [
      { x: 28, y: 132 },
      { x: 22, y: 116 },
      { x: 26, y: 100 },
      { x: 50, y: 86 },
      { x: 115, y: 80 },
      { x: 140, y: 76 },
      { x: 156, y: 56 },
      { x: 172, y: 38 },
      { x: 195, y: 32 },
      { x: 245, y: 32 },
      { x: 262, y: 38 },
      { x: 280, y: 56 },
      // cab back -> bed wall (slight notch)
      { x: 292, y: 76 },
      { x: 308, y: 72 },
      { x: 370, y: 72 },
      { x: 382, y: 86 },
      { x: 386, y: 132 },
    ],
  },
  {
    id: 'truck',
    title: 'Грузовик',
    bodyBottom: 134,
    wheelR: 20,
    frontWheelX: 70,
    rearWheelX: 330,
    midWheelX: 275,
    topPoints: [
      { x: 24, y: 134 },
      { x: 16, y: 116 },
      { x: 20, y: 96 },
      { x: 40, y: 84 },
      { x: 80, y: 78 },
      { x: 96, y: 74 },
      { x: 102, y: 52 },
      { x: 110, y: 28 },
      { x: 132, y: 18 },
      { x: 160, y: 18 },
      { x: 168, y: 28 },
      { x: 172, y: 50 },
      { x: 178, y: 72 },
      // cab/box gap
      { x: 192, y: 70 },
      { x: 200, y: 30 },
      { x: 370, y: 30 },
      { x: 382, y: 44 },
      { x: 386, y: 134 },
    ],
  },
  {
    id: 'bus',
    title: 'Автобус',
    bodyBottom: 138,
    wheelR: 22,
    frontWheelX: 75,
    rearWheelX: 330,
    topPoints: [
      { x: 20, y: 138 },
      { x: 12, y: 116 },
      { x: 12, y: 50 },
      { x: 22, y: 30 },
      { x: 44, y: 22 },
      { x: 360, y: 22 },
      { x: 380, y: 30 },
      { x: 388, y: 50 },
      { x: 388, y: 116 },
      { x: 380, y: 138 },
    ],
  },
  {
    id: 'race',
    title: 'Гоночная',
    bodyBottom: 142,
    wheelR: 18,
    frontWheelX: 80,
    rearWheelX: 320,
    topPoints: [
      { x: 10, y: 142 },
      { x: 6, y: 128 },
      { x: 14, y: 120 },
      { x: 40, y: 116 },
      // cockpit
      { x: 110, y: 110 },
      { x: 165, y: 96 },
      { x: 185, y: 78 },
      { x: 215, y: 76 },
      { x: 240, y: 92 },
      // engine cover + rear wing
      { x: 280, y: 102 },
      { x: 330, y: 106 },
      { x: 360, y: 96 },
      { x: 380, y: 86 },
      { x: 396, y: 86 },
      { x: 396, y: 110 },
      { x: 376, y: 116 },
      { x: 388, y: 132 },
      { x: 388, y: 142 },
    ],
  },
  {
    id: 'hatchback',
    title: 'Хэтчбек',
    bodyBottom: 130,
    wheelR: 20,
    frontWheelX: 95,
    rearWheelX: 290,
    topPoints: [
      { x: 28, y: 130 },
      { x: 20, y: 112 },
      { x: 24, y: 98 },
      { x: 48, y: 84 },
      { x: 110, y: 78 },
      { x: 138, y: 72 },
      { x: 160, y: 54 },
      { x: 184, y: 40 },
      { x: 210, y: 36 },
      { x: 295, y: 36 },
      { x: 318, y: 56 },
      { x: 338, y: 86 },
      { x: 362, y: 100 },
      { x: 376, y: 116 },
      { x: 378, y: 130 },
    ],
  },
  {
    id: 'convertible',
    title: 'Кабриолет',
    bodyBottom: 130,
    wheelR: 20,
    frontWheelX: 100,
    rearWheelX: 305,
    topPoints: [
      { x: 30, y: 130 },
      { x: 22, y: 114 },
      { x: 26, y: 100 },
      { x: 50, y: 88 },
      { x: 115, y: 82 },
      { x: 142, y: 78 },
      { x: 156, y: 64 },
      { x: 168, y: 66 },
      // small windscreen + open cabin
      { x: 184, y: 84 },
      { x: 270, y: 80 },
      { x: 296, y: 82 },
      { x: 320, y: 86 },
      { x: 352, y: 92 },
      { x: 374, y: 104 },
      { x: 380, y: 130 },
    ],
  },
  {
    id: 'minivan',
    title: 'Минивэн',
    bodyBottom: 132,
    wheelR: 22,
    frontWheelX: 95,
    rearWheelX: 310,
    topPoints: [
      { x: 28, y: 132 },
      { x: 20, y: 114 },
      { x: 22, y: 92 },
      { x: 38, y: 76 },
      { x: 75, y: 64 },
      { x: 110, y: 50 },
      { x: 140, y: 38 },
      { x: 175, y: 30 },
      { x: 320, y: 30 },
      { x: 345, y: 38 },
      { x: 365, y: 62 },
      { x: 380, y: 92 },
      { x: 384, y: 132 },
    ],
  },
];

export const DOT_TEMPLATES: DotsTemplate[] = VEHICLES.map((v) => ({
  id: v.id,
  title: v.title,
  dots: buildDots(buildVehicleOutline(v), DOT_COUNT),
}));
