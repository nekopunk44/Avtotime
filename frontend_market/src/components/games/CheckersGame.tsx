import React, { useMemo, useState } from 'react';
import { Crown, RotateCcw } from 'lucide-react';

interface CheckersGameProps {
  onComplete?: () => void;
}

type Color = 'red' | 'black';

type Piece = {
  color: Color;
  king: boolean;
};

type Pos = { r: number; c: number };

type Move = {
  from: Pos;
  to: Pos;
  capture?: Pos;
};

const inBounds = (r: number, c: number) => r >= 0 && c >= 0 && r < 8 && c < 8;

const cloneBoard = (b: Array<Array<Piece | null>>) => b.map((row) => row.map((p) => (p ? { ...p } : null)));

const initBoard = () => {
  const b: Array<Array<Piece | null>> = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) b[r][c] = { color: 'black', king: false };
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) b[r][c] = { color: 'red', king: false };
    }
  }
  return b;
};

const dirsFor = (p: Piece) => {
  if (p.king) return [-1, 1] as const;
  return p.color === 'red' ? ([-1] as const) : ([1] as const);
};

const getMovesForPiece = (board: Array<Array<Piece | null>>, r: number, c: number): { captures: Move[]; moves: Move[] } => {
  const p = board[r][c];
  if (!p) return { captures: [], moves: [] };

  const captures: Move[] = [];
  const moves: Move[] = [];
  for (const dr of dirsFor(p)) {
    for (const dc of [-1, 1] as const) {
      const r1 = r + dr;
      const c1 = c + dc;
      const r2 = r + dr * 2;
      const c2 = c + dc * 2;
      if (inBounds(r1, c1) && board[r1][c1] === null) {
        moves.push({ from: { r, c }, to: { r: r1, c: c1 } });
      }
      if (!inBounds(r2, c2) || !inBounds(r1, c1)) continue;
      const mid = board[r1][c1];
      if (mid && mid.color !== p.color && board[r2][c2] === null) {
        captures.push({ from: { r, c }, to: { r: r2, c: c2 }, capture: { r: r1, c: c1 } });
      }
    }
  }
  return { captures, moves };
};

const listAllMoves = (board: Array<Array<Piece | null>>, turn: Color) => {
  const captures: Move[] = [];
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== turn) continue;
      const m = getMovesForPiece(board, r, c);
      captures.push(...m.captures);
      moves.push(...m.moves);
    }
  }
  return { captures, moves };
};

export const CheckersGame: React.FC<CheckersGameProps> = ({ onComplete }) => {
  const [board, setBoard] = useState(() => initBoard());
  const [turn, setTurn] = useState<Color>('red');
  const [selected, setSelected] = useState<Pos | null>(null);
  const [forcedFrom, setForcedFrom] = useState<Pos | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);

  const all = useMemo(() => listAllMoves(board, turn), [board, turn]);
  const mustCapture = all.captures.length > 0;

  const available = useMemo(() => {
    if (!selected) return [] as Move[];
    const p = board[selected.r][selected.c];
    if (!p || p.color !== turn) return [];
    const { captures, moves } = getMovesForPiece(board, selected.r, selected.c);
    return mustCapture ? captures : moves;
  }, [board, mustCapture, selected, turn]);

  const reset = () => {
    setBoard(initBoard());
    setTurn('red');
    setSelected(null);
    setForcedFrom(null);
    setWinner(null);
  };

  const applyMove = (m: Move) => {
    const nextBoard = (() => {
      const b = cloneBoard(board);
      const p = b[m.from.r][m.from.c];
      if (!p) return b;
      b[m.from.r][m.from.c] = null;
      if (m.capture) b[m.capture.r][m.capture.c] = null;
      const isKingRow = (p.color === 'red' && m.to.r === 0) || (p.color === 'black' && m.to.r === 7);
      b[m.to.r][m.to.c] = { ...p, king: p.king || isKingRow };
      return b;
    })();

    setBoard(nextBoard);

    const movedPiece = nextBoard[m.to.r][m.to.c];
    if (m.capture && movedPiece) {
      const again = getMovesForPiece(nextBoard, m.to.r, m.to.c).captures;
      if (again.length > 0) {
        setForcedFrom({ r: m.to.r, c: m.to.c });
        setSelected({ r: m.to.r, c: m.to.c });
        return;
      }
    }

    setForcedFrom(null);
    setSelected(null);
    const nextTurn: Color = turn === 'red' ? 'black' : 'red';
    setTurn(nextTurn);

    const nextMoves = listAllMoves(nextBoard, nextTurn);
    const hasPieces = nextBoard.flat().some((x) => x?.color === nextTurn);
    if (!hasPieces || (nextMoves.captures.length === 0 && nextMoves.moves.length === 0)) {
      setWinner(turn);
      onComplete?.();
    }
  };

  const handleSquare = (r: number, c: number) => {
    if (winner) return;

    if (selected) {
      const move = available.find((m) => m.to.r === r && m.to.c === c);
      if (move) {
        applyMove(move);
        return;
      }
    }

    const p = board[r][c];
    if (!p || p.color !== turn) return;
    if (forcedFrom && (forcedFrom.r !== r || forcedFrom.c !== c)) return;
    setSelected({ r, c });
  };

  const isTarget = (r: number, c: number) => available.some((m) => m.to.r === r && m.to.c === c);
  const isSelected = (r: number, c: number) => selected?.r === r && selected?.c === c;

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+5rem)] pb-4">
      <div className="text-center mb-3">
        <p className="text-gray-600 text-[13px] leading-snug">
          Ход: <span className="font-black">{turn === 'red' ? 'Красные' : 'Чёрные'}</span>
          {mustCapture ? ' • Взятие обязательно' : ''}
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
            Победили: {winner === 'red' ? 'Красные' : 'Чёрные'}
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center pb-2">
        <div className="grid grid-cols-8 gap-0 rounded-2xl overflow-hidden border border-gray-200">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const dark = (r + c) % 2 === 1;
              const target = isTarget(r, c);
              const sel = isSelected(r, c);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleSquare(r, c)}
                  className={`relative w-[clamp(34px,9.8vw,56px)] h-[clamp(34px,9.8vw,56px)] ${
                    dark ? 'bg-[#111827]' : 'bg-[#f8fafc]'
                  } ${target ? 'ring-2 ring-amber-300' : ''} ${sel ? 'ring-2 ring-blue-300' : ''}`}
                >
                  {target ? <div className="absolute inset-0 bg-amber-300/10" /> : null}
                  {cell ? (
                    <div className="absolute inset-0 flex items-center justify-center" aria-label={`${cell.color}-piece`}>
                      <div
                        className={`w-[clamp(22px,6vw,40px)] h-[clamp(22px,6vw,40px)] rounded-full shadow-md border ${
                          cell.color === 'red' ? 'bg-red-500 border-red-200' : 'bg-slate-200 border-white/70'
                        }`}
                      />
                      {cell.king ? (
                        <Crown
                          className={`absolute w-[clamp(14px,3.6vw,18px)] h-[clamp(14px,3.6vw,18px)] ${
                            cell.color === 'red' ? 'text-yellow-100' : 'text-amber-500'
                          }`}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
