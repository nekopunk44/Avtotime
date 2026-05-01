import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Play } from 'lucide-react';

interface TetrisGameProps {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
}

export const TetrisGame: React.FC<TetrisGameProps> = ({ onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState<number[][]>([]);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const COLS = 10;
  const ROWS = 20;
  const CELL_SIZE = 25;

  const PIECES = [
    { shape: [[1, 1, 1, 1]], color: '#3b82f6' },
    { shape: [[1, 1], [1, 1]], color: '#fbbf24' },
    { shape: [[1, 0, 0], [1, 1, 1]], color: '#ec4899' },
    { shape: [[0, 0, 1], [1, 1, 1]], color: '#8b5cf6' },
    { shape: [[1, 1, 0], [0, 1, 1]], color: '#10b981' },
    { shape: [[0, 1, 1], [1, 1, 0]], color: '#f97316' },
    { shape: [[0, 1, 0], [1, 1, 1]], color: '#ef4444' }
  ];

  // Инициализация
  const initGame = () => {
    const newBoard = Array(ROWS).fill(0).map(() => Array(COLS).fill(0));
    setBoard(newBoard);
    setScore(0);
    setGameStarted(true);
    setGameOver(false);
  };

  // Рисование
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Фон
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Сетка и блоки
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);

        if (board[row] && board[row][col]) {
          ctx.fillStyle = 'hsl(' + (board[row][col] * 60) + ', 100%, 50%)';
          ctx.fillRect(
            col * CELL_SIZE + 1,
            row * CELL_SIZE + 1,
            CELL_SIZE - 2,
            CELL_SIZE - 2
          );
        }
      }
    }

    // Счётчик
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Score: ${score}`, 10, canvas.height + 30);
  }, [board, score]);

  const resetGame = () => {
    initGame();
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🧩 Тетрис</h2>

      <div className="flex flex-col items-center gap-6">
        <canvas
          ref={canvasRef}
          width={COLS * CELL_SIZE}
          height={ROWS * CELL_SIZE}
          className="border-4 border-gray-300 rounded-lg bg-gray-900"
        />

        <div className="text-3xl font-bold text-blue-600">Счёт: {score}</div>

        {!gameStarted && !gameOver ? (
          <button
            onClick={initGame}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition text-lg"
          >
            <Play className="w-5 h-5" />
            Начать
          </button>
        ) : gameOver ? (
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600 mb-4">Игра окончена!</p>
            <button
              onClick={resetGame}
              className="flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition mx-auto"
            >
              <RotateCcw className="w-4 h-4" />
              Заново
            </button>
          </div>
        ) : (
          <p className="text-gray-600">👆 Управление: стрелки влево/вправо, вверх - вращение, вниз - ускорение</p>
        )}
      </div>
    </div>
  );
};
