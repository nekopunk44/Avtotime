import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { buildJigsawEdges, makeJigsawMaskDataUrl } from './jigsawMask';
import { gameAPI } from '../../utils/gameAPI';

interface SvgPuzzleGameProps {
  svgUrl: string;
  level?: 'easy' | 'medium' | 'hard';
  onComplete?: () => void;
}

interface Piece {
  id: number;
  correctPos: number;
  currentPos: number;
}

const PIECES_OPTIONS = [12, 24] as const;
type PiecesOption = (typeof PIECES_OPTIONS)[number];

const getGridForPieces = (count: PiecesOption) => {
  switch (count) {
    case 12: return { cols: 4, rows: 3 };
    case 24: return { cols: 6, rows: 4 };
    default: return { cols: 4, rows: 3 };
  }
};

const GAP = 4;
const PAD = 8;

export const SvgPuzzleGame: React.FC<SvgPuzzleGameProps> = ({
  svgUrl,
  level = 'medium',
  onComplete,
}) => {
  const initialPiecesCount: PiecesOption = useMemo(
    () => (level === 'easy' ? 12 : 24),
    [level]
  );

  const [piecesCount, setPiecesCount] = useState<PiecesOption>(initialPiecesCount);
  useEffect(() => setPiecesCount(initialPiecesCount), [initialPiecesCount]);

  const [currentImageUrl, setCurrentImageUrl] = useState(svgUrl);
  useEffect(() => setCurrentImageUrl(svgUrl), [svgUrl]);

  const [coloredSvgUrl, setColoredSvgUrl] = useState<string | null>(null);
  const [isColoring, setIsColoring] = useState(false);

  const { cols, rows } = useMemo(() => getGridForPieces(piecesCount), [piecesCount]);
  const totalPieces = cols * rows;

  // Measure only available width — height is derived from cell size
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setAvailW(el.clientWidth);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  // Cell size driven purely by width so grid fills the container edge-to-edge
  const pieceSize = useMemo(() => {
    if (!availW) return 50;
    const usable = availW - PAD * 2;
    const byW = Math.floor((usable - (cols - 1) * GAP) / cols);
    return Math.max(24, byW);
  }, [availW, cols]);

  const gridW = cols * pieceSize + (cols - 1) * GAP;
  const gridH = rows * pieceSize + (rows - 1) * GAP;
  const boardH = gridH + PAD * 2; // exact height needed — no empty space

  const pad = PAD; // alias kept for mask calc below
  const fullPieceSize = pieceSize + pad * 2;

  const edgesByPos = useMemo(
    () => buildJigsawEdges(cols, rows, `${currentImageUrl}|${piecesCount}|${level}`),
    [cols, rows, currentImageUrl, piecesCount, level]
  );

  const maskUrlsByPos = useMemo(
    () => edgesByPos.map((e) => makeJigsawMaskDataUrl(pieceSize, e)),
    [edgesByPos, pieceSize]
  );

  const [pieces, setPieces] = useState<Piece[]>([]);
  const [completed, setCompleted] = useState(false);
  const [moves, setMoves] = useState(0);
  const [showWin, setShowWin] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const piecesByPos = useMemo(() => new Map(pieces.map((p) => [p.currentPos, p])), [pieces]);

  const shuffle = (prev: Piece[]) => {
    const positions = Array.from({ length: totalPieces }, (_, i) => i);
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    return prev.map((p, i) => ({ ...p, currentPos: shuffled[i] }));
  };

  useEffect(() => {
    const positions = Array.from({ length: totalPieces }, (_, i) => i);
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    setPieces(positions.map((i) => ({ id: i, correctPos: i, currentPos: shuffled[i] })));
    setCompleted(false);
    setMoves(0);
    setShowWin(false);
    setSelectedId(null);
  }, [currentImageUrl, cols, rows, totalPieces]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!svgUrl) return;
      setIsColoring(true);
      try {
        const r = await gameAPI.requestSvgColoring({ svgContent: svgUrl });
        if (mounted && r.success && r.coloredSvg) setColoredSvgUrl(r.coloredSvg);
      } catch { /* fallback */ } finally {
        if (mounted) setIsColoring(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [svgUrl]);

  useEffect(() => {
    if (pieces.length === 0 || completed) return;
    if (pieces.every((p) => p.currentPos === p.correctPos)) {
      setCompleted(true);
      onComplete?.();
    }
  }, [pieces, completed, onComplete]);

  useEffect(() => {
    if (!completed) return;
    setShowWin(true);
    const t = window.setTimeout(() => setShowWin(false), 3500);
    return () => window.clearTimeout(t);
  }, [completed]);

  const swapById = (idA: number, idB: number) => {
    setPieces((prev) => {
      const a = prev.find((p) => p.id === idA);
      const b = prev.find((p) => p.id === idB);
      if (!a || !b || idA === idB) return prev;
      return prev.map((p) => {
        if (p.id === idA) return { ...p, currentPos: b.currentPos };
        if (p.id === idB) return { ...p, currentPos: a.currentPos };
        return p;
      });
    });
    setMoves((m) => m + 1);
  };

  const handlePieceTap = (pieceId: number) => {
    if (completed) return;
    if (selectedId === null) { setSelectedId(pieceId); return; }
    if (selectedId === pieceId) { setSelectedId(null); return; }
    swapById(selectedId, pieceId);
    setSelectedId(null);
  };

  // Desktop drag-and-drop
  const handleDragStart = (e: React.DragEvent, pieceId: number) => {
    e.dataTransfer.setData('pieceId', String(pieceId));
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, targetPos: number) => {
    e.preventDefault();
    const draggedId = parseInt(e.dataTransfer.getData('pieceId'));
    const target = piecesByPos.get(targetPos);
    if (target) swapById(draggedId, target.id);
  };

  const displaySvgUrl = coloredSvgUrl || svgUrl;
  const solvedPct = totalPieces
    ? Math.round((pieces.filter((p) => p.currentPos === p.correctPos).length / totalPieces) * 100)
    : 0;

  return (
    <div className="flex flex-col bg-white p-3 sm:p-4">
      {/* Top bar */}
      <div className="mb-3 flex items-center gap-2 flex-shrink-0">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-bold flex-shrink-0">
          {PIECES_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setPiecesCount(n)}
              className={`px-2.5 py-1.5 transition-colors ${
                piecesCount === n ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 mb-1">
            <span>Прогресс</span>
            <span>{solvedPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${solvedPct}%` }} />
          </div>
        </div>

        <button
          onClick={() => { setPieces((p) => shuffle(p)); setCompleted(false); setMoves(0); setShowWin(false); setSelectedId(null); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Перемешать</span>
          <span className="sm:hidden">Ещё раз</span>
        </button>
      </div>

      {selectedId !== null && (
        <div className="mb-2 text-center text-[11px] text-indigo-600 font-semibold flex-shrink-0 animate-pulse">
          Нажмите на другую деталь — они поменяются
        </div>
      )}

      {/* Puzzle board — height = exact grid height, no leftover space */}
      <div
        ref={wrapperRef}
        className="relative w-full flex-shrink-0 bg-slate-50 rounded-2xl border border-gray-100 flex items-center justify-center"
        style={{ height: boardH || 'auto', overflow: 'visible', padding: PAD }}
      >
        {isColoring && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none rounded-2xl bg-white/60">
            <div className="text-xs text-gray-400 animate-pulse">Раскрашиваю…</div>
          </div>
        )}

        {pieceSize > 0 && availW > 0 && (
          <div className="relative" style={{ width: gridW, height: gridH, flexShrink: 0 }}>
            {/* Ghost reference */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.07]"
              style={{ backgroundImage: `url("${displaySvgUrl}")`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}
            />

            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${pieceSize}px)`,
                gridTemplateRows: `repeat(${rows}, ${pieceSize}px)`,
                gap: `${GAP}px`,
              }}
            >
              {Array.from({ length: totalPieces }).map((_, pos) => {
                const piece = piecesByPos.get(pos);
                const isCorrect = piece?.correctPos === pos;
                const isSelected = piece?.id === selectedId;

                return (
                  <div
                    key={pos}
                    style={{
                      width: pieceSize, height: pieceSize,
                      position: 'relative', overflow: 'visible',
                      backgroundColor: isCorrect ? 'rgba(16,185,129,0.22)' : 'rgba(100,116,139,0.06)',
                      boxShadow: isCorrect
                        ? 'inset 0 2px 8px rgba(16,185,129,0.5), inset 0 0 0 2px rgba(16,185,129,0.7)'
                        : 'inset 2px 2px 5px rgba(100,116,139,0.22), inset 0 0 0 1px rgba(148,163,184,0.5)',
                      borderRadius: 4,
                      transition: 'background-color 0.3s, box-shadow 0.3s',
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, pos)}
                  >
                    {piece && (
                      <div
                        draggable={!completed}
                        onDragStart={(e) => handleDragStart(e, piece.id)}
                        onClick={() => handlePieceTap(piece.id)}
                        style={{
                          position: 'absolute',
                          width: fullPieceSize, height: fullPieceSize,
                          top: -pad, left: -pad,
                          cursor: completed ? 'default' : isSelected ? 'pointer' : 'grab',
                          backgroundImage: `url("${displaySvgUrl}")`,
                          backgroundSize: `${gridW}px ${gridH}px`,
                          backgroundPosition: `${-(piece.correctPos % cols) * (pieceSize + GAP) + pad}px ${-Math.floor(piece.correctPos / cols) * (pieceSize + GAP) + pad}px`,
                          backgroundRepeat: 'no-repeat',
                          backgroundColor: '#fff',
                          WebkitMaskImage: `url("${maskUrlsByPos[piece.correctPos]}")`,
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskSize: '100% 100%',
                          maskImage: `url("${maskUrlsByPos[piece.correctPos]}")`,
                          maskRepeat: 'no-repeat',
                          maskSize: '100% 100%',
                          filter: isSelected
                            ? 'drop-shadow(0 0 0 2.5px rgba(99,102,241,1)) drop-shadow(0 0 12px rgba(99,102,241,0.9))'
                            : isCorrect
                            ? 'drop-shadow(0 0 0 2.5px rgba(16,185,129,1)) drop-shadow(0 0 10px rgba(16,185,129,0.8))'
                            : 'drop-shadow(0 0 0 1px rgba(100,116,139,0.35)) drop-shadow(0 3px 8px rgba(15,23,42,0.18))',
                          zIndex: isSelected ? 20 : 10,
                          transform: isSelected ? 'scale(1.06) translateZ(0)' : 'translateZ(0)',
                          transition: 'filter 0.2s, transform 0.15s',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <AnimatePresence>
              {showWin && (
                <motion.div
                  className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <div className="absolute inset-0 bg-black/15 rounded-2xl" />
                  <motion.div
                    className="relative mx-4 w-full max-w-xs rounded-3xl bg-white shadow-xl border border-gray-100 p-5"
                    initial={{ opacity: 0, scale: 0.9, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">Победа!</div>
                        <div className="text-gray-500 text-sm">Пазл собран за {moves} ходов.</div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="mt-2 text-center text-[10px] text-gray-400 flex-shrink-0">
        Нажмите деталь → нажмите другую, чтобы поменять местами
      </div>
    </div>
  );
};
