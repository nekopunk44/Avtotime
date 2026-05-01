import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const WIDTH = 1024;
const HEIGHT = 480;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePngRGBA(outPath, width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter byte
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const idatData = zlib.deflateSync(raw, { level: 9 });

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
}

function blend(dstR, dstG, dstB, dstA, srcR, srcG, srcB, srcA) {
  const sa = srcA / 255;
  const da = dstA / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return [0, 0, 0, 0];
  const outR = (srcR * sa + dstR * da * (1 - sa)) / outA;
  const outG = (srcG * sa + dstG * da * (1 - sa)) / outA;
  const outB = (srcB * sa + dstB * da * (1 - sa)) / outA;
  return [outR, outG, outB, outA * 255];
}

function setPixel(buf, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  const dr = buf[i];
  const dg = buf[i + 1];
  const db = buf[i + 2];
  const da = buf[i + 3];
  const [nr, ng, nb, na] = blend(dr, dg, db, da, r, g, b, a);
  buf[i] = nr | 0;
  buf[i + 1] = ng | 0;
  buf[i + 2] = nb | 0;
  buf[i + 3] = na | 0;
}

function fillRect(buf, x0, y0, x1, y1, r, g, b, a) {
  const xa = clamp(Math.floor(x0), 0, WIDTH - 1);
  const xb = clamp(Math.ceil(x1), 0, WIDTH);
  const ya = clamp(Math.floor(y0), 0, HEIGHT - 1);
  const yb = clamp(Math.ceil(y1), 0, HEIGHT);
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) setPixel(buf, x, y, r, g, b, a);
  }
}

function fillEllipse(buf, cx, cy, rx, ry, r, g, b, a) {
  const x0 = clamp(Math.floor(cx - rx - 1), 0, WIDTH - 1);
  const x1 = clamp(Math.ceil(cx + rx + 1), 0, WIDTH);
  const y0 = clamp(Math.floor(cy - ry - 1), 0, HEIGHT - 1);
  const y1 = clamp(Math.ceil(cy + ry + 1), 0, HEIGHT);
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const v = (dx * dx) / rx2 + (dy * dy) / ry2;
      if (v <= 1) setPixel(buf, x, y, r, g, b, a);
    }
  }
}

function fillPolygon(buf, pts, r, g, b, a) {
  // basic scanline fill (no AA)
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const y0 = clamp(Math.floor(minY), 0, HEIGHT - 1);
  const y1 = clamp(Math.ceil(maxY), 0, HEIGHT);
  for (let y = y0; y < y1; y++) {
    const scanY = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const aP = pts[i];
      const bP = pts[(i + 1) % pts.length];
      if ((aP.y <= scanY && bP.y > scanY) || (bP.y <= scanY && aP.y > scanY)) {
        const t = (scanY - aP.y) / (bP.y - aP.y);
        xs.push(aP.x + (bP.x - aP.x) * t);
      }
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i < xs.length; i += 2) {
      const xA = clamp(Math.floor(xs[i]), 0, WIDTH - 1);
      const xB = clamp(Math.ceil(xs[i + 1]), 0, WIDTH);
      for (let x = xA; x < xB; x++) setPixel(buf, x, y, r, g, b, a);
    }
  }
}

function drawGradientBackground(buf) {
  for (let y = 0; y < HEIGHT; y++) {
    const t = y / (HEIGHT - 1);
    // sky -> road
    const r = 240 + (220 - 240) * t;
    const g = 246 + (228 - 246) * t;
    const b = 255 + (235 - 255) * t;
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      buf[i] = r | 0;
      buf[i + 1] = g | 0;
      buf[i + 2] = b | 0;
      buf[i + 3] = 255;
    }
  }
  // ground
  fillRect(buf, 0, HEIGHT * 0.62, WIDTH, HEIGHT, 230, 232, 236, 255);
  // vignette
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = (x - WIDTH / 2) / (WIDTH / 2);
      const dy = (y - HEIGHT / 2) / (HEIGHT / 2);
      const v = Math.sqrt(dx * dx + dy * dy);
      const dark = clamp((v - 0.55) * 120, 0, 40);
      const i = (y * WIDTH + x) * 4;
      buf[i] = clamp(buf[i] - dark, 0, 255);
      buf[i + 1] = clamp(buf[i + 1] - dark, 0, 255);
      buf[i + 2] = clamp(buf[i + 2] - dark, 0, 255);
    }
  }
}

