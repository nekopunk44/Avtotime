export type Dot = { x: number; y: number };

export type DotsTemplate = {
  id: string;
  title: string;
  dots: Dot[];
};

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 250;
const DOT_COUNT = 50;
const PADDING = 18;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const dist = (a: Dot, b: Dot) => Math.hypot(a.x - b.x, a.y - b.y);

const fitToCanvas = (points: Dot[]): Dot[] => {
  if (points.length === 0) return points;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min((CANVAS_WIDTH - PADDING * 2) / width, (CANVAS_HEIGHT - PADDING * 2) / height);
  const tx = (CANVAS_WIDTH - width * scale) / 2 - minX * scale;
  const ty = (CANVAS_HEIGHT - height * scale) / 2 - minY * scale;

  return points.map((p) => ({
    x: p.x * scale + tx,
    y: p.y * scale + ty,
  }));
};

const resampleClosedPolyline = (poly: Dot[], count: number): Dot[] => {
  if (poly.length < 2) return poly;

  const first = poly[0];
  const last = poly[poly.length - 1];
  const points = first.x === last.x && first.y === last.y ? poly : [...poly, first];

  const lengths = points.slice(1).map((p, i) => dist(points[i], p));
  const total = lengths.reduce((sum, len) => sum + len, 0);
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

const buildDots = (outline: Dot[], count: number) => {
  const fitted = fitToCanvas(outline);
  const sampled = resampleClosedPolyline(fitted, count);
  return sampled.map((p) => ({
    x: clamp(p.x, 10, CANVAS_WIDTH - 10),
    y: clamp(p.y, 10, CANVAS_HEIGHT - 10),
  }));
};

const arc = (cx: number, cy: number, r: number, start: number, end: number, steps: number): Dot[] => {
  const pts: Dot[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + (end - start) * t;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
};

const jitter = (base: number, amount: number, seed: number) => {
  // deterministic-ish jitter in [-amount, +amount]
  const t = Math.sin(seed * 999 + base * 0.01) * 10000;
  const r = t - Math.floor(t);
  return base + (r * 2 - 1) * amount;
};

type BaseKind = 'car' | 'suv' | 'pickup' | 'box-truck' | 'bus';

type Variant = { id: string; title: string; kind: BaseKind; seed: number };

const baseVariant = (kind: BaseKind, seed: number): Dot[] => {
  const bottomY = 82;
  const topY = jitter(40, 4, seed);
  const roofY = jitter(24, 6, seed);
  const noseX = jitter(10, 6, seed);
  const tailX = jitter(190, 8, seed);
  const wheelR = clamp(jitter(kind === 'suv' ? 22 : 18, 3, seed), 16, 26);
  const frontWheelX = jitter(55, 6, seed);
  const rearWheelX = jitter(150, 7, seed);
  const roofStartX = jitter(70, 8, seed);
  const roofEndX = clamp(jitter(130, 12, seed), roofStartX + 30, tailX - 20);

  const wheelSteps = 12;

  const pts: Dot[] = [];

  // Top silhouette differs by kind
  const bump = (x: number, y: number) => pts.push({ x, y });

  if (kind === 'bus') {
    bump(noseX, bottomY - wheelR * 0.2);
    bump(noseX + 6, topY + 6);
    bump(tailX - 10, topY + 4);
    bump(tailX, bottomY - wheelR * 0.2);
  } else if (kind === 'box-truck') {
    // cab + box (step)
    bump(noseX, bottomY - wheelR * 0.2);
    bump(noseX + 10, topY + 10);
    bump(roofStartX, roofY + 10);
    bump(roofStartX + 15, roofY);
    bump(roofStartX + 35, roofY);
    bump(roofStartX + 45, roofY + 10);
    bump(roofStartX + 50, topY + 6);
    bump(tailX - 12, topY + 6);
    bump(tailX, bottomY - wheelR * 0.2);
  } else if (kind === 'pickup') {
    bump(noseX, bottomY - wheelR * 0.2);
    bump(noseX + 10, topY + 10);
    bump(roofStartX, roofY + 10);
    bump(roofStartX + 12, roofY);
    bump(roofEndX - 6, roofY);
    bump(roofEndX, roofY + 12);
    bump(roofEndX + 8, topY + 6); // cabin end
    bump(tailX - 2, topY + 6); // bed top
    bump(tailX, bottomY - wheelR * 0.2);
  } else {
    // car/suv
    const roofRound = clamp(jitter(kind === 'car' ? 12 : 9, 3, seed), 6, 16);
    bump(noseX, bottomY - wheelR * 0.2);
    bump(noseX + 10, topY + 10);
    bump(roofStartX - 10, topY);
    bump(roofStartX, roofY + roofRound);
    bump(roofStartX + roofRound, roofY);
    bump(roofEndX - roofRound, roofY);
    bump(roofEndX, roofY + roofRound);
    bump(tailX - 18, topY + 2);
    bump(tailX, bottomY - wheelR * 0.2);
  }

  // Bottom with wheel bumps (right to left)
  const bottom = bottomY;

  // rear wheel bump
  pts.push({ x: rearWheelX + wheelR, y: bottom });
  pts.push(...arc(rearWheelX, bottom, wheelR, 0, Math.PI, wheelSteps).slice(1));
  pts.push({ x: rearWheelX - wheelR, y: bottom });

  if (kind === 'bus' || kind === 'box-truck') {
    const midWheelX = clamp(jitter(105, 6, seed), frontWheelX + 35, rearWheelX - 35);
    pts.push({ x: midWheelX + wheelR, y: bottom });
    pts.push(...arc(midWheelX, bottom, wheelR, 0, Math.PI, wheelSteps).slice(1));
    pts.push({ x: midWheelX - wheelR, y: bottom });
  }

  pts.push({ x: frontWheelX + wheelR, y: bottom });
  pts.push(...arc(frontWheelX, bottom, wheelR, 0, Math.PI, wheelSteps).slice(1));
  pts.push({ x: frontWheelX - wheelR, y: bottom });

  // close
  pts.push({ x: noseX, y: bottom });
  return pts;
};

const VARIANTS: Variant[] = [
  // 12 cars
  { id: 'sedan', title: 'Седан', kind: 'car', seed: 1 },
  { id: 'coupe', title: 'Купе', kind: 'car', seed: 2 },
  { id: 'hatch', title: 'Хэтчбек', kind: 'car', seed: 3 },
  { id: 'wagon', title: 'Универсал', kind: 'car', seed: 4 },
  { id: 'convertible', title: 'Кабриолет', kind: 'car', seed: 5 },
  { id: 'race', title: 'Гоночная', kind: 'car', seed: 6 },
  { id: 'retro', title: 'Ретро', kind: 'car', seed: 7 },
  { id: 'electric', title: 'Электрокар', kind: 'car', seed: 8 },
  { id: 'micro', title: 'Микро', kind: 'car', seed: 9 },
  { id: 'limousine', title: 'Лимузин', kind: 'car', seed: 10 },
  { id: 'taxi', title: 'Такси', kind: 'car', seed: 11 },
  { id: 'police', title: 'Полиция', kind: 'car', seed: 12 },

  // 6 SUVs
  { id: 'suv', title: 'Внедорожник', kind: 'suv', seed: 21 },
  { id: 'crossover', title: 'Кроссовер', kind: 'suv', seed: 22 },
  { id: 'offroad', title: 'Оффроад', kind: 'suv', seed: 23 },
  { id: 'monster', title: 'Монстр-трак', kind: 'suv', seed: 24 },
  { id: 'rally', title: 'Ралли', kind: 'suv', seed: 25 },
  { id: 'camper', title: 'Кемпер', kind: 'suv', seed: 26 },

  // 6 pickups
  { id: 'pickup', title: 'Пикап', kind: 'pickup', seed: 31 },
  { id: 'utility', title: 'Утилити', kind: 'pickup', seed: 32 },
  { id: 'work', title: 'Рабочий', kind: 'pickup', seed: 33 },
  { id: 'desert', title: 'Пустынный', kind: 'pickup', seed: 34 },
  { id: 'sport-pickup', title: 'Пикап спорт', kind: 'pickup', seed: 35 },
  { id: 'classic-pickup', title: 'Пикап классик', kind: 'pickup', seed: 36 },

  // 4 box trucks
  { id: 'truck', title: 'Грузовик', kind: 'box-truck', seed: 41 },
  { id: 'firetruck', title: 'Пожарная', kind: 'box-truck', seed: 42 },
  { id: 'ambulance', title: 'Скорая', kind: 'box-truck', seed: 43 },
  { id: 'towtruck', title: 'Эвакуатор', kind: 'box-truck', seed: 44 },

  // 2 buses
  { id: 'bus', title: 'Автобус', kind: 'bus', seed: 51 },
  { id: 'minibus', title: 'Маршрутка', kind: 'bus', seed: 52 },
];

// Convert to final templates with stable 50-dot lists.
export const DOT_TEMPLATES: DotsTemplate[] = VARIANTS.slice(0, 30).map((v, idx) => {
  const outline = baseVariant(v.kind, v.seed + idx);
  return {
    id: v.id,
    title: v.title,
    dots: buildDots(outline, DOT_COUNT),
  };
});
