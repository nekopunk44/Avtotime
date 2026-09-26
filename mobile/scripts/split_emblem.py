# -*- coding: utf-8 -*-
"""Режет фирменную эмблему (assets/splash-icon.png) на слои для анимации.

Логотип — белая графика на прозрачном фоне, и его части не соприкасаются:
связные области дают кольцо спидометра, циферблат, крышу, корпус, колесо,
полосы решётки, каждый штрих скорости и искры по отдельности. Скрипт
раскладывает области по смысловым слоям, обрезает каждый по рамке и пишет
PNG в assets/emblem/ плюс манифест src/components/emblemLayers.ts с
координатами. Запуск из mobile/: python scripts/split_emblem.py
"""
import os

import numpy as np
import scipy.ndimage as ndi
from PIL import Image

SRC = 'assets/splash-icon.png'
OUT_DIR = 'assets/emblem'
MANIFEST = 'src/components/emblemLayers.ts'
PAD = 2          # запас рамки, чтобы не срезать сглаженный край
DILATE = 2       # захват полупрозрачной кромки вокруг области

# Номера связных областей (8-связность, порядок ndi.label) по слоям.
# Проверены глазами по карте компонент: см. историю задачи.
GROUPS = {
    'ring': [1],                    # внешнее кольцо спидометра с заклёпками
    'dial': [4, 7, 8],              # циферблат: правый и левый сектор, метка
    'carTop': [12],                 # крыша и верх кузова
    'carBody': [14, 25, 27, 19],    # корпус, юбка, штрих двери, задний блик
    'wheel': [21, 23],              # шина и ступица
    'grille1': [31],                # полосы решётки, снизу вверх
    'grille2': [30],
    'grille3': [29],
    'grille4': [28],
    'grille5': [26],
    'tr1': [3],                     # верхний правый веер штрихов, сверху вниз
    'tr2': [6],
    'tr3': [9],
    'tr4': [10],
    'mid': [17],                    # штрих сквозь корму
    'br1': [22],                    # нижние правые штрихи
    'br2': [24],
    'fl1': [32],                    # штрихи у переднего колеса
    'fl2': [33],
    'fl3': [34],
    'specksLeft': [11, 13, 15, 16, 18],
    'specksRight': [2, 5, 20],
    'specksBottom': [35, 36, 37, 38, 39, 40],
}


def main():
    img = Image.open(SRC).convert('RGBA')
    a = np.array(img)
    op = a[..., 3] > 40
    lbl, n = ndi.label(op, structure=np.ones((3, 3)))
    used = sorted({c for comps in GROUPS.values() for c in comps})
    if used[-1] > n:
        raise SystemExit(f'В логотипе {n} областей, а в раскладке есть номер {used[-1]} — картинка изменилась?')

    os.makedirs(OUT_DIR, exist_ok=True)
    entries = []
    h, w = op.shape
    for name, comps in GROUPS.items():
        mask = np.isin(lbl, comps)
        mask = ndi.binary_dilation(mask, iterations=DILATE)
        ys, xs = np.where(mask)
        x0, x1 = max(0, xs.min() - PAD), min(w, xs.max() + 1 + PAD)
        y0, y1 = max(0, ys.min() - PAD), min(h, ys.max() + 1 + PAD)
        layer = a.copy()
        layer[~mask] = 0
        crop = layer[y0:y1, x0:x1]
        Image.fromarray(crop).save(f'{OUT_DIR}/{name}.png')
        entries.append((name, x0, y0, x1 - x0, y1 - y0))
        print(f'{name}: x={x0} y={y0} w={x1 - x0} h={y1 - y0}')

    lines = [
        '// Сгенерировано scripts/split_emblem.py — не править руками.',
        '// Слои — куски настоящего логотипа; координаты в холсте 1024×1024.',
        'export const EMBLEM_CANVAS = 1024;',
        '',
        'export interface EmblemLayer {',
        '  src: number;',
        '  x: number;',
        '  y: number;',
        '  w: number;',
        '  h: number;',
        '}',
        '',
        'export const EMBLEM_LAYERS = {',
    ]
    for name, x0, y0, ww, hh in entries:
        lines.append(
            f"  {name}: {{ src: require('../../assets/emblem/{name}.png'), "
            f'x: {x0}, y: {y0}, w: {ww}, h: {hh} }},'
        )
    lines += ['} as const;', '', 'export type EmblemLayerName = keyof typeof EMBLEM_LAYERS;', '']
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'манифест: {MANIFEST}')


if __name__ == '__main__':
    main()
