import React, { useMemo, useState } from 'react';
import { Layers, RotateCcw } from 'lucide-react';

interface SolitaireGameProps {
  onScore?: (score: number) => void;
  onComplete?: () => void;
}

type Suit = '♠' | '♥' | '♦' | '♣';
type Card = { suit: Suit; rank: number }; // 1..13

type PyramidCard = Card & {
  id: string;
  row: number;
  col: number;
  removed: boolean;
};

const suits: Suit[] = ['♠', '♥', '♦', '♣'];
const isRed = (s: Suit) => s === '♥' || s === '♦';
const label = (r: number) => (r === 1 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r));
const key = (row: number, col: number) => `${row}:${col}`;

const shuffle = <T,>(arr: T[]) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const makeDeck = () => shuffle(suits.flatMap((s) => Array.from({ length: 13 }, (_, i) => ({ suit: s, rank: i + 1 }))));

const isExposed = (p: Map<string, PyramidCard>, row: number, col: number) => {
  if (row === 6) return true;
  const left = p.get(key(row + 1, col));
  const right = p.get(key(row + 1, col + 1));
  if (!left || !right) return true;
  return left.removed && right.removed;
};

type Sel = { kind: 'pyramid'; row: number; col: number } | { kind: 'waste' };

export const SolitaireGame: React.FC<SolitaireGameProps> = ({ onScore, onComplete }) => {
  const [seed, setSeed] = useState(0);

  const baseDeck = useMemo(() => makeDeck(), [seed]);

  const [pyramid, setPyramid] = useState<Map<string, PyramidCard>>(() => {
    const p = new Map<string, PyramidCard>();
    let i = 0;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col <= row; col++) {
        const card = baseDeck[i++];
        p.set(key(row, col), { ...card, id: `${row}-${col}-${card.suit}${card.rank}`, row, col, removed: false });
      }
    }
    return p;
  });

  const [stock, setStock] = useState<Card[]>(() => baseDeck.slice(28));
  const [waste, setWaste] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Sel[]>([]);

  const removedCount = useMemo(() => Array.from(pyramid.values()).filter((c) => c.removed).length, [pyramid]);
  const topWaste = waste[waste.length - 1];

  useMemo(() => {
    onScore?.(removedCount);
    if (removedCount === 28) onComplete?.();
    return null;
  }, [onComplete, onScore, removedCount]);

  const reset = () => {
    setSeed((x) => x + 1);
    const d = makeDeck();
    const p = new Map<string, PyramidCard>();
    let i = 0;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col <= row; col++) {
        const card = d[i++];
        p.set(key(row, col), { ...card, id: `${row}-${col}-${card.suit}${card.rank}`, row, col, removed: false });
      }
    }
    setPyramid(p);
    setStock(d.slice(28));
    setWaste([]);
    setSelected([]);
    onScore?.(0);
  };

  const clearSelection = () => setSelected([]);

  const removePyramid = (row: number, col: number) => {
    setPyramid((prev) => {
      const next = new Map(prev);
      const c = next.get(key(row, col));
      if (c) next.set(key(row, col), { ...c, removed: true });
      return next;
    });
  };

  const tryRemove = (nextSel: Sel[]) => {
    const getCard = (s: Sel): Card | null => {
      if (s.kind === 'waste') return topWaste || null;
      const c = pyramid.get(key(s.row, s.col));
      if (!c || c.removed) return null;
      return c;
    };

    const items = nextSel.map((s) => ({ s, card: getCard(s) })).filter((x) => x.card) as Array<{ s: Sel; card: Card }>;
    if (items.length === 1 && items[0].card.rank === 13) {
      if (items[0].s.kind === 'waste') setWaste((prev) => prev.slice(0, -1));
      else removePyramid(items[0].s.row, items[0].s.col);
      clearSelection();
      return;
    }
    if (items.length === 2 && items[0].card.rank + items[1].card.rank === 13) {
      for (const it of items) {
        if (it.s.kind === 'waste') setWaste((prev) => prev.slice(0, -1));
        else removePyramid(it.s.row, it.s.col);
      }
      clearSelection();
    }
  };

  const toggleSelect = (s: Sel) => {
    setSelected((prev) => {
      const exists =
        s.kind === 'waste'
          ? prev.some((x) => x.kind === 'waste')
          : prev.some((x) => x.kind === 'pyramid' && x.row === s.row && x.col === s.col);
      const next = exists
        ? prev.filter((x) => (s.kind === 'waste' ? x.kind !== 'waste' : !(x.kind === 'pyramid' && x.row === s.row && x.col === s.col)))
        : [...prev, s];
      if (next.length > 2) return prev;
      setTimeout(() => tryRemove(next), 0);
      return next;
    });
  };

  const draw = () => {
    if (stock.length === 0) {
      if (waste.length === 0) return;
      setStock(waste.slice().reverse());
      setWaste([]);
      clearSelection();
      return;
    }
    const card = stock[stock.length - 1] as Card;
    setStock((prev) => prev.slice(0, -1));
    setWaste((prev) => [...prev, card]);
    clearSelection();
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Пасьянс (Пирамида)</h2>
        <p className="text-gray-600 mt-2">
          Убирай пары на <span className="font-black">13</span>. Король (K) убирается один.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-center mb-6">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold bg-gray-900 text-white hover:bg-black transition"
        >
          <RotateCcw className="w-4 h-4" />
          Заново
        </button>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold bg-slate-50 border border-slate-200 text-gray-900">
          <Layers className="w-4 h-4 text-gray-500" />
          Убрано: {removedCount}/28
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold bg-slate-50 border border-slate-200 text-gray-900">
          Колода: {stock.length} • Сброс: {waste.length}
        </div>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={draw}
            className="w-24 h-32 rounded-2xl border border-gray-200 bg-slate-900 text-white flex flex-col items-center justify-center font-black"
            title={stock.length ? 'Взять карту' : 'Вернуть сброс в колоду'}
          >
            {stock.length ? 'Взять' : '↻'}
            <div className="text-xs font-semibold opacity-70">{stock.length}</div>
          </button>

          <button
            type="button"
            onClick={() => topWaste && toggleSelect({ kind: 'waste' })}
            className={`w-24 h-32 rounded-2xl border flex items-center justify-center font-black ${
              topWaste ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-slate-50 border-slate-200'
            } ${selected.some((s) => s.kind === 'waste') ? 'ring-2 ring-amber-300' : ''}`}
          >
            {topWaste ? (
              <div className={`text-xl ${isRed(topWaste.suit) ? 'text-red-600' : 'text-gray-900'}`}>
                {label(topWaste.rank)}
                <span className="ml-1">{topWaste.suit}</span>
              </div>
            ) : (
              <div className="text-gray-400 font-semibold">Сброс</div>
            )}
          </button>
        </div>

        <div className="w-full max-w-[760px]">
          <div className="flex flex-col items-center gap-2">
            {Array.from({ length: 7 }, (_, row) => (
              <div key={row} className="flex gap-2 justify-center">
                {Array.from({ length: row + 1 }, (_, col) => pyramid.get(key(row, col))!).map((c) => {
                  const exposed = isExposed(pyramid, c.row, c.col);
                  const isSel = selected.some((s) => s.kind === 'pyramid' && s.row === c.row && s.col === c.col);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleSelect({ kind: 'pyramid', row: c.row, col: c.col })}
                      disabled={c.removed || !exposed}
                      className={`w-14 h-20 sm:w-16 sm:h-24 rounded-2xl border font-black transition ${
                        c.removed
                          ? 'bg-transparent border-transparent'
                          : exposed
                            ? isSel
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                            : 'bg-slate-50 border-slate-200 opacity-70'
                      }`}
                    >
                      {!c.removed ? (
                        <div className={`text-lg ${isRed(c.suit) ? 'text-red-600' : 'text-gray-900'}`}>
                          {label(c.rank)}
                          <span className="ml-1">{c.suit}</span>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="text-center text-xs text-gray-500 mt-3">Подсказка: A+Q, 2+J, 3+10, 4+9, 5+8, 6+7.</div>
        </div>

        {removedCount === 28 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-emerald-800 font-semibold">
            Победа! Пирамида очищена.
          </div>
        ) : null}
      </div>
    </div>
  );
};

