import React, { useMemo, useState, useEffect } from 'react';
import {
  BookOpen,
  Bomb,
  Brush,
  Car,
  Cat,
  Crown,
  Gamepad2,
  LayoutGrid,
  Palette,
  Puzzle,
  Rocket,
  Sparkles,
  Target,
  Truck,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import dotsConnectPreviewUrl from '../../assets/dots-connect-preview.svg';
import puzzlePreviewUrl from '../../assets/game-previews/puzzle.svg';
import carJumpPreviewUrl from '../../assets/game-previews/car-jump.svg';
import roadFighterPreviewUrl from '../../assets/game-previews/road-fighter.svg';
import circuitRushPreviewUrl from '../../assets/game-previews/racing.svg';
import tetrisPreviewUrl from '../../assets/game-previews/tetris.svg';
import game2048PreviewUrl from '../../assets/game-previews/game-2048.svg';
import minesweeperPreviewUrl from '../../assets/game-previews/minesweeper.svg';
import snakePreviewUrl from '../../assets/game-previews/snake.svg';
import sudokuPreviewUrl from '../../assets/game-previews/sudoku.svg';
import flappyPreviewUrl from '../../assets/game-previews/flappy-car.svg';
import checkersPreviewUrl from '../../assets/game-previews/checkers.svg';
import chessPreviewUrl from '../../assets/game-previews/chess.svg';
import pongPreviewUrl from '../../assets/game-previews/pong.svg';
import breakoutPreviewUrl from '../../assets/game-previews/breakout.svg';
import { API_URL } from '../../utils/config';
import {
  BreakoutGame,
  CarJumpGame,
  CarPuzzleGame,
  CarRacingGame,
  ChessGame,
  ColoringGame,
  ColoringGameV2,
  DotsConnectGame,
  FindDifferencesGame,
  FlappyCarGame,
  Game2048,
  GameWrapper,
  MinesweeperGame,
  PongGame,
  RacingGame,
  SnakeGame,
  SudokuGame,
  SvgPuzzleGame,
  TetrisGame,
  CheckersGame,
} from '../games';
import { KidsPuzzleGallery } from './KidsPuzzleGallery';

const ThumbnailImage: React.FC<{ src: string; alt: string; imgClassName?: string }> = ({ src, alt, imgClassName }) => {
  const [error, setError] = useState(false);

  const normalizedSrc = useMemo(() => {
    if (!src) return src;
    // Never encode data: URLs — this breaks already-encoded SVG thumbnails.
    if (src.startsWith('data:')) return src;
    // Encode only when needed (spaces / non-ascii); otherwise keep as-is.
    if (/[\s\u0080-\uFFFF]/.test(src)) return encodeURI(src);
    return src;
  }, [src]);

  if (error) {
    return (
      <div className="w-14 h-14 rounded-2xl bg-white/80 border border-white/60 shadow-sm flex items-center justify-center">
        <Brush className="w-7 h-7 text-gray-900" />
      </div>
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={imgClassName || "w-full h-full object-contain p-4 select-none pointer-events-none"}
      draggable={false}
      onError={(e) => {
        console.error('Failed to load thumbnail:', src, e);
        setError(true);
      }}
    />
  );
};

type TabId = 'Все' | 'Раскраски' | 'Головоломки' | 'Игры' | 'Классика';

type ActivityKind = 'coloring' | 'puzzle' | 'kids_game' | 'classic' | 'external';

type Activity = {
  id: string;
  title: string;
  description: string;
  tab: Exclude<TabId, 'Все'>;
  kind: ActivityKind;
  gameId: string;
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
  url?: string;
  thumbnail?: string; // SVG content or image URL for preview
};

const GAME_PREVIEW_BY_ID: Record<string, string> = {
  'car-jump': carJumpPreviewUrl,
  'road-fighter': roadFighterPreviewUrl,
  racing: circuitRushPreviewUrl,
  tetris: tetrisPreviewUrl,
  'game-2048': game2048PreviewUrl,
  minesweeper: minesweeperPreviewUrl,
  snake: snakePreviewUrl,
  sudoku: sudokuPreviewUrl,
  'flappy-car': flappyPreviewUrl,
  checkers: checkersPreviewUrl,
  chess: chessPreviewUrl,
  pong: pongPreviewUrl,
  breakout: breakoutPreviewUrl,
};

const TABS: Array<{ id: TabId; icon: React.ComponentType<{ className?: string }>; label: string }> = [
  { id: 'Все', label: 'Все', icon: LayoutGrid },
  { id: 'Раскраски', label: 'Раскраски', icon: Palette },
  { id: 'Головоломки', label: 'Головоломки', icon: Puzzle },
  { id: 'Игры', label: 'Игры', icon: Gamepad2 },
  { id: 'Классика', label: 'Классика', icon: Sparkles },
];

const ACTIVITIES: Activity[] = [
  // Coloring - отдельные раскраски по категориям
  {
    id: 'coloring-cars',
    title: 'Машинки',
    description: 'Раскрашивай машины в любые цвета!',
    tab: 'Раскраски',
    kind: 'coloring',
    gameId: 'coloring-cars',
    gradient: 'from-blue-50 to-blue-100',
    icon: Brush,
    thumbnail: `${API_URL}/public/coloring/ferari.svg`,
  },
  {
    id: 'coloring-cartoons',
    title: 'Герои мультиков',
    description: 'Раскрашивай любимых персонажей!',
    tab: 'Раскраски',
    kind: 'coloring',
    gameId: 'coloring-cartoons',
    gradient: 'from-purple-50 to-purple-100',
    icon: Brush,
    thumbnail: `${API_URL}/public/coloring_mult/Английская Королева.svg`,
  },

  // Puzzle from coloring templates
  {
    id: 'svg-puzzle',
    title: 'Пазлы',
    description: 'Собери картинку из деталей!',
    tab: 'Головоломки',
    kind: 'puzzle',
    gameId: 'svg-puzzle-gallery',
    gradient: 'from-slate-100 to-gray-50',
    icon: Puzzle,
    thumbnail: puzzlePreviewUrl,
  },
  {
    id: 'dots-connect',
    title: 'Соедини по точкам',
    description: 'Соединяй точки по порядку и получи картинку!',
    tab: 'Головоломки',
    kind: 'puzzle',
    gameId: 'dots-connect',
    gradient: 'from-blue-50 to-sky-50',
    icon: Puzzle,
    thumbnail: dotsConnectPreviewUrl,
  },

  // Kids games
  {
    id: 'jump',
    title: 'Car Jump',
    description: 'Прыгай на платформах и поднимайся как можно выше!',
    tab: 'Игры',
    kind: 'kids_game',
    gameId: 'car-jump',
    gradient: 'from-indigo-50 to-white',
    icon: Rocket,
  },
  {
    id: 'road-fighter',
    title: 'Road Fighter',
    description: 'Уворачивайся от врагов и набирай очки!',
    tab: 'Игры',
    kind: 'kids_game',
    gameId: 'road-fighter',
    gradient: 'from-orange-50 to-white',
    icon: Car,
  },
  {
    id: 'racing',
    title: '3D Гонки Circuit Rush',
    description: 'Гоняй по трассе в 3D!',
    tab: 'Игры',
    kind: 'kids_game',
    gameId: 'racing',
    gradient: 'from-red-50 to-white',
    icon: Zap,
  },

  // Classic games
  {
    id: 'tetris',
    title: 'Тетрис',
    description: 'Классика: собирай линии и набирай очки.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'tetris',
    gradient: 'from-blue-50 to-white',
    icon: Sparkles,
  },
  {
    id: '2048',
    title: '2048',
    description: 'Объединяй плитки и получи 2048.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'game-2048',
    gradient: 'from-amber-50 to-white',
    icon: Sparkles,
  },
  {
    id: 'mines',
    title: 'Сапёр',
    description: 'Открывай клетки и ставь флаги.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'minesweeper',
    gradient: 'from-red-50 to-white',
    icon: Bomb,
  },
  {
    id: 'snake',
    title: 'Змейка',
    description: 'Ешь еду и не врезайся в себя.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'snake',
    gradient: 'from-emerald-50 to-white',
    icon: Sparkles,
  },
  {
    id: 'sudoku',
    title: 'Судоку',
    description: 'Цифры 1–9 без повторов.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'sudoku',
    gradient: 'from-indigo-50 to-white',
    icon: Sparkles,
  },
  {
    id: 'flappy',
    title: 'Flappy Car',
    description: 'Пролети как можно дальше.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'flappy-car',
    gradient: 'from-cyan-50 to-white',
    icon: Sparkles,
  },
  {
    id: 'checkers',
    title: 'Шашки',
    description: 'Перепрыгивай и забирай фишки.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'checkers',
    gradient: 'from-gray-50 to-white',
    icon: Crown,
  },
  {
    id: 'chess',
    title: 'Шахматы',
    description: 'Упрощённые правила — играй быстро.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'chess',
    gradient: 'from-gray-50 to-white',
    icon: Crown,
  },
  {
    id: 'pong',
    title: 'Pong',
    description: 'Отбей мяч и выиграй у компьютера.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'pong',
    gradient: 'from-slate-50 to-white',
    icon: Sparkles,
  },
  {
    id: 'breakout',
    title: 'Breakout',
    description: 'Разбей все блоки и не урони мяч.',
    tab: 'Классика',
    kind: 'classic',
    gameId: 'breakout',
    gradient: 'from-violet-50 to-white',
    icon: Sparkles,
  },
];

export const KidsPage: React.FC<{ initialTab?: TabId }> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'Все');
  const [selected, setSelected] = useState<Activity | null>(null);
  const [apiGames, setApiGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [gameForm, setGameForm] = useState({
    title: '',
    description: '',
    category: 'Игры',
    image: '',
    url: '',
    isActive: true,
  });
  const [creatingGame, setCreatingGame] = useState(false);

  // Загрузка игр с API при монтировании компонента
  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoadingGames(true);
        const response = await fetch(`${API_URL}/market/games`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          setApiGames(data || []);
        }
      } catch (error) {
        console.error('Ошибка загрузки игр:', error);
      } finally {
        setLoadingGames(false);
      }
    };

    loadGames();
  }, []);

  // Функция создания новой игры
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameForm.title.trim()) {
      alert('Введите название игры');
      return;
    }

    try {
      setCreatingGame(true);
      const response = await fetch(`${API_URL}/market/games`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gameForm),
      });

      if (response.ok) {
        const newGame = await response.json();
        setApiGames([newGame, ...apiGames]);
        setGameForm({
          title: '',
          description: '',
          category: 'Игры',
          image: '',
          url: '',
          isActive: true,
        });
        setShowCreateGame(false);
        alert('Игра успешно добавлена!');
      } else {
        alert('Ошибка при создании игры');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при создании игры');
    } finally {
      setCreatingGame(false);
    }
  };

  // Объединяем хардкодированные игры с играми из API
  const allActivities = useMemo(() => {
    const converted = apiGames
      .filter((game) => game.isActive)
      .map((game) => ({
        id: game._id,
        title: game.title,
        description: game.description,
        tab: game.category || 'Игры',
        kind: 'external' as const,
        gameId: `external-${game._id}`,
        gradient: 'from-slate-50 to-white',
        icon: Gamepad2,
        url: game.url,
        thumbnail: undefined,
      }));
    return [...ACTIVITIES, ...converted];
  }, [apiGames]);

  const filtered = useMemo(() => {
    if (activeTab === 'Все') return allActivities;
    return allActivities.filter((a) => a.tab === activeTab);
  }, [activeTab, allActivities]);

  const renderGame = (gameId: string, url?: string) => {
    // Обработка внешних игр с URL
    if (gameId.startsWith('external-') && url) {
      return (
        <iframe
          src={url}
          className="w-full h-full border-0 rounded-lg"
          title="External Game"
          allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      );
    }

    switch (gameId) {
      // coloring - отдельные раскраски по категориям (новая версия)
      case 'coloring-cars':
        return <ColoringGameV2 showAllTemplates />;
      case 'coloring-special':
        return <ColoringGameV2 category="special" />;
      case 'coloring-animals':
        return <ColoringGameV2 category="cars" />;
      case 'coloring-cartoons':
        return <ColoringGameV2 category="cartoons" />;
      case 'colors-meaning':
        return <ColoringGameV2 />;

      case 'dots-connect':
        return <DotsConnectGame />;
      case 'find-differences-1':
        return <FindDifferencesGame theme={1} />;
      case 'find-differences-2':
        return <FindDifferencesGame theme={2} />;
      case 'find-differences-3':
        return <FindDifferencesGame theme={3} />;
      case 'find-differences-4':
        return <FindDifferencesGame theme={4} />;

      // kids games
      case 'car-jump':
        return <CarJumpGame />;
      case 'road-fighter':
        return <CarRacingGame />;
      case 'racing':
        return <RacingGame />;

      // classic
      case 'tetris':
        return <TetrisGame />;
      case 'game-2048':
        return <Game2048 />;
      case 'minesweeper':
        return <MinesweeperGame />;
      case 'snake':
        return <SnakeGame />;
      case 'sudoku':
        return <SudokuGame />;
      case 'flappy-car':
        return <FlappyCarGame />;
      case 'checkers':
        return <CheckersGame />;
      case 'chess':
        return <ChessGame />;
      case 'pong':
        return <PongGame />;
      case 'breakout':
        return <BreakoutGame />;

      case 'svg-puzzle-gallery':
        return (
          <KidsPuzzleGallery
            onSelect={(svgUrl, title) =>
              setSelected({
                id: `svg-puzzle:${svgUrl}`,
                title,
                description: 'Собери картинку из деталей!',
                tab: 'Головоломки',
                kind: 'puzzle',
                gameId: 'svg-puzzle',
                gradient: 'from-emerald-50 to-teal-100',
                icon: Puzzle,
                url: svgUrl,
              })
            }
          />
        );

      // svg puzzle (selected template via `url`)
      case 'svg-puzzle': {
        return <SvgPuzzleGame svgUrl={url || `${API_URL}/public/coloring/Cybertruck.svg`} level="medium" />;
      }

      default:
        return <div className="p-8 text-center text-gray-500">Раздел в разработке…</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gray-50 pt-6 sm:pt-12 pb-6 sm:pb-14 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-red-50 rounded-2xl mb-4 sm:mb-6">
            <Gamepad2 className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 font-serif">Для детей</h1>
          <p className="text-gray-500 text-sm sm:text-lg">Раскраски, головоломки и игры. Выбирай карточку и играй прямо здесь.</p>
        </div>
      </div>

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 mt-2 sm:mt-4">
        <div className="mb-6 sm:mb-8">
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex sm:justify-center">
            <div className="flex gap-1.5 sm:gap-2 bg-gray-200/50 p-1.5 sm:p-2 rounded-full w-max">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 sm:gap-2.5 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-[13px] sm:text-[15px] font-bold transition-colors z-10 whitespace-nowrap ${
                    activeTab === tab.id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {activeTab === tab.id ? (
                    <motion.div
                      layoutId="kidsActiveTab"
                      className="absolute inset-0 bg-white rounded-full shadow-sm -z-10"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.7 }}
                    />
                  ) : null}
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <motion.div layout className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((a) => {
              const thumbnail = a.thumbnail || GAME_PREVIEW_BY_ID[a.gameId];
              const builtInPreview = !a.thumbnail && Boolean(GAME_PREVIEW_BY_ID[a.gameId]);
              const useContainForBuiltInPreview = builtInPreview && ['svg-puzzle-gallery', 'dots-connect'].includes(a.gameId);
              return (
                <motion.button
                  key={a.id}
                  layout
                  type="button"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => {
                    console.log('Selected activity:', a);
                    setSelected(a);
                  }}
                  data-thumbnail={thumbnail || 'none'}
                  className="text-left bg-white rounded-[20px] sm:rounded-[32px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full"
                >
                  <div className={`relative aspect-[16/9] sm:aspect-[16/7.5] bg-gradient-to-br ${a.gradient} shrink-0`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {thumbnail ? (
                        <ThumbnailImage
                          src={thumbnail}
                          alt={a.title}
                          imgClassName={
                            builtInPreview
                              ? useContainForBuiltInPreview
                                ? 'w-full h-full object-contain p-4 sm:p-6 select-none pointer-events-none'
                                : 'w-full h-full object-cover select-none pointer-events-none'
                              : 'w-full h-full object-contain p-3 sm:p-4 select-none pointer-events-none'
                          }
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-white/80 border border-white/60 shadow-sm flex items-center justify-center">
                          <a.icon className="w-5 h-5 sm:w-7 sm:h-7 text-gray-900" />
                        </div>
                      )}
                    </div>
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                    <span
                      className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-[12px] font-bold ${
                        a.kind === 'coloring'
                          ? 'bg-amber-50 text-amber-700'
                          : a.kind === 'puzzle'
                            ? 'bg-purple-50 text-purple-700'
                            : a.kind === 'kids_game'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      {a.kind === 'coloring' ? <><Palette className="w-3 h-3 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline"> Раскраска</span><span className="sm:hidden">Раскраска</span></> : null}
                      {a.kind === 'puzzle' ? <><Puzzle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline"> Головоломка</span><span className="sm:hidden">Головоломка</span></> : null}
                      {a.kind === 'kids_game' ? <><Gamepad2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline"> Игра</span><span className="sm:hidden">Игра</span></> : null}
                      {a.kind === 'classic' ? <><Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline"> Классика</span><span className="sm:hidden">Классика</span></> : null}
                    </span>
                  </div>
                </div>
                <div className="p-3 sm:p-5 flex flex-col flex-1">
                  <h3 className="text-[14px] sm:text-[18px] font-bold text-gray-900 mb-0.5 sm:mb-1 leading-tight">{a.title}</h3>
                  <p className="text-gray-500 text-[11px] sm:text-[14px] mb-1 sm:mb-2 flex-1 leading-snug hidden sm:block">{a.description}</p>
                </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {selected ? (
        <GameWrapper
          gameId={selected.gameId}
          gameName={selected.gameId === 'racing' ? 'Circuit Rush' : selected.title}
          onClose={() => setSelected(null)}
          showLeaderboard={false}
          hideHeader={
            selected.kind === 'coloring' ||
            selected.kind === 'classic' ||
            selected.gameId === 'car-jump' ||
            selected.gameId === 'road-fighter' ||
            selected.gameId === 'snake'
          }
          floatingHeader={selected.kind === 'classic' && selected.gameId !== 'snake'}
          scrollable={selected.gameId === 'svg-puzzle-gallery'}
          containerClassName={
            selected.gameId === 'svg-puzzle-gallery'
              ? 'w-[96vw] h-[90dvh] max-w-[560px] max-h-[90dvh]'
              : selected.gameId === 'svg-puzzle' || selected.gameId === 'dots-connect'
              ? 'w-[96vw] !h-auto max-w-[560px] max-h-[90dvh]'
              : selected.gameId === 'car-jump' ||
                selected.gameId === 'road-fighter' ||
                selected.kind === 'classic' ||
                selected.gameId === 'snake'
              ? selected.gameId === 'car-jump'
                ? 'w-[88vw] h-[88vw] max-w-[70vh] max-h-[70vh]'
                : 'w-[96vw] h-[86dvh] max-w-[560px] max-h-[86dvh]'
              : undefined
          }
        >
          {renderGame(selected.gameId, selected.url)}
        </GameWrapper>
      ) : null}

      {/* Модальное окно для создания новой игры */}
      {showCreateGame ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Добавить новую игру</h2>
                <button
                  onClick={() => setShowCreateGame(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateGame} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Название игры *</label>
                  <input
                    type="text"
                    required
                    value={gameForm.title}
                    onChange={(e) => setGameForm({ ...gameForm, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500"
                    placeholder="Название игры"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Описание</label>
                  <textarea
                    value={gameForm.description}
                    onChange={(e) => setGameForm({ ...gameForm, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 resize-none"
                    placeholder="Описание игры"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Категория</label>
                  <select
                    value={gameForm.category}
                    onChange={(e) => setGameForm({ ...gameForm, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500"
                  >
                    <option value="Раскраски">Раскраски</option>
                    <option value="Головоломки">Головоломки</option>
                    <option value="Игры">Игры</option>
                    <option value="Классика">Классика</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Изображение (URL)</label>
                  <input
                    type="url"
                    value={gameForm.image}
                    onChange={(e) => setGameForm({ ...gameForm, image: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">URL игры</label>
                  <input
                    type="url"
                    value={gameForm.url}
                    onChange={(e) => setGameForm({ ...gameForm, url: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500"
                    placeholder="https://example.com/game"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={gameForm.isActive}
                    onChange={(e) => setGameForm({ ...gameForm, isActive: e.target.checked })}
                    className="w-5 h-5 text-red-600 rounded border-gray-300"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-900">
                    Активная игра
                  </label>
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="submit"
                    disabled={creatingGame}
                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {creatingGame ? 'Добавление...' : 'Добавить игру'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateGame(false)}
                    className="flex-1 border border-gray-200 text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
};
