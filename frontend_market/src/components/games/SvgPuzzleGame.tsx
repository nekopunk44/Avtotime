import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { buildJigsawEdges, makeJigsawMaskDataUrl } from './jigsawMask';
import { ColoringRequest, gameAPI } from '../../utils/gameAPI';

interface SvgPuzzleGameProps {
  svgUrl: string;
  level?: 'easy' | 'medium' | 'hard';
  onComplete?: () => void;
}

interface Piece {
  id: number;
  correctPos: number;
  currentPos: number;
  isDragging: boolean;
}

const PIECES_OPTIONS = [12, 24, 48, 80] as const;
type PiecesOption = (typeof PIECES_OPTIONS)[number];

const getGridForPieces = (count: PiecesOption) => {
  switch (count) {
    case 12:  return { cols: 4, rows: 3 };
    case 24:  return { cols: 6, rows: 4 };
    case 48:  return { cols: 8, rows: 6 };
    case 80:  return { cols: 10, rows: 8 };
    default:  return { cols: 4, rows: 3 };
  }
};

export const SvgPuzzleGame: React.FC<SvgPuzzleGameProps> = ({
  svgUrl,
  level = 'medium',
  onComplete,
}) => {
  const initialPiecesCount: PiecesOption = useMemo(() => {
    if (level === 'easy') return 12;
    if (level === 'hard') return 48;
    return 24;
  }, [level]);

  const [piecesCount, setPiecesCount] = useState<PiecesOption>(initialPiecesCount);
  useEffect(() => setPiecesCount(initialPiecesCount), [initialPiecesCount]);

  const [currentImageUrl, setCurrentImageUrl] = useState(svgUrl);
  useEffect(() => setCurrentImageUrl(svgUrl), [svgUrl]);

  const [coloredSvgUrl, setColoredSvgUrl] = useState<string | null>(null);
  const [isColoring, setIsColoring] = useState(false);
  const [coloringError, setColoringError] = useState<string | null>(null);

  const { cols, rows } = useMemo(() => getGridForPieces(piecesCount), [piecesCount]);
  const totalPieces = cols * rows;
  const gap = 6; // px gap between pieces

  const containerRef = useRef<HTMLDivElement>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [completed, setCompleted] = useState(false);
  const [moves, setMoves] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // pieceSize calculated from real measured container dimensions
  const pieceSize = useMemo(() => {
    const { w, h } = containerSize;
    if (w === 0 || h === 0) return 80;
    // Tab protrusion: ~18% on each side of the grid edge (+0.36 total per axis)
    // Also subtract total gap space from available area
    const totalGapW = (cols - 1) * gap;
    const totalGapH = (rows - 1) * gap;
    const byW = Math.floor((w - totalGapW) / (cols + 0.36));
    const byH = Math.floor((h - totalGapH) / (rows + 0.36));
    return Math.max(30, Math.min(byW, byH));
  }, [containerSize, cols, rows, gap]);

  // Track actual container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setContainerSize({ w: r.width, h: r.height });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const svgDataUrl = currentImageUrl;

  const edgesByPos = useMemo(
    () => buildJigsawEdges(cols, rows, `${currentImageUrl}|${piecesCount}|${level}`),
    [cols, rows, currentImageUrl, piecesCount, level]
  );

  const maskUrlsByPos = useMemo(
    () => edgesByPos.map((e) => makeJigsawMaskDataUrl(pieceSize, e)),
    [edgesByPos, pieceSize]
  );

  const piecesByPos = useMemo(() => new Map(pieces.map((p) => [p.currentPos, p])), [pieces]);

  // Init / reinit pieces on image or grid change
  useEffect(() => {
    const positions = Array.from({ length: totalPieces }, (_, i) => i);
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    const initial: Piece[] = positions.map((i) => ({
      id: i,
      correctPos: i,
      currentPos: shuffled[i],
      isDragging: false,
    }));
    setPieces(initial);
    setCompleted(false);
    setMoves(0);
    setShowWin(false);
  }, [currentImageUrl, cols, rows, pieceSize, totalPieces]);

  // Request automatic coloring when SVG changes
  useEffect(() => {
    let mounted = true;
    
    const requestColoring = async () => {
      if (!svgUrl) return;
      
      setIsColoring(true);
      setColoringError(null);
      
      try {
        const response = await gameAPI.requestSvgColoring({
          svgContent: svgUrl
        });
        
        if (mounted) {
          if (response.success && response.coloredSvg) {
            setColoredSvgUrl(response.coloredSvg);
          } else {
            setColoringError(response.error || 'Failed to color SVG');
            // Fallback to original SVG if coloring fails
            setColoredSvgUrl(null);
          }
        }
      } catch (error) {
        if (mounted) {
          console.error('Error requesting SVG coloring:', error);
          setColoringError('Failed to request coloring');
          setColoredSvgUrl(null);
        }
      } finally {
        if (mounted) {
          setIsColoring(false);
        }
      }
    };
    
    requestColoring();
    
    return () => {
      mounted = false;
    };
  }, [svgUrl]);

  // Check solved
  useEffect(() => {
    if (pieces.length === 0) return;
    if (pieces.every((p) => p.currentPos === p.correctPos) && !completed) {
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

  const handleDragStart = (e: React.DragEvent, pieceId: number) => {
    e.dataTransfer.setData('pieceId', String(pieceId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPos: number) => {
    e.preventDefault();
    const draggedId = parseInt(e.dataTransfer.getData('pieceId'));
    setPieces((prev) => {
      const dragged = prev.find((p) => p.id === draggedId);
      const target = prev.find((p) => p.currentPos === targetPos);
      if (!dragged || !target || dragged.id === target.id) return prev;
      return prev.map((p) => {
        if (p.id === draggedId) return { ...p, currentPos: targetPos };
        if (p.id === target.id) return { ...p, currentPos: dragged.currentPos };
        return p;
      });
    });
    setMoves((m) => m + 1);
  };

  const resetGame = () => {
    setPieces((prev) => {
      const positions = Array.from({ length: totalPieces }, (_, i) => i);
      const shuffled = [...positions].sort(() => Math.random() - 0.5);
      return prev.map((p, i) => ({ ...p, currentPos: shuffled[i] }));
    });
    setCompleted(false);
    setMoves(0);
    setShowWin(false);
  };

  // Use colored SVG if available, otherwise fallback to original
  const displaySvgUrl = coloredSvgUrl || svgUrl;

  if (!displaySvgUrl) {
    return (
      <div className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center h-96">
        <div className="animate-pulse text-gray-400">Загрузка пазла...</div>
      </div>
    );
  }

  const solvedPct = totalPieces
    ? Math.round((pieces.filter((p) => p.currentPos === p.correctPos).length / totalPieces) * 100)
    : 0;

  // Tab overflow padding — must stay in sync with jigsawMask.ts: pad = max(10, round(L*0.18))
  const pad = Math.max(10, Math.round(pieceSize * 0.18));
  const fullPieceSize = pieceSize + pad * 2;
  const gridW = cols * pieceSize + (cols - 1) * gap;
  const gridH = rows * pieceSize + (rows - 1) * gap;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-lg flex flex-col">
      {/* ── Top bar ── */}
      <div className="mb-4 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
            <span>Прогресс</span>
            <span>{solvedPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${solvedPct}%` }}
            />
          </div>
        </div>
        <button
          onClick={resetGame}
          className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 font-bold text-gray-800 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <RotateCcw className="w-5 h-5" />
          Перемешать
        </button>
      </div>

      {/* ── Puzzle area ── */}
      {/* overflow:visible so piece tabs (which protrude by `pad` px) are never clipped.   */}
      {/* Height is calculated from viewport so the area never collapses inside a modal.   */}
      <div
        ref={containerRef}
        className="relative bg-slate-50 rounded-2xl border border-gray-100 flex items-center justify-center"
        style={{
          height: 'calc(100vh - 260px)',
          minHeight: 320,
          overflow: 'visible',
          // Use padding equal to pad so the outer tab protrusions don't touch the rounded border
          padding: `${pad}px`,
        }}
      >
        {pieceSize > 0 && (
          <div
            className="relative"
            style={{ width: gridW, height: gridH, flexShrink: 0 }}
          >
            {/* Faded reference image */}
            <div
              className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                showPreview ? 'opacity-[0.20]' : 'opacity-[0.07]'
              }`}
              style={{
                backgroundImage: `url("${displaySvgUrl}")`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
              }}
            />

            {/* Grid of drop-zone cells */}
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${pieceSize}px)`,
                gridTemplateRows: `repeat(${rows}, ${pieceSize}px)`,
                gap: `${gap}px`,
              }}
            >
              {Array.from({ length: totalPieces }).map((_, pos) => {
                const piece = piecesByPos.get(pos);
                const isCorrect = piece?.correctPos === pos;

                return (
                  <div
                    key={pos}
                    style={{
                      width: pieceSize,
                      height: pieceSize,
                      position: 'relative',
                      overflow: 'visible',
                      // Slot looks like a pressed-in hole
                      backgroundColor: isCorrect
                        ? 'rgba(16,185,129,0.22)'
                        : 'rgba(100,116,139,0.06)',
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
                        // Tailwind hover lift — only works when not completed
                        className={`puzzle-piece ${!completed ? 'hoverable-piece' : ''}`}
                        style={{
                          position: 'absolute',
                          width: fullPieceSize,
                          height: fullPieceSize,
                          top: -pad,
                          left: -pad,
                          cursor: completed ? 'default' : 'grab',
                          // Image slice
                          backgroundImage: `url("${displaySvgUrl}")`,
                          backgroundSize: `${gridW}px ${gridH}px`,
                          backgroundPosition: `${-(piece.correctPos % cols) * (pieceSize + gap) + pad}px ${-Math.floor(piece.correctPos / cols) * (pieceSize + gap) + pad}px`,
                          backgroundRepeat: 'no-repeat',
                          backgroundColor: '#fff',
                          // Jigsaw mask
                          WebkitMaskImage: `url("${maskUrlsByPos[piece.correctPos]}")`,
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskSize: '100% 100%',
                          maskImage: `url("${maskUrlsByPos[piece.correctPos]}")`,
                          maskRepeat: 'no-repeat',
                          maskSize: '100% 100%',
                          // Richer shadows: outline + depth + colour-tinted ambient
                          filter: isCorrect
                            ? [
                                'drop-shadow(0 0 0 2.5px rgba(16,185,129,1))',
                                'drop-shadow(0 0 10px rgba(16,185,129,0.9))',
                                'drop-shadow(0 0 22px rgba(16,185,129,0.6))',
                                'drop-shadow(0 4px 8px rgba(15,23,42,0.2))',
                              ].join(' ')
                            : [
                                'drop-shadow(0 0 0 1px rgba(100,116,139,0.35))',
                                'drop-shadow(0 4px 10px rgba(15,23,42,0.20))',
                                'drop-shadow(0 1px 3px rgba(15,23,42,0.12))',
                              ].join(' '),
                          zIndex: 10,
                          transition: 'filter 0.25s, transform 0.15s',
                          transform: 'translateZ(0)',
                        }}
                        title={`Деталь ${piece.id + 1}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Win overlay */}
            <AnimatePresence>
              {showWin && (
                <motion.div
                  className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-black/15 rounded-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                  <motion.div
                    className="relative mx-4 w-full max-w-sm rounded-3xl bg-white shadow-xl border border-gray-100 p-6"
                    initial={{ opacity: 0, scale: 0.94, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 8 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.55 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-emerald-700" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-gray-900">Победа!</div>
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
    </div>
  );
};
