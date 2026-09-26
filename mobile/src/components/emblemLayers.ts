// Сгенерировано scripts/split_emblem.py — не править руками.
// Слои — куски настоящего логотипа; координаты в холсте 1024×1024.
export const EMBLEM_CANVAS = 1024;

export interface EmblemLayer {
  src: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const EMBLEM_LAYERS = {
  ring: { src: require('../../assets/emblem/ring.png'), x: 182, y: 205, w: 525, h: 299 },
  dial: { src: require('../../assets/emblem/dial.png'), x: 240, y: 262, w: 399, h: 228 },
  carTop: { src: require('../../assets/emblem/carTop.png'), x: 135, y: 386, w: 650, h: 210 },
  carBody: { src: require('../../assets/emblem/carBody.png'), x: 88, y: 395, w: 848, h: 328 },
  wheel: { src: require('../../assets/emblem/wheel.png'), x: 457, y: 524, w: 121, h: 149 },
  grille1: { src: require('../../assets/emblem/grille1.png'), x: 134, y: 659, w: 150, h: 19 },
  grille2: { src: require('../../assets/emblem/grille2.png'), x: 123, y: 647, w: 177, h: 18 },
  grille3: { src: require('../../assets/emblem/grille3.png'), x: 117, y: 633, w: 196, h: 18 },
  grille4: { src: require('../../assets/emblem/grille4.png'), x: 115, y: 618, w: 203, h: 19 },
  grille5: { src: require('../../assets/emblem/grille5.png'), x: 116, y: 606, w: 190, h: 18 },
  tr1: { src: require('../../assets/emblem/tr1.png'), x: 657, y: 236, w: 163, h: 72 },
  tr2: { src: require('../../assets/emblem/tr2.png'), x: 683, y: 268, w: 170, h: 73 },
  tr3: { src: require('../../assets/emblem/tr3.png'), x: 705, y: 308, w: 159, h: 62 },
  tr4: { src: require('../../assets/emblem/tr4.png'), x: 729, y: 343, w: 148, h: 50 },
  mid: { src: require('../../assets/emblem/mid.png'), x: 769, y: 430, w: 165, h: 73 },
  br1: { src: require('../../assets/emblem/br1.png'), x: 650, y: 538, w: 201, h: 84 },
  br2: { src: require('../../assets/emblem/br2.png'), x: 598, y: 572, w: 262, h: 103 },
  fl1: { src: require('../../assets/emblem/fl1.png'), x: 198, y: 696, w: 136, h: 48 },
  fl2: { src: require('../../assets/emblem/fl2.png'), x: 224, y: 708, w: 144, h: 58 },
  fl3: { src: require('../../assets/emblem/fl3.png'), x: 185, y: 721, w: 219, h: 81 },
  specksLeft: { src: require('../../assets/emblem/specksLeft.png'), x: 117, y: 384, w: 69, h: 94 },
  specksRight: { src: require('../../assets/emblem/specksRight.png'), x: 824, y: 225, w: 75, h: 315 },
  specksBottom: { src: require('../../assets/emblem/specksBottom.png'), x: 123, y: 734, w: 97, h: 85 },
} as const;

export type EmblemLayerName = keyof typeof EMBLEM_LAYERS;
