import React, { useMemo, useState } from 'react';
import { Gamepad2, Play, Search } from 'lucide-react';
import { MarketGame } from '../../types';
import { showMarketToast } from '../../utils/avtotime';

interface GamesPageProps {
  games: MarketGame[];
}

export const GamesPage: React.FC<GamesPageProps> = ({ games }) => {
  const [activeCategory, setActiveCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    games.forEach((game) => {
      if (game.category) set.add(game.category);
    });
    return ['Все', ...Array.from(set)];
  }, [games]);

  const filtered = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return games.filter((game) => {
      const matchesCategory = activeCategory === 'Все' || (game.category || '') === activeCategory;
      const searchable = `${game.title} ${game.description || ''} ${game.category || ''}`.toLowerCase();
      const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, games, searchQuery]);

  const handlePlay = (game: MarketGame) => {
    if (!game.url) {
      showMarketToast('Ссылка на игру не указана.');
      return;
    }

    window.open(game.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gray-50 pt-12 pb-12 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-2xl mb-6">
            <Gamepad2 className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-serif">Игры</h1>
          <p className="text-gray-500 text-lg">Игры, которые хранятся в AVTOTIME и доступны в маркетплейсе.</p>
        </div>
      </div>

      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск по играм"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600/10 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-5 py-2.5 rounded-full text-[14px] font-bold transition-colors ${
                  activeCategory === category ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((game) => (
            <div key={game.id} className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-52 bg-gray-100 overflow-hidden">
                {game.image ? (
                  <img src={game.image} alt={game.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Gamepad2 className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <h3 className="text-[18px] font-bold text-gray-900 leading-tight">{game.title}</h3>
                  {game.category && (
                    <span className="shrink-0 bg-red-50 text-red-600 px-3 py-1 rounded-full text-[12px] font-bold">
                      {game.category}
                    </span>
                  )}
                </div>
                {game.description && <p className="text-[14px] text-gray-500 mb-5 line-clamp-2">{game.description}</p>}
                <button
                  type="button"
                  onClick={() => handlePlay(game)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" fill="currentColor" />
                  Играть
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-[28px] border border-gray-100 p-10 text-center text-gray-600">
            Пока нет игр. Добавьте их через API.
          </div>
        )}
      </div>
    </div>
  );
};

