import React, { useMemo, useState } from 'react';
import { Lightbulb, RotateCcw } from 'lucide-react';

interface SudokuGameProps {
  onComplete?: () => void;
}

type Puzzle = {
  name: string;
  grid: number[]; // 0..9 length 81
  solution: number[];
};

const PUZZLES: Puzzle[] = [
  {
    name: 'Лёгкая',
    grid: [
      0, 0, 0, 2, 6, 0, 7, 0, 1,
      6, 8, 0, 0, 7, 0, 0, 9, 0,
      1, 9, 0, 0, 0, 4, 5, 0, 0,
      8, 2, 0, 1, 0, 0, 0, 4, 0,
      0, 0, 4, 6, 0, 2, 9, 0, 0,
      0, 5, 0, 0, 0, 3, 0, 2, 8,
      0, 0, 9, 3, 0, 0, 0, 7, 4,
      0, 4, 0, 0, 5, 0, 0, 3, 6,
      7, 0, 3, 0, 1, 8, 0, 0, 0,
    ],
    solution: [
      4, 3, 5, 2, 6, 9, 7, 8, 1,
      6, 8, 2, 5, 7, 1, 4, 9, 3,
      1, 9, 7, 8, 3, 4, 5, 6, 2,
      8, 2, 6, 1, 9, 5, 3, 4, 7,
      3, 7, 4, 6, 8, 2, 9, 1, 5,
      9, 5, 1, 7, 4, 3, 6, 2, 8,
      5, 1, 9, 3, 2, 6, 8, 7, 4,
      2, 4, 8, 9, 5, 7, 1, 3, 6,
      7, 6, 3, 4, 1, 8, 2, 5, 9,
    ],
  },
  {
    name: 'Средняя',
    grid: [
      5, 3, 0, 0, 7, 0, 0, 0, 0,
      6, 0, 0, 1, 9, 5, 0, 0, 0,
      0, 9, 8, 0, 0, 0, 0, 6, 0,
      8, 0, 0, 0, 6, 0, 0, 0, 3,
      4, 0, 0, 8, 0, 3, 0, 0, 1,
      7, 0, 0, 0, 2, 0, 0, 0, 6,
      0, 6, 0, 0, 0, 0, 2, 8, 0,
      0, 0, 0, 4, 1, 9, 0, 0, 5,
      0, 0, 0, 0, 8, 0, 0, 7, 9,
    ],
    solution: [
      5, 3, 4, 6, 7, 8, 9, 1, 2,
      6, 7, 2, 1, 9, 5, 3, 4, 8,
      1, 9, 8, 3, 4, 2, 5, 6, 7,
      8, 5, 9, 7, 6, 1, 4, 2, 3,
      4, 2, 6, 8, 5, 3, 7, 9, 1,
      7, 1, 3, 9, 2, 4, 8, 5, 6,
      9, 6, 1, 5, 3, 7, 2, 8, 4,
      2, 8, 7, 4, 1, 9, 6, 3, 5,
      3, 4, 5, 2, 8, 6, 1, 7, 9,
    ],
  },
];

export const SudokuGame: React.FC<SudokuGameProps> = ({ onComplete }) => {
  const puzzles = useMemo(() => PUZZLES, []);

  const [puzzle, setPuzzle] = useState<Puzzle>(() => puzzles[0]);
  const [values, setValues] = useState<number[]>(() => puzzle.grid.slice());
  const [invalid, setInvalid] = useState<Set<number>>(() => new Set());

  const locked = useMemo(() => new Set(puzzle.grid.map((v, i) => (v ? i : -1)).filter((i) => i !== -1)), [puzzle]);

  const reset = (pick?: Puzzle) => {
    const nextPuzzle = pick || puzzles[Math.floor(Math.random() * puzzles.length)] || puzzles[0];
    setPuzzle(nextPuzzle);
    setValues(nextPuzzle.grid.slice());
    setInvalid(new Set());
  };

  const validate = (vals: number[]) => {
    const bad = new Set<number>();
    for (let i = 0; i < 81; i++) {
      const v = vals[i];
      if (!v) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      // row
      for (let cc = 0; cc < 9; cc++) {
        const j = r * 9 + cc;
        if (j !== i && vals[j] === v) bad.add(i);
      }
      // col
      for (let rr = 0; rr < 9; rr++) {
        const j = rr * 9 + c;
        if (j !== i && vals[j] === v) bad.add(i);
      }
      // box
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++) {
        for (let cc = bc; cc < bc + 3; cc++) {
          const j = rr * 9 + cc;
          if (j !== i && vals[j] === v) bad.add(i);
        }
      }
    }
    setInvalid(bad);
    return bad.size === 0;
  };

  const isSolved = (vals: number[]) => vals.every((v, i) => v === puzzle.solution[i]);

  const setCell = (idx: number, raw: string) => {
    if (locked.has(idx)) return;
    const digit = raw.replace(/[^1-9]/g, '').slice(0, 1);
    const v = digit ? Number(digit) : 0;
    setValues((prev) => {
      const next = prev.slice();
      next[idx] = v;
      validate(next);
      if (isSolved(next)) onComplete?.();
      return next;
    });
  };

  const hint = () => {
    const empties = values
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v === 0 && !locked.has(x.i));
    if (!empties.length) return;
    const pick = empties[Math.floor(Math.random() * empties.length)];
    setValues((prev) => {
      const next = prev.slice();
      next[pick.i] = puzzle.solution[pick.i] || 0;
      validate(next);
      if (isSolved(next)) onComplete?.();
      return next;
    });
  };

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+5rem)] pb-4">
      <div className="text-center mb-3">
        <p className="text-gray-600 text-[13px] leading-snug">Заполни клетки цифрами 1–9 без повторов в строках, столбцах и квадратах.</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold bg-gray-900 text-white hover:bg-black transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Новая
        </button>
        <button
          type="button"
          onClick={hint}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Подсказка
        </button>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold bg-slate-50 border border-slate-200 text-gray-900">
          Уровень: {puzzle.name}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center pb-2">
        <div className="w-full max-w-[520px] aspect-square">
          <div className="grid grid-cols-9 grid-rows-9 w-full h-full rounded-2xl overflow-hidden border-2 border-gray-900/10 bg-white">
          {Array.from({ length: 81 }, (_, i) => {
            const v = values[i];
            const r = Math.floor(i / 9);
            const c = i % 9;
            const thickR = r === 2 || r === 5;
            const thickC = c === 2 || c === 5;
            const isLocked = locked.has(i);
            const isBad = invalid.has(i);
            return (
              <div
                key={i}
                className={`relative flex items-center justify-center ${
                  thickC ? 'border-r-2 border-gray-900/15' : 'border-r border-gray-200'
                } ${thickR ? 'border-b-2 border-gray-900/15' : 'border-b border-gray-200'}`}
              >
                {isLocked ? (
                  <div className="text-gray-900 font-black text-[clamp(14px,3.8vw,22px)]">{v}</div>
                ) : (
                  <input
                    inputMode="numeric"
                    value={v ? String(v) : ''}
                    onChange={(e) => setCell(i, e.target.value)}
                    className={`w-full h-full text-center outline-none font-black text-[clamp(14px,3.8vw,22px)] ${
                      isBad ? 'bg-red-50 text-red-700' : 'bg-white text-blue-700'
                    }`}
                    placeholder=""
                  />
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {isSolved(values) ? (
        <div className="mt-2 rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-center font-bold text-emerald-700">
          Готово! Судоку решено.
        </div>
      ) : null}
    </div>
  );
};
