import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface ChessGameProps {
  onComplete?: () => void;
}

type Color = 'w' | 'b';
type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
type Piece = { c: Color; t: PieceType };
type Square = Piece | null;
type Pos = { r: number; c: number };
type Move = { from: Pos; to: Pos };

const inBounds = (r: number, c: number) => r >= 0 && c >= 0 && r < 8 && c < 8;
const clone = (b: Square[][]) => b.map((row) => row.map((p) => (p ? { ...p } : null)));

const initBoard = (): Square[][] => {
  const empty: Square[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    empty[0][c] = { c: 'b', t: back[c] };
    empty[1][c] = { c: 'b', t: 'p' };
    empty[6][c] = { c: 'w', t: 'p' };
    empty[7][c] = { c: 'w', t: back[c] };
  }
  return empty;
};

const pieceChar = (p: Piece) => {
  const map: Record<Color, Record<PieceType, string>> = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
  };
  return map[p.c][p.t];
};

const genMoves = (b: Square[][], from: Pos): Move[] => {
  const p = b[from.r][from.c];
  if (!p) return [];
  const moves: Move[] = [];
  const push = (r: number, c: number) => {
    if (!inBounds(r, c)) return;
    const t = b[r][c];
    if (t && t.c === p.c) return;
    moves.push({ from, to: { r, c } });
  };
  const slide = (dr: number, dc: number) => {
    let r = from.r + dr;
    let c = from.c + dc;
    while (inBounds(r, c)) {
      const t = b[r][c];
      if (!t) moves.push({ from, to: { r, c } });
      else {
        if (t.c !== p.c) moves.push({ from, to: { r, c } });
        break;
      }
      r += dr;
      c += dc;
    }
  };

  if (p.t === 'p') {
    const dir = p.c === 'w' ? -1 : 1;
    const startRow = p.c === 'w' ? 6 : 1;
    const r1 = from.r + dir;
    if (inBounds(r1, from.c) && b[r1][from.c] === null) push(r1, from.c);
    const r2 = from.r + dir * 2;
    if (from.r === startRow && inBounds(r2, from.c) && b[r1][from.c] === null && b[r2][from.c] === null) push(r2, from.c);
    for (const dc of [-1, 1] as const) {
      const cc = from.c + dc;
      if (!inBounds(r1, cc)) continue;
      const t = b[r1][cc];
      if (t && t.c !== p.c) moves.push({ from, to: { r: r1, c: cc } });
    }
    return moves;
  }

  if (p.t === 'n') {
    const jumps = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ] as const;
    for (const [dr, dc] of jumps) push(from.r + dr, from.c + dc);
    return moves;
  }

  if (p.t === 'b') {
    slide(-1, -1);
    slide(-1, 1);
    slide(1, -1);
    slide(1, 1);
    return moves;
  }

  if (p.t === 'r') {
    slide(-1, 0);
    slide(1, 0);
    slide(0, -1);
    slide(0, 1);
    return moves;
  }

  if (p.t === 'q') {
    slide(-1, -1);
    slide(-1, 1);
    slide(1, -1);
    slide(1, 1);
    slide(-1, 0);
    slide(1, 0);
    slide(0, -1);
    slide(0, 1);
    return moves;
  }

  if (p.t === 'k') {
    for (const dr of [-1, 0, 1] as const) {
      for (const dc of [-1, 0, 1] as const) {
        if (dr === 0 && dc === 0) continue;
        push(from.r + dr, from.c + dc);
      }
    }
    return moves;
  }

  return moves;
};

export const ChessGame: React.FC<ChessGameProps> = ({ onComplete }) => {
  const [board, setBoard] = useState<Square[][]>(() => initBoard());
  const [turn, setTurn] = useState<Color>('w');
  const [selected, setSelected] = useState<Pos | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);

  const moves = useMemo(() => {
    if (!selected) return [] as Move[];
    const p = board[selected.r][selected.c];
    if (!p || p.c !== turn) return [];
    return genMoves(board, selected);
  }, [board, selected, turn]);

  const reset = () => {
    setBoard(initBoard());
    setTurn('w');
    setSelected(null);
    setWinner(null);
  };

  const apply = (m: Move) => {
    setBoard((prev) => {
      const b = clone(prev);
      const p = b[m.from.r][m.from.c];
      if (!p) return prev;
      const captured = b[m.to.r][m.to.c];
      b[m.from.r][m.from.c] = null;

      if (p.t === 'p' && ((p.c === 'w' && m.to.r === 0) || (p.c === 'b' && m.to.r === 7))) {
        b[m.to.r][m.to.c] = { c: p.c, t: 'q' };
      } else {
        b[m.to.r][m.to.c] = p;
      }

      if (captured?.t === 'k') {
        setWinner(p.c);
        onComplete?.();
      }
      return b;
    });
    setSelected(null);
    setTurn((t) => (t === 'w' ? 'b' : 'w'));
  };

  const handleSquare = (r: number, c: number) => {
    if (winner) return;
    if (selected) {
      const m = moves.find((x) => x.to.r === r && x.to.c === c);
      if (m) {
        apply(m);
        return;
      }
    }
    const p = board[r][c];
    if (!p || p.c !== turn) return;
    setSelected({ r, c });
  };

  const isTarget = (r: number, c: number) => moves.some((m) => m.to.r === r && m.to.c === c);
  const isSel = (r: number, c: number) => selected?.r === r && selected?.c === c;

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+5rem)] pb-4">
      <div className="text-center mb-3 [&>h2]:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Шахматы</h2>
        <p className="text-gray-600 text-[13px] leading-snug">
          Ход: <span className="font-black">{turn === 'w' ? 'Белые' : 'Чёрные'}</span>
          <span className="text-gray-400"> • упрощённые правила</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold bg-gray-900 text-white hover:bg-black transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Заново
        </button>
        {winner ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-800">
            Победа: {winner === 'w' ? 'Белые' : 'Чёрные'}
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center pb-2">
        <div className="grid grid-cols-8 gap-0 rounded-2xl overflow-hidden border border-gray-200">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const dark = (r + c) % 2 === 1;
              const target = isTarget(r, c);
              const sel = isSel(r, c);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleSquare(r, c)}
                  className={`relative w-[clamp(34px,9.8vw,56px)] h-[clamp(34px,9.8vw,56px)] flex items-center justify-center ${
                    dark ? 'bg-[#111827]' : 'bg-[#f8fafc]'
                  } ${target ? 'ring-2 ring-amber-300' : ''} ${sel ? 'ring-2 ring-blue-300' : ''}`}
                >
                  {target ? <div className="absolute inset-0 bg-amber-300/10" /> : null}
                  <span
                    className={`relative text-[clamp(18px,5vw,30px)] leading-none select-none ${
                      cell?.c === 'w'
                        ? 'text-slate-50 [text-shadow:-1px_-1px_0_rgba(0,0,0,0.45),1px_-1px_0_rgba(0,0,0,0.45),-1px_1px_0_rgba(0,0,0,0.45),1px_1px_0_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.25)]'
                        : 'text-slate-900 [text-shadow:-1px_-1px_0_rgba(255,255,255,0.75),1px_-1px_0_rgba(255,255,255,0.75),-1px_1px_0_rgba(255,255,255,0.75),1px_1px_0_rgba(255,255,255,0.75),0_2px_6px_rgba(0,0,0,0.25)]'
                    }`}
                  >
                    {cell ? pieceChar(cell) : ''}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
