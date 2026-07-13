import client, { API_URL } from './client';

export type KidsActivityType = 'Game' | 'Coloring' | 'Cartoon';

export interface MarketGame {
  _id?: string;
  id?: number;
  title: string;
  description?: string;
  category?: string;
  image?: string;
  url?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface KidsActivity {
  _id?: string;
  id?: number;
  title: string;
  description?: string;
  type: KidsActivityType;
  progress?: number | null;
  image?: string;
  createdAt?: string;
}

export interface GameProgress {
  _id?: string;
  gameId: string;
  gameName?: string;
  score: number;
  level: number;
  progress: number;
  bestScore: number;
  timesPlayed: number;
  totalPlayTime?: number;
  achievements?: string[];
  gameData?: Record<string, unknown>;
  lastPlayedAt?: string;
  userId?: string | { _id?: string; name?: string; userName?: string; avatar?: string; profileImage?: string };
}

export interface GameStats {
  games: GameProgress[];
  totalScore: number;
  totalGames: number;
  totalPlayTime?: number;
  averageScore?: number;
}

export interface KidsLeaderboardItem {
  rank?: number;
  name?: string;
  score?: string | number;
  initial?: string;
}

export type ColoringCollection = 'coloring' | 'coloring_mult';

export interface ColoringTemplate {
  id: string;
  filename: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  category?: string;
  collection: ColoringCollection;
}

export interface ColoringDrawing {
  _id?: string;
  id?: string;
  templateId: string;
  title: string;
  imageData?: string;
  progress?: number;
  brushSize?: number;
  colorsUsed?: string[];
  createdAt?: string;
  updatedAt?: string;
  savedAt?: string;
}

export interface SaveColoringDrawingPayload {
  templateId: string;
  title: string;
  imageData: string;
  progress?: number;
  brushSize?: number;
  colorsUsed?: string[];
}

export interface CreateMarketGamePayload {
  title: string;
  description?: string;
  category?: string;
  image?: string;
  url?: string;
  isActive?: boolean;
}

export async function getMarketGames(): Promise<MarketGame[]> {
  const { data } = await client.get('/market/games');
  return Array.isArray(data) ? data : [];
}

export async function createMarketGame(payload: CreateMarketGamePayload): Promise<MarketGame> {
  const { data } = await client.post('/market/games', {
    title: payload.title.trim(),
    description: payload.description?.trim() || '',
    category: payload.category?.trim() || 'Игры',
    image: payload.image?.trim() || '',
    url: payload.url?.trim() || '',
    isActive: payload.isActive ?? true,
  });
  return data;
}

export async function getKidsActivities(): Promise<KidsActivity[]> {
  const { data } = await client.get('/market/kids/activities');
  return Array.isArray(data) ? data : [];
}

export async function getKidsLeaderboard(): Promise<KidsLeaderboardItem[]> {
  const { data } = await client.get('/market/kids/leaderboard');
  return Array.isArray(data) ? data : [];
}

export async function getGameProgress(gameId: string): Promise<GameProgress> {
  const { data } = await client.get(`/games/progress/${encodeURIComponent(gameId)}`);
  return data;
}

export async function saveGameProgress(
  gameId: string,
  payload: Partial<GameProgress> & { playTime?: number },
): Promise<GameProgress> {
  const { data } = await client.post(`/games/progress/${encodeURIComponent(gameId)}`, payload);
  return data;
}

export async function getGameLeaderboard(gameId: string, limit = 10): Promise<GameProgress[]> {
  const { data } = await client.get(`/games/leaderboard/${encodeURIComponent(gameId)}`, { params: { limit } });
  return Array.isArray(data) ? data : [];
}

export async function getGameStats(): Promise<GameStats> {
  const { data } = await client.get('/games/stats');
  return {
    games: Array.isArray(data?.games) ? data.games : [],
    totalScore: Number(data?.totalScore || 0),
    totalGames: Number(data?.totalGames || 0),
    totalPlayTime: Number(data?.totalPlayTime || 0),
    averageScore: Number(data?.averageScore || 0),
  };
}

export async function getGameAchievements(): Promise<string[]> {
  const { data } = await client.get('/games/achievements');
  return Array.isArray(data?.achievements) ? data.achievements : [];
}

const encodePublicPath = (filename: string) => filename
  .split('/')
  .map((part) => encodeURIComponent(part))
  .join('/');

export function getColoringTemplateUrl(template: ColoringTemplate): string {
  return `${API_URL}/api/public/${template.collection}/${encodePublicPath(template.filename)}`;
}

export async function getColoringTemplates(collection: ColoringCollection = 'coloring'): Promise<ColoringTemplate[]> {
  const { data } = await client.get('/coloring/templates', { params: { collection } });
  const templates = Array.isArray(data?.templates) ? data.templates : [];
  return templates.map((item: any) => ({
    id: String(item.id || item.filename),
    filename: String(item.filename || ''),
    title: String(item.title || item.filename || 'Раскраска'),
    subtitle: item.subtitle ? String(item.subtitle) : '',
    emoji: item.emoji ? String(item.emoji) : collection === 'coloring_mult' ? '🎬' : '🚗',
    category: item.category ? String(item.category) : collection === 'coloring_mult' ? 'cartoons' : 'cars',
    collection: item.collection === 'coloring_mult' ? 'coloring_mult' : 'coloring',
  }));
}

export async function getColoringDrawings(page = 1, limit = 20): Promise<ColoringDrawing[]> {
  const { data } = await client.get('/coloring/user-drawings', { params: { page, limit } });
  return Array.isArray(data?.drawings) ? data.drawings : [];
}

export async function autoColorTemplate(template: ColoringTemplate): Promise<string> {
  const { data } = await client.post('/coloring/auto', {
    templateId: template.id,
    svgContent: getColoringTemplateUrl(template),
  });

  if (!data?.success || !data?.coloredSvg) {
    throw new Error(data?.error || 'Не удалось раскрасить шаблон');
  }

  return String(data.coloredSvg);
}

export async function saveColoringDrawing(payload: SaveColoringDrawingPayload): Promise<ColoringDrawing> {
  const { data } = await client.post('/coloring/save', {
    templateId: payload.templateId,
    title: payload.title.trim(),
    imageData: payload.imageData,
    progress: payload.progress ?? 100,
    brushSize: payload.brushSize ?? 20,
    colorsUsed: payload.colorsUsed ?? [],
  });

  return data?.drawing ?? data;
}
