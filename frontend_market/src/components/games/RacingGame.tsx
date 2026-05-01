import React, { useEffect, useState } from 'react';
import { ExternalLink, Car } from 'lucide-react';

const RacingGame: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const gameUrl = 'https://circuit-rush.vercel.app';

  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => {
      // Some hosts block iframe embedding (X-Frame-Options/CSP) and `onError` won't fire.
      // Fallback to the external link after a short timeout.
      setError(true);
      setLoading(false);
    }, 7000);
    return () => window.clearTimeout(t);
  }, [loading]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 p-4">
      <div className="mb-4 text-center hidden">
        <div className="text-white text-2xl font-bold mb-2 flex items-center justify-center gap-2">
          <Car className="w-8 h-8" />
          3D Гонки Circuit Rush
        </div>
        <div className="text-gray-400 text-sm mb-2">
          Управление: WASD или стрелки для движения
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-4">
          <div className="text-red-400 text-center p-4 bg-gray-800 rounded-lg">
            Игра недоступна для встраивания. Откроется в новой вкладке.
          </div>
          <a
            href={gameUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            ИГРАТЬ В НОВОЙ ВКЛАДКЕ
          </a>
        </div>
      ) : (
        <div className="relative w-full max-w-3xl h-[500px] max-h-[65dvh] bg-gray-800 rounded-lg overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-white">Загрузка игры...</div>
            </div>
          )}
          <iframe
            src={gameUrl}
            title="Circuit Rush Racing Game"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        </div>
      )}

      <a
        href={gameUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 text-sm text-gray-400 hover:text-gray-200 transition inline-flex items-center gap-2 hidden"
      >
        <ExternalLink className="w-4 h-4" />
        Открыть игру в новой вкладке
      </a>
    </div>
  );
};

export { RacingGame };
