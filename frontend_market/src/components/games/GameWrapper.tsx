import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trophy } from 'lucide-react';
import { gameAPI, GameProgress } from '../../utils/gameAPI';

interface GameWrapperProps {
  gameId: string;
  gameName: string;
  children: React.ReactNode;
  onScore?: (score: number) => void;
  onClose?: () => void;
  showLeaderboard?: boolean;
  hideHeader?: boolean;
  floatingHeader?: boolean;
  scrollable?: boolean;
  containerClassName?: string;
}

export const GameWrapper: React.FC<GameWrapperProps> = ({
  gameId,
  gameName,
  children,
  onScore,
  onClose,
  showLeaderboard = true,
  hideHeader = false,
  floatingHeader = false,
  scrollable = false,
  containerClassName,
}) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const swipeEnabled = useMemo(() => {
    // Games that rely on keyboard arrows on desktop.
    // On mobile, we translate swipes into Arrow key events.
    return new Set(['tetris', 'game-2048', 'snake']).has(gameId);
  }, [gameId]);

  useEffect(() => {
    loadGameData();
  }, [gameId]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const loadGameData = async () => {
    if (showLeaderboard) {
      const leader = await gameAPI.getLeaderboard(gameId, 5);
      setLeaderboard(leader);
    }
  };

  const handleScore = (score: number) => {
    onScore?.(score);
  };

  const dispatchKey = (key: string) => {
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    } catch {
      // ignore
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!swipeEnabled) return;
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!swipeEnabled) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const t = e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    // small moves = ignore (tap)
    if (Math.max(ax, ay) < 30) return;

    if (ax > ay) {
      dispatchKey(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
      dispatchKey(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeEnabled) return;
    if (e.pointerType !== 'touch') return;
    touchStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!swipeEnabled) return;
    if (e.pointerType !== 'touch') return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    if (Math.max(ax, ay) < 30) return;

    if (ax > ay) {
      dispatchKey(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
      dispatchKey(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
  };

  const displayGameName = gameName.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const baseContainerClassName = showLeaderboard ? 'max-w-6xl' : 'max-w-5xl';

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4" style={{ minHeight: '100dvh' }}>
      <div
        className={`relative bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden ${baseContainerClassName} h-[66dvh] max-h-[66dvh] sm:h-[90vh] sm:max-h-[90vh] ${containerClassName || ''}`}
      >
        {hideHeader && floatingHeader ? (
          <>
            <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-10 -translate-x-1/2 rounded-2xl bg-black/40 px-4 py-2 text-white font-extrabold backdrop-blur-sm">
              {displayGameName}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 inline-flex items-center justify-center rounded-2xl bg-black/35 p-2.5 text-white/90 backdrop-blur-sm hover:bg-black/45 transition disabled:opacity-40 pointer-events-auto"
              aria-label="Закрыть игру"
              disabled={!onClose}
            >
              <X className="w-5 h-5" />
            </button>
          </>
        ) : null}

        {/* Header */}
        {!hideHeader ? (
          <div className="grid grid-cols-[40px_1fr_40px] items-center p-4 md:p-6 border-b border-gray-200 bg-white flex-shrink-0">
            <div className="w-10 h-10" />
            <div className="text-center">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">{displayGameName}</h1>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        ) : null}

        {/* Main Content */}
        <div
          className={`${hideHeader ? 'h-full' : 'flex-1'} ${
            showLeaderboard
              ? 'grid md:grid-cols-3 gap-6 p-6 overflow-hidden'
              : scrollable
                ? 'overflow-y-auto p-3 sm:p-5'
                : 'overflow-hidden p-0'
          }`}
        >
          {/* Game Area */}
          <div
            className={`flex min-w-0 min-h-0 ${
              showLeaderboard
                ? 'overflow-hidden items-center justify-center md:col-span-2'
                : scrollable
                  ? 'items-start justify-stretch w-full'
                  : 'overflow-hidden items-stretch justify-stretch w-full h-full'
            }`}
          >
            {/* Пройти children с функцией обновления очков */}
            <div
              className={`${showLeaderboard ? '' : 'w-full'} ${scrollable ? '' : 'h-full'} min-w-0 min-h-0`}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              style={swipeEnabled ? { touchAction: 'none' } : undefined}
            >
            {React.isValidElement(children) ? (
              React.cloneElement(children as any, {
                onScore: handleScore,
                onClose,
              } as any)
            ) : (
              <div className="text-red-500">Ошибка загрузки игры</div>
            )}
            </div>
          </div>

          {/* Sidebar - only show if showLeaderboard is true */}
          {showLeaderboard && (
            <div className="space-y-6 overflow-y-auto pr-2">
              {/* Leaderboard */}
              {leaderboard.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-600" />
                    Топ результаты
                  </h3>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((player, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-white rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-600 w-6">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                          </span>
                          <span className="font-medium text-gray-900">
                            {player.userId?.name || 'Игрок'}
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">{player.bestScore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
