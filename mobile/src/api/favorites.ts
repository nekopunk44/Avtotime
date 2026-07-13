import client from './client';
import { MarketCategoryId, MarketListing, getListingImage, getListingPrice, getListingTitle } from './market';

export type FavoriteListingType =
  | 'car'
  | 'part'
  | 'car-service'
  | 'auto-tuning'
  | 'consultation'
  | 'dry-cleaning';

export interface FavoriteItem {
  _id: string;
  listingId: string;
  listingType: FavoriteListingType;
  listingTitle?: string;
  listingImage?: string;
  listingPrice?: string | number;
  createdAt?: string;
}

const typeByCategory: Record<MarketCategoryId, FavoriteListingType> = {
  cars: 'car',
  parts: 'part',
  'car-services': 'car-service',
  'auto-tuning': 'auto-tuning',
  consultations: 'consultation',
  'dry-cleaning': 'dry-cleaning',
};

const categoryByType: Record<FavoriteListingType, MarketCategoryId> = {
  car: 'cars',
  part: 'parts',
  'car-service': 'car-services',
  'auto-tuning': 'auto-tuning',
  consultation: 'consultations',
  'dry-cleaning': 'dry-cleaning',
};

export function getFavoriteListingType(categoryId: MarketCategoryId) {
  return typeByCategory[categoryId];
}

export function getCategoryIdFromFavoriteType(type: FavoriteListingType) {
  return categoryByType[type] ?? 'cars';
}

export function getListingObjectId(listing: MarketListing) {
  return listing._id || '';
}

export async function getFavorites(type?: FavoriteListingType): Promise<FavoriteItem[]> {
  const { data } = await client.get('/favorites', { params: type ? { type } : undefined });
  return Array.isArray(data) ? data : [];
}

export async function checkFavorite(listingId: string, listingType: FavoriteListingType): Promise<boolean> {
  const { data } = await client.get('/favorites/check', { params: { listingId, listingType } });
  return !!data?.isFavorite;
}

export async function addFavorite(listing: MarketListing, categoryId: MarketCategoryId): Promise<FavoriteItem> {
  const listingId = getListingObjectId(listing);
  const listingType = getFavoriteListingType(categoryId);

  const { data } = await client.post('/favorites', {
    listingId,
    listingType,
    listingTitle: getListingTitle(listing),
    listingImage: getListingImage(listing),
    listingPrice: getListingPrice(listing, categoryId),
  });

  return data;
}

export async function removeFavorite(listingId: string, listingType: FavoriteListingType) {
  await client.delete('/favorites', { data: { listingId, listingType } });
}
