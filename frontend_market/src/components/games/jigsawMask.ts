export type JigsawEdgeDir = -1 | 0 | 1;

export type JigsawEdges = {
  top: JigsawEdgeDir;
  right: JigsawEdgeDir;
  bottom: JigsawEdgeDir;
  left: JigsawEdgeDir;
};

const xmur3 = (str: string) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
};

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickDir = (rng: () => number): JigsawEdgeDir => (rng() < 0.5 ? 1 : -1);

export const buildJigsawEdges = (cols: number, rows: number, seedStr: string): JigsawEdges[] => {
  const seed = xmur3(seedStr)();
  const rng = mulberry32(seed);

  const edges: JigsawEdges[] = Array.from({ length: cols * rows }, () => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }));

  const idx = (r: number, c: number) => r * cols + c;

  // Vertical seams (left/right)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = idx(r, c);
      const b = idx(r, c + 1);
      const dir = pickDir(rng);
      edges[a].right = dir;
      edges[b].left = (dir === 1 ? -1 : 1);
    }
  }

  // Horizontal seams (top/bottom)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = idx(r, c);
      const b = idx(r + 1, c);
      const dir = pickDir(rng);
      edges[a].bottom = dir;
      edges[b].top = (dir === 1 ? -1 : 1);
    }
  }

  // Outer border is flat
  for (let r = 0; r < rows; r++) {
    edges[idx(r, 0)].left = 0;
    edges[idx(r, cols - 1)].right = 0;
  }
  for (let c = 0; c < cols; c++) {
    edges[idx(0, c)].top = 0;
    edges[idx(rows - 1, c)].bottom = 0;
  }

  return edges;
};

const encodeSvgDataUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const buildJigsawPath = (size: number, e: JigsawEdges) => {
  const L = size;
  const pad = Math.max(10, Math.round(L * 0.18));
  const depth = Math.min(Math.round(L * 0.18), Math.round(pad * 0.9));
  const a = L * 0.25;
  const b = L * 0.75;

  const top = (dir: JigsawEdgeDir) => {
    if (dir === 0) return `L ${L} 0`;
    const d = dir * depth;
    return [
      `L ${a} 0`,
      `C ${a + L * 0.08} 0 ${a + L * 0.12} ${d} ${L * 0.5} ${d}`,
      `C ${b - L * 0.12} ${d} ${b - L * 0.08} 0 ${b} 0`,
      `L ${L} 0`,
    ].join(' ');
  };

  const right = (dir: JigsawEdgeDir) => {
    if (dir === 0) return `L ${L} ${L}`;
    const d = dir * depth;
    return [
      `L ${L} ${a}`,
      `C ${L} ${a + L * 0.08} ${L + d} ${a + L * 0.12} ${L + d} ${L * 0.5}`,
      `C ${L + d} ${b - L * 0.12} ${L} ${b - L * 0.08} ${L} ${b}`,
      `L ${L} ${L}`,
    ].join(' ');
  };

  const bottom = (dir: JigsawEdgeDir) => {
    if (dir === 0) return `L 0 ${L}`;
    const d = dir * depth;
    return [
      `L ${b} ${L}`,
      `C ${b - L * 0.08} ${L} ${b - L * 0.12} ${L + d} ${L * 0.5} ${L + d}`,
      `C ${a + L * 0.12} ${L + d} ${a + L * 0.08} ${L} ${a} ${L}`,
      `L 0 ${L}`,
    ].join(' ');
  };

  const left = (dir: JigsawEdgeDir) => {
    if (dir === 0) return `L 0 0`;
    const d = dir * depth;
    // Outward for left edge goes to -x
    const dx = -d;
    return [
      `L 0 ${b}`,
      `C 0 ${b - L * 0.08} ${dx} ${b - L * 0.12} ${dx} ${L * 0.5}`,
      `C ${dx} ${a + L * 0.12} 0 ${a + L * 0.08} 0 ${a}`,
      `L 0 0`,
    ].join(' ');
  };

  const path = `M 0 0 ${top(e.top)} ${right(e.right)} ${bottom(e.bottom)} ${left(e.left)} Z`;
  const viewBox = `${-pad} ${-pad} ${L + pad * 2} ${L + pad * 2}`;
  return { path, viewBox };
};

export const makeJigsawMaskDataUrl = (size: number, edges: JigsawEdges): string => {
  const { path, viewBox } = buildJigsawPath(size, edges);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}"><path d="${path}" fill="white"/></svg>`;
  return encodeSvgDataUrl(svg);
};

