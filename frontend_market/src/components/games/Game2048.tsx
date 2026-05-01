import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface Game2048Props {
  onScore?: (score: number) => void;
  onComplete?: () => void;
}

export const Game2048: React.FC<Game2048Props> = ({ onScore, onComplete }) => {
  const [grid, setGrid] = useState<number[][]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  // Инициализация игры
  const initGame = () => {
    const newGrid = Array(4).fill(0).map(() => Array(4).fill(0));
    addNewTile(newGrid);
    addNewTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setGameOver(false);
    setWon(false);
  };

  useEffect(() => {
    initGame();
  }, []);

  const addNewTile = (currentGrid: number[][]) => {
    const empty: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (currentGrid[i][j] === 0) empty.push([i, j]);
      }
    }
    if (empty.length === 0) return;
    const [i, j] = empty[Math.floor(Math.random() * empty.length)];
    currentGrid[i][j] = Math.random() > 0.9 ? 4 : 2;
  };

  const moveLeft = (currentGrid: number[][]) => {
    let changed = false;
    const newGrid = currentGrid.map(row => [...row]);

    for (let i = 0; i < 4; i++) {
      let row = newGrid[i].filter(val => val !== 0);
      
      for (let j = 0; j < row.length - 1; j++) {
        if (row[j] === row[j + 1]) {
          row[j] *= 2;
          setScore(prev => prev + row[j]);
          onScore?.(score + row[j]);
          row.splice(j + 1, 1);
        }
      }
      
      while (row.length < 4) row.push(0);
      
      if (JSON.stringify(newGrid[i]) !== JSON.stringify(row)) changed = true;
      newGrid[i] = row;
    }
    
    return { grid: newGrid, changed };
  };

  const rotate = (arr: number[][], times: number) => {
    let result = arr;
    for (let t = 0; t < times; t++) {
      const newArr = Array(4).fill(0).map(() => Array(4).fill(0));
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          newArr[j][3 - i] = result[i][j];
        }
      }
      result = newArr;
    }
    return result;
  };

  const move = (direction: 'left' | 'right' | 'up' | 'down') => {
    if (gameOver || won) return;

    let newGrid = grid.map(row => [...row]);
    let changed = false;

    if (direction === 'left') {
      const result = moveLeft(newGrid);
      newGrid = result.grid;
      changed = result.changed;
    } else if (direction === 'right') {
      newGrid = rotate(newGrid, 2);
      const result = moveLeft(newGrid);
      newGrid = result.grid;
      changed = result.changed;
      newGrid = rotate(newGrid, 2);
    } else if (direction === 'up') {
      newGrid = rotate(newGrid, 3);
      const result = moveLeft(newGrid);
      newGrid = result.grid;
      changed = result.changed;
      newGrid = rotate(newGrid, 1);
    } else if (direction === 'down') {
      newGrid = rotate(newGrid, 1);
      const result = moveLeft(newGrid);
      newGrid = result.grid;
      changed = result.changed;
      newGrid = rotate(newGrid, 3);
    }

    if (!changed) return;

    addNewTile(newGrid);
    setGrid(newGrid);

    // Проверка победы
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (newGrid[i][j] === 2048) {
          setWon(true);
          onComplete?.();
          return;
        }
      }
    }

    // Проверка game over
    if (!canMove(newGrid)) {
      setGameOver(true);
    }
  };

  const canMove = (currentGrid: number[][]): boolean => {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (currentGrid[i][j] === 0) return true;
        if (i < 3 && currentGrid[i][j] === currentGrid[i + 1][j]) return true;
        if (j < 3 && currentGrid[i][j] === currentGrid[i][j + 1]) return true;
      }
    }
    return false;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        e.preventDefault();
        move('left');
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault();
        move('right');
      } else if (key === 'arrowup' || key === 'w') {
        e.preventDefault();
        move('up');
      } else if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
        move('down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, won, grid]);

  const getColor = (value: number): string => {
    const colors: Record<number, string> = {
      2: 'bg-blue-100 text-blue-900',
      4: 'bg-blue-200 text-blue-900',
      8: 'bg-blue-300 text-white',
      16: 'bg-blue-400 text-white',
      32: 'bg-blue-500 text-white',
      64: 'bg-blue-600 text-white',
      128: 'bg-orange-400 text-white',
      256: 'bg-orange-500 text-white',
      512: 'bg-orange-600 text-white',
      1024: 'bg-red-400 text-white',
      2048: 'bg-green-500 text-white'
    };
    return colors[value] || 'bg-gray-200 text-gray-800';
  };

  return (
    <div
      className="w-full h-full bg-white flex flex-col overflow-hidden px-4 pb-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5rem)' }}
    >
      <div className="text-center mb-3">
        <p className="text-gray-600 text-[13px] leading-snug">Объедини плитки и достигни 2048!</p>
      </div>

      <div className="flex justify-center mb-3">
        <div className="bg-blue-50 rounded-2xl p-4 w-full max-w-[520px] text-center flex flex-col items-center">
          <div className="text-sm text-gray-600">Счётчик</div>
          <div className="text-4xl font-black text-blue-600 tabular-nums leading-none">{score}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center pb-2">
        <div className="w-full max-w-[520px] aspect-square">
          <div className="grid grid-cols-4 grid-rows-4 gap-2 w-full h-full bg-gray-300 p-2 rounded-2xl">
            {grid.map((row, i) =>
              row.map((value, j) => (
                <div
                  key={`${i}-${j}`}
                  className={`w-full h-full flex items-center justify-center rounded-2xl font-black text-[clamp(14px,4.2vw,26px)] transition-all select-none ${
                    value === 0 ? 'bg-gray-100 text-gray-800' : getColor(value)
                  }`}
                >
                  {value !== 0 ? value : ''}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {won ? (
        <div className="mt-2 rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-center font-bold text-emerald-700">
          🎉 Поздравляем! Ты достиг 2048!
          <button
            type="button"
            onClick={initGame}
            className="mt-3 inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition mx-auto"
          >
            <RotateCcw className="w-4 h-4" />
            Новая игра
          </button>
        </div>
      ) : null}

      {gameOver && !won ? (
        <div className="mt-2 rounded-2xl bg-red-50 border border-red-100 p-5 text-center font-bold text-red-700">
          💀 Игра окончена!
          <div className="text-sm font-bold text-red-600 mt-1">Окончательный счёт: {score}</div>
          <button
            type="button"
            onClick={initGame}
            className="mt-3 inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 transition mx-auto"
          >
            <RotateCcw className="w-4 h-4" />
            Попробовать снова
          </button>
        </div>
      ) : null}
    </div>
  );
};
