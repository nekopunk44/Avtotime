import { API_URL } from './config.ts';
import { getBrands, getModels } from '../constants/mockData';

export interface GameProgress {
  gameId: string;
  gameName?: string;
  score: number;
  level: number;
  progress: number;
  bestScore: number;
  timesPlayed: number;
  achievements?: string[];
}

export interface ColoringRequest {
  svgContent: string;
  templateId?: string;
}

export interface ColoringResponse {
  success: boolean;
  coloredSvg?: string;
  error?: string;
}

// Configuration for API calls
const API_CONFIG: RequestInit = {
  credentials: 'include' as const,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
};

export const gameAPI = {
  // Получить прогресс игрока
  async getProgress(gameId: string): Promise<GameProgress> {
    try {
      const response = await fetch(`${API_URL}/games/progress/${gameId}`, API_CONFIG);
      return await response.json();
    } catch (error) {
      console.error('Error loading game progress:', error);
      return {
        gameId,
        score: 0,
        level: 1,
        progress: 0,
        bestScore: 0,
        timesPlayed: 0
      };
    }
  },

  // Сохранить прогресс
  async saveProgress(gameId: string, data: Partial<GameProgress> & { playTime?: number }): Promise<GameProgress> {
    try {
      const response = await fetch(`${API_URL}/games/progress/${gameId}`, {
        ...API_CONFIG,
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error saving game progress:', error);
      return data as GameProgress;
    }
  },

  // Получить рейтинг
  async getLeaderboard(gameId: string, limit = 10): Promise<any[]> {
    try {
      const response = await fetch(`${API_URL}/games/leaderboard/${gameId}?limit=${limit}`, API_CONFIG);
      return await response.json();
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      return [];
    }
  },

  // Получить статистику
  async getStats(): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/games/stats`, API_CONFIG);
      return await response.json();
    } catch (error) {
      console.error('Error loading stats:', error);
      return { games: [], totalScore: 0, totalGames: 0 };
    }
  },

  // Получить достижения
  async getAchievements(): Promise<string[]> {
    try {
      const response = await fetch(`${API_URL}/games/achievements`, API_CONFIG);
      const data = await response.json();
      return data.achievements || [];
    } catch (error) {
      console.error('Error loading achievements:', error);
      return [];
    }
  },

  // Получить список доступных брендов
  async getBrands(): Promise<string[]> {
    return getBrands();
  },

  // Получить модели для конкретного бренда
  async getModels(brand: string): Promise<string[]> {
    return getModels(brand);
  },

  // Запросить автоматическую раскраску SVG от бэкенда
  async requestSvgColoring(request: ColoringRequest): Promise<ColoringResponse> {
    try {
      const response = await fetch(`${API_URL}/coloring/auto`, {
        ...API_CONFIG,
        method: 'POST',
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error requesting SVG coloring:', error);
      return { success: false, error: 'Failed to request coloring' };
    }
  }
};
