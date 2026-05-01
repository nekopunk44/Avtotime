import React, { useMemo, useState } from 'react';
import { Bomb, Flag, RotateCcw } from 'lucide-react';

interface MinesweeperGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
  onComplete?: () => void;
  onClose?: () => void;
}

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  n: number; // adjacent mines
};

type Status = 'ready' | 'playing' | 'won' | 'lost';
type ActionMode = 'reveal' | 'flag';

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const dirs = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

const makeEmpty = (rows: number, cols: number): Cell[][] =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, n: 0 }))
  );

const inBounds = (r: number, c: number, rows: number, cols: number) => r >= 0 && c >= 0 && r < rows && c < cols;

export const MinesweeperGame: React.FC<MinesweeperGameProps> = ({ onScore, onGameOver, onComplete }) => {
  const rows = 10;
  const cols = 10;
  const mines = 15;

  const [board, setBoard] = useState<Cell[][]>(() => makeEmpty(rows, cols));
  const [status, setStatus] = useState<Status>('ready');
  const [mode, setMode] = useState<ActionMode>('reveal');

  const revealedSafe = useMemo(() => {
    let count = 0;
    for (const row of board) for (const cell of row) if (cell.revealed && !cell.mine) count++;
    return count;
  }, [board]);

  const totalSafe = rows * cols - mines;

  const computeNumbers = (b: Cell[][]) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (b[r][c].mine) {
          b[r][c].n = 0;
          continue;
        }
        let n = 0;
        for (const [dr, dc] of dirs) {
          const rr = r + dr;
          const cc = c + dc;
          if (inBounds(rr, cc, rows, cols) && b[rr][cc].mine) n++;
        }
        b[r][c].n = n;
      }
    }
  };

  const plantMines = (avoidR: number, avoidC: number) => {
    const b = makeEmpty(rows, cols);
    let planted = 0;
    while (planted < mines) {
      const idx = Math.floor(Math.random() * rows * cols);
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      if (r === avoidR && c === avoidC) continue;
      if (b[r][c].mine) continue;
      b[r][c].mine = true;
      planted++;
    }
    computeNumbers(b);
    return b;
  };

  const floodReveal = (b: Cell[][], startR: number, startC: number) => {
    const q: Array<[number, number]> = [[startR, startC]];
    const seen = new Set<string>();
    while (q.length) {
      const [r, c] = q.shift()!;
      const key = `${r}:${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cell = b[r][c];
      if (cell.flagged || cell.revealed) continue;
      cell.revealed = true;
      if (cell.n !== 0) continue;
      for (const [dr, dc] of dirs) {
        const rr = r + dr;
        const cc = c + dc;
        if (!inBounds(rr, cc, rows, cols)) continue;
        const next = b[rr][cc];
        if (!next.revealed && !next.mine) q.push([rr, cc]);
      }
    }
  };

  const reveal = (r: number, c: number) => {
    setBoard((prev) => {
      const b = prev.map((row) => row.map((cell) => ({ ...cell })));
      if (status === 'ready') {
        const planted = plantMines(r, c);
        for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) b[rr][cc] = { ...planted[rr][cc] };
        setStatus('playing');
      }

      const cell = b[r][c];
      if (cell.revealed || cell.flagged) return b;

      if (cell.mine) {
        // reveal all mines
        for (let rr = 0; rr < rows; rr++) {
          for (let cc = 0; cc < cols; cc++) {
            if (b[rr][cc].mine) b[rr][cc].revealed = true;
          }
        }
        setStatus('lost');
        setTimeout(() => onGameOver?.(), 0);
        return b;
      }

      floodReveal(b, r, c);

      const safe = b.flat().filter((x) => x.revealed && !x.mine).length;
      onScore?.(safe);
      if (safe >= totalSafe) {
        setStatus('won');
        setTimeout(() => onComplete?.(), 0);
      }
      return b;
    });
  };

  const toggleFlag = (r: number, c: number) => {
    if (status === 'lost' || status === 'won') return;
    setBoard((prev) => {
      const b = prev.map((row) => row.map((cell) => ({ ...cell })));
      const cell = b[r][c];
      if (cell.revealed) return b;
      cell.flagged = !cell.flagged;
      return b;
    });
  };

  const reset = () => {
    setBoard(makeEmpty(rows, cols));
    setStatus('ready');
    onScore?.(0);
  };

  const flags = useMemo(() => board.flat().filter((c) => c.flagged).length, [board]);
  const remaining = clamp(mines - flags, 0, mines);

  return (
    <div className="relative w-full h-full bg-white flex flex-col overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+5rem)] pb-4">
      <button
        type="button"
        onClick={reset}
        className="absolute right-16 top-[calc(env(safe-area-inset-top)+1rem)] z-50 inline-flex items-center justify-center rounded-2xl bg-black/35 p-2.5 text-white/90 backdrop-blur-sm hover:bg-black/45 transition"
        aria-label="Перезапустить игру"
        title="Перезапустить"
      >
        <RotateCcw className="w-5 h-5" />
      </button>

      <div className="text-center mb-3">
        <p className="text-gray-600 text-[13px] leading-snug">Открой все безопасные клетки. ПКМ — флаг.</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold bg-slate-50 border border-slate-200 text-gray-900">
          <Bomb className="w-3.5 h-3.5 text-red-600" />
          {mines}
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold bg-slate-50 border border-slate-200 text-gray-900">
          <Flag className="w-3.5 h-3.5 text-blue-600" />
          {remaining}
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold bg-slate-50 border border-slate-200 text-gray-900">
          Прогресс: {revealedSafe}/{totalSafe}
        </div>
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'reveal' ? 'flag' : 'reveal'))}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold border transition ${
            mode === 'reveal'
              ? 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
              : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
          }`}
          title="Для телефона: переключение режима"
        >
          {mode === 'reveal' ? 'Режим: открыть' : 'Режим: флаг'}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center pb-2">
        <div className="w-full max-w-[520px] aspect-square">
          <div
            className="grid w-full h-full gap-2"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isInteractive = status !== 'won' && status !== 'lost';
                const content = cell.revealed ? (cell.mine ? '💣' : cell.n ? String(cell.n) : '') : cell.flagged ? '🚩' : '';
                const palette =
                  cell.revealed && !cell.mine
                    ? cell.n === 1
                      ? 'text-blue-600'
                      : cell.n === 2
                        ? 'text-emerald-600'
                        : cell.n === 3
                          ? 'text-red-600'
                          : cell.n === 4
                            ? 'text-indigo-600'
                            : 'text-gray-700'
                    : 'text-gray-900';

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    disabled={!isInteractive}
                    onClick={() => (mode === 'reveal' ? reveal(r, c) : toggleFlag(r, c))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      toggleFlag(r, c);
                    }}
                    className={`aspect-square rounded-xl border text-[clamp(12px,2.5vw,18px)] font-black transition select-none ${
                      cell.revealed
                        ? cell.mine
                          ? 'bg-red-50 border-red-200'
                          : 'bg-white border-gray-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    } ${palette}`}
                    aria-label={`cell-${r}-${c}`}
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {status === 'won' ? (
        <div className="mt-2 rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-center font-bold text-emerald-700">
          Отлично! Все безопасные клетки открыты.
        </div>
      ) : null}

      {status === 'lost' ? (
        <div className="mt-2 rounded-2xl bg-red-50 border border-red-100 p-5 text-center font-bold text-red-700">
          Бум! Попалась мина. Нажми «Заново» и попробуй ещё раз.
        </div>
      ) : null}
    </div>
  );
};