function drawCar(buf) {
  const baseY = HEIGHT * 0.66;
  const cx = WIDTH * 0.55;

  // shadow
  fillEllipse(buf, cx, baseY + 55, 260, 42, 0, 0, 0, 28);
  fillEllipse(buf, cx, baseY + 55, 210, 34, 0, 0, 0, 22);

  // wheels
  const wheelY = baseY + 30;
  const w1x = cx - 170;
  const w2x = cx + 150;
  fillEllipse(buf, w1x, wheelY, 52, 52, 20, 22, 26, 255);
  fillEllipse(buf, w2x, wheelY, 52, 52, 20, 22, 26, 255);
  fillEllipse(buf, w1x, wheelY, 30, 30, 60, 66, 76, 255);
  fillEllipse(buf, w2x, wheelY, 30, 30, 60, 66, 76, 255);
  fillEllipse(buf, w1x, wheelY, 14, 14, 20, 22, 26, 255);
  fillEllipse(buf, w2x, wheelY, 14, 14, 20, 22, 26, 255);

  // body (stylized "photo-like" gradient with layers)
  const body = [
    { x: cx - 280, y: baseY + 10 },
    { x: cx - 240, y: baseY - 40 },
    { x: cx - 140, y: baseY - 55 },
    { x: cx - 80, y: baseY - 100 },
    { x: cx + 60, y: baseY - 110 },
    { x: cx + 170, y: baseY - 85 },
    { x: cx + 255, y: baseY - 40 },
    { x: cx + 285, y: baseY + 5 },
    { x: cx + 260, y: baseY + 25 },
    { x: cx + 160, y: baseY + 30 },
    { x: cx + 120, y: baseY + 45 },
    { x: cx - 120, y: baseY + 45 },
    { x: cx - 160, y: baseY + 30 },
    { x: cx - 255, y: baseY + 25 },
  ];

  // base paint
  fillPolygon(buf, body, 212, 38, 54, 255);
  // darker lower part
  const lower = body.map((p, i) => ({ x: p.x, y: p.y + (i % 2 === 0 ? 18 : 10) }));
  fillPolygon(buf, lower, 170, 24, 36, 180);
  // highlight stripe
  const stripe = [
    { x: cx - 220, y: baseY - 28 },
    { x: cx - 120, y: baseY - 42 },
    { x: cx + 60, y: baseY - 55 },
    { x: cx + 190, y: baseY - 40 },
    { x: cx + 210, y: baseY - 18 },
    { x: cx + 120, y: baseY - 10 },
    { x: cx - 40, y: baseY - 2 },
    { x: cx - 190, y: baseY + 5 },
  ];
  fillPolygon(buf, stripe, 255, 255, 255, 36);

  // windows
  const win = [
    { x: cx - 120, y: baseY - 56 },
    { x: cx - 70, y: baseY - 94 },
    { x: cx + 40, y: baseY - 100 },
    { x: cx + 120, y: baseY - 82 },
    { x: cx + 70, y: baseY - 58 },
  ];
  fillPolygon(buf, win, 16, 25, 38, 220);
  fillPolygon(buf, win, 255, 255, 255, 12);

  // headlight
  fillEllipse(buf, cx - 235, baseY - 12, 26, 14, 255, 255, 255, 180);
  fillEllipse(buf, cx - 235, baseY - 12, 18, 9, 255, 224, 170, 160);

  // small specular
  fillEllipse(buf, cx + 120, baseY - 70, 75, 28, 255, 255, 255, 14);
}

function main() {
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);
  drawGradientBackground(rgba);
  drawCar(rgba);

  const outPath = path.resolve(process.cwd(), 'frontend_market/src/assets/dots-connect-preview.png');
  writePngRGBA(outPath, WIDTH, HEIGHT, rgba);
  console.log('Wrote', outPath);
}

main();

