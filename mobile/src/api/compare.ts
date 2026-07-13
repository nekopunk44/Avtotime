import client from './client';
import { MarketCategoryId, MarketListing } from './market';

export type CompareItemType = 'car' | 'service' | 'consultation';

export interface CompareItem {
  id: number;
  type: CompareItemType;
}

export interface ResolvedCompareItem extends CompareItem {
  listing?: MarketListing;
  categoryId?: MarketCategoryId;
}

const compareTypeByCategory: Record<MarketCategoryId, CompareItemType> = {
  cars: 'car',
  parts: 'car',
  'car-services': 'service',
  'auto-tuning': 'service',
  consultations: 'consultation',
  'dry-cleaning': 'service',
};

export function getCompareType(categoryId: MarketCategoryId): CompareItemType {
  return compareTypeByCategory[categoryId];
}

export function canCompareListing(listing: MarketListing) {
  return typeof listing.id === 'number' && Number.isFinite(listing.id);
}

export async function getCompareItems(): Promise<CompareItem[]> {
  const { data } = await client.get('/market/compare');
  return Array.isArray(data) ? data : [];
}

export async function saveCompareItems(items: CompareItem[]): Promise<CompareItem[]> {
  const { data } = await client.put('/market/compare', { items });
  return Array.isArray(data) ? data : [];
}

export function toggleCompareItem(items: CompareItem[], next: CompareItem): CompareItem[] {
  const exists = items.some((item) => item.id === next.id && item.type === next.type);
  if (exists) {
    return items.filter((item) => !(item.id === next.id && item.type === next.type));
  }

  if (items.length > 0 && items[0].type !== next.type) {
    return [next];
  }

  if (items.length >= 2) {
    return items;
  }

  return [...items, next];
}
