import client from './client';
import { getUploadFile } from '../utils/upload';

export type MarketCategoryId =
  | 'cars'
  | 'parts'
  | 'car-services'
  | 'auto-tuning'
  | 'consultations'
  | 'dry-cleaning';

export interface MarketCategory {
  id: MarketCategoryId;
  label: string;
  shortLabel: string;
  endpoint: string;
  icon: string;
}

export interface MarketListing {
  _id?: string;
  id?: number;
  title?: string;
  name?: string;
  image?: string;
  images?: string[];
  avatar?: string;
  price?: string | number;
  hourlyRate?: number;
  pricePrefix?: string;
  unit?: string;
  location?: string;
  region?: string;
  seller?: string;
  sellerAvatar?: string;
  socialNickname?: string;
  author?: string | { _id: string; name?: string; userName?: string; profileImage?: string };
  type?: string;
  brand?: string;
  model?: string;
  year?: string;
  mileage?: string;
  fuel?: string;
  transmission?: string;
  bodyType?: string;
  driveType?: string;
  engineVolume?: string;
  seats?: string;
  registrationPlace?: string;
  description?: string;
  category?: string;
  partGroup?: string;
  partCategory?: string;
  serviceQuality?: number;
  rating?: number;
  reviews?: number;
  reviewsCount?: number;
  isVerified?: boolean;
  experience?: number;
  consultations?: number;
  specialties?: string[];
  tags?: string[];
  badge?: string;
  sellerBadge?: string | null;
  moderationStatus?: string;
  moderationLastError?: string;
  moderationReasons?: string[];
  appealMessage?: string;
  appealedAt?: string | null;
  listingType?: string;
  createdAt?: string;
}

export type MarketSort = 'newest' | 'oldest' | 'price_asc' | 'price_desc';

export interface MarketSearchOptions {
  q?: string;
  type?: MarketCategoryId | 'all';
  minPrice?: string;
  maxPrice?: string;
  location?: string;
  category?: string;
  sortBy?: MarketSort;
}

export interface MyMarketListing {
  key: string;
  categoryId: MarketCategoryId;
  category: MarketCategory;
  listing: MarketListing;
}

export const MARKET_CATEGORIES: MarketCategory[] = [
  { id: 'cars', label: 'Авто', shortLabel: 'Авто', endpoint: '/market/cars', icon: 'car-sport-outline' },
  { id: 'parts', label: 'Запчасти', shortLabel: 'Запчасти', endpoint: '/market/parts', icon: 'construct-outline' },
  { id: 'car-services', label: 'Сервисы', shortLabel: 'Сервисы', endpoint: '/market/car-services', icon: 'build-outline' },
  { id: 'auto-tuning', label: 'Тюнинг', shortLabel: 'Тюнинг', endpoint: '/market/auto-tuning', icon: 'flash-outline' },
  { id: 'consultations', label: 'Консультации', shortLabel: 'Эксперты', endpoint: '/market/consultations', icon: 'chatbubbles-outline' },
  { id: 'dry-cleaning', label: 'Химчистка', shortLabel: 'Чистка', endpoint: '/market/dry-cleaning', icon: 'sparkles-outline' },
];

export const getMarketCategory = (categoryId: MarketCategoryId) =>
  MARKET_CATEGORIES.find((item) => item.id === categoryId) ?? MARKET_CATEGORIES[0];

export function getMarketCategoryFromListingType(listingType?: string): MarketCategoryId {
  switch (String(listingType || '').toLowerCase()) {
    case 'part':
    case 'parts':
      return 'parts';
    case 'car':
    case 'cars':
      return 'cars';
    case 'car-service':
    case 'car-services':
      return 'car-services';
    case 'auto-tuning':
      return 'auto-tuning';
    case 'consultation':
    case 'consultations':
      return 'consultations';
    case 'dry-cleaning':
      return 'dry-cleaning';
    default:
      return 'cars';
  }
}

export function getListingImage(listing: MarketListing) {
  return listing.images?.[0] || listing.image || listing.avatar || '';
}

export function getListingTitle(listing: MarketListing) {
  return listing.title || listing.name || 'Объявление';
}

export function getListingPrice(listing: MarketListing, categoryId?: MarketCategoryId) {
  if (categoryId === 'consultations' && listing.hourlyRate != null) {
    return `€ ${listing.hourlyRate}/ч`;
  }

  if (listing.price == null || listing.price === '') {
    return 'Цена по запросу';
  }

  if (typeof listing.price === 'number') {
    const prefix = listing.pricePrefix ? `${listing.pricePrefix} ` : '';
    const unit = listing.unit ? `/${listing.unit}` : '';
    return `${prefix}€ ${listing.price}${unit}`;
  }

  return listing.price;
}

export function getSellerNickname(listing: MarketListing) {
  return listing.socialNickname?.replace(/^@/, '') || '';
}

export function getAuthorId(listing: MarketListing) {
  if (!listing.author) return '';
  if (typeof listing.author === 'string') return listing.author;
  return listing.author._id;
}

export async function loadMarketListings(
  categoryId: MarketCategoryId,
  options: { mine?: boolean; q?: string; page?: number; limit?: number } = {},
): Promise<MarketListing[]> {
  const category = getMarketCategory(categoryId);
  const params: Record<string, string | number | boolean> = {
    page: options.page ?? 1,
    limit: options.limit ?? 40,
  };

  if (options.mine) params.mine = 1;
  if (options.q?.trim()) params.q = options.q.trim();

  const { data } = await client.get(category.endpoint, { params });
  return Array.isArray(data) ? data : data.listings ?? [];
}

const marketSearchParams = (options: MarketSearchOptions) => {
  const params: Record<string, string> = {};
  if (options.q?.trim()) params.q = options.q.trim();
  if (options.type && options.type !== 'all') params.type = options.type;
  if (options.minPrice?.trim()) params.minPrice = options.minPrice.trim();
  if (options.maxPrice?.trim()) params.maxPrice = options.maxPrice.trim();
  if (options.location?.trim()) params.location = options.location.trim();
  if (options.category?.trim()) params.category = options.category.trim();
  if (options.sortBy) params.sortBy = options.sortBy;
  return params;
};

export async function searchMarketListings(options: MarketSearchOptions): Promise<MarketListing[]> {
  const { data } = await client.get('/market/search', { params: marketSearchParams(options) });
  return Array.isArray(data) ? data : [];
}

export async function filterMarketListings(options: MarketSearchOptions): Promise<MarketListing[]> {
  const { data } = await client.get('/market/filter', { params: marketSearchParams(options) });
  return Array.isArray(data) ? data : [];
}

export async function getDistinctBrands(type?: MarketCategoryId | 'all'): Promise<string[]> {
  const { data } = await client.get('/market/brands', {
    params: type && type !== 'all' ? { type } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

export async function getDistinctModels(
  brand?: string,
  type?: MarketCategoryId | 'all',
): Promise<string[]> {
  const { data } = await client.get('/market/models', {
    params: {
      ...(brand?.trim() ? { brand: brand.trim() } : {}),
      ...(type && type !== 'all' ? { type } : {}),
    },
  });
  return Array.isArray(data) ? data : data.models ?? [];
}

export async function loadMyMarketListings(): Promise<MyMarketListing[]> {
  const results = await Promise.allSettled(
    MARKET_CATEGORIES.map(async (category) => ({
      category,
      listings: await loadMarketListings(category.id, { mine: true, limit: 150 }),
    })),
  );

  return results.flatMap((result) => {
    if (result.status !== 'fulfilled') return [];
    const { category, listings } = result.value;
    return listings.map((listing, index) => ({
      key: `${category.id}-${listing._id || listing.id || index}`,
      categoryId: category.id,
      category,
      listing,
    }));
  });
}

export async function deleteMarketListing(categoryId: MarketCategoryId, listing: MarketListing): Promise<void> {
  const id = listing._id;
  if (!id) {
    throw new Error('У объявления нет внутреннего идентификатора для удаления');
  }

  const category = getMarketCategory(categoryId);
  await client.delete(`${category.endpoint}/${id}`);
}

export async function submitMarketAppeal(
  categoryId: MarketCategoryId,
  listing: MarketListing,
  message: string,
): Promise<{ message?: string }> {
  const id = listing._id;
  if (!id) {
    throw new Error('У объявления нет внутреннего идентификатора для апелляции');
  }

  const { data } = await client.post(`/market/${categoryId}/${encodeURIComponent(id)}/appeal`, {
    message: message.trim(),
  });
  return data;
}

export async function recordMarketView(categoryId: MarketCategoryId, listingId: number) {
  if (categoryId !== 'cars' && categoryId !== 'parts') return;
  try {
    await client.post(`/market/${categoryId}/${listingId}/view`);
  } catch {}
}

export async function recordMarketLead(categoryId: MarketCategoryId, listingId: number) {
  if (categoryId !== 'cars' && categoryId !== 'parts') return;
  try {
    await client.post(`/market/${categoryId}/${listingId}/lead`);
  } catch {}
}

export interface CreateVehicleListingPayload {
  categoryId: 'cars' | 'parts';
  title: string;
  price: string;
  currency: string;
  brand?: string;
  model?: string;
  year?: string;
  mileage?: string;
  fuel?: string;
  gearbox?: string;
  body?: string;
  drive?: string;
  engineVolume?: string;
  seats?: string;
  registration?: string;
  region?: string;
  description?: string;
  partGroup?: string;
  partCategory?: string;
  images: string[];
}

export interface CreateServiceListingPayload {
  categoryId: 'car-services' | 'auto-tuning' | 'consultations' | 'dry-cleaning';
  title: string;
  name?: string;
  category?: string;
  location: string;
  price?: string;
  hourlyRate?: string;
  pricePrefix?: string;
  unit?: string;
  imageUri: string;
  tags?: string;
  specialties?: string;
  experience?: string;
  consultations?: string;
  rating?: string;
  reviews?: string;
}

export interface UpdateMarketListingPayload {
  title?: string;
  name?: string;
  price?: string;
  hourlyRate?: string;
  currency?: string;
  category?: string;
  location?: string;
  region?: string;
  description?: string;
  brand?: string;
  model?: string;
  year?: string;
  mileage?: string;
  fuel?: string;
  gearbox?: string;
  body?: string;
  drive?: string;
  engineVolume?: string;
  seats?: string;
  registration?: string;
  partGroup?: string;
  partCategory?: string;
  pricePrefix?: string;
  unit?: string;
  tags?: string;
  specialties?: string;
  badge?: string;
  imageUris?: string[];
}

const appendText = (formData: FormData, key: string, value?: string) => {
  if (value?.trim()) formData.append(key, value.trim());
};

const appendPatchText = (formData: FormData, key: string, value?: string) => {
  if (value !== undefined) formData.append(key, value.trim());
};

export async function createVehicleListing(payload: CreateVehicleListingPayload): Promise<MarketListing> {
  const formData = new FormData();
  appendText(formData, 'offerType', 'Продажа');
  appendText(formData, 'title', payload.title);
  appendText(formData, 'price', payload.price);
  appendText(formData, 'currency', payload.currency || 'EUR');
  appendText(formData, 'brand', payload.brand);
  appendText(formData, 'model', payload.model);
  appendText(formData, 'year', payload.year);
  appendText(formData, 'mileage', payload.mileage);
  appendText(formData, 'fuel', payload.fuel);
  appendText(formData, 'gearbox', payload.gearbox);
  appendText(formData, 'body', payload.body);
  appendText(formData, 'drive', payload.drive);
  appendText(formData, 'engineVolume', payload.engineVolume);
  appendText(formData, 'seats', payload.seats);
  appendText(formData, 'registration', payload.registration);
  appendText(formData, 'region', payload.region);
  appendText(formData, 'description', payload.description);
  appendText(formData, 'partGroup', payload.partGroup);
  appendText(formData, 'partCategory', payload.partCategory);

  payload.images.forEach((uri) => formData.append('images', getUploadFile(uri, 'market-photo.jpg')));

  const endpoint = payload.categoryId === 'parts' ? '/market/parts' : '/market/cars';
  const { data } = await client.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
}

export async function updateMarketListing(
  categoryId: MarketCategoryId,
  listing: MarketListing,
  payload: UpdateMarketListingPayload,
): Promise<MarketListing> {
  const id = listing._id;
  if (!id) {
    throw new Error('У объявления нет внутреннего идентификатора для редактирования');
  }

  const category = getMarketCategory(categoryId);
  const formData = new FormData();
  const imageUris = payload.imageUris?.filter(Boolean) ?? [];

  if (categoryId === 'cars' || categoryId === 'parts') {
    appendPatchText(formData, 'offerType', listing.type || 'Продажа');
    appendPatchText(formData, 'title', payload.title);
    appendPatchText(formData, 'price', payload.price);
    appendPatchText(formData, 'currency', payload.currency || 'EUR');
    appendPatchText(formData, 'brand', payload.brand);
    appendPatchText(formData, 'model', payload.model);
    appendPatchText(formData, 'year', payload.year);
    appendPatchText(formData, 'region', payload.region ?? payload.location);
    appendPatchText(formData, 'description', payload.description);

    if (categoryId === 'cars') {
      appendPatchText(formData, 'mileage', payload.mileage);
      appendPatchText(formData, 'fuel', payload.fuel);
      appendPatchText(formData, 'gearbox', payload.gearbox);
      appendPatchText(formData, 'bodyType', payload.body);
      appendPatchText(formData, 'driveType', payload.drive);
      appendPatchText(formData, 'engineVolume', payload.engineVolume);
      appendPatchText(formData, 'seats', payload.seats);
      appendPatchText(formData, 'registration', payload.registration);
    } else {
      appendPatchText(formData, 'partGroup', payload.partGroup);
      appendPatchText(formData, 'partCategory', payload.partCategory);
    }

    imageUris.forEach((uri) => formData.append('images', getUploadFile(uri, 'market-photo.jpg')));
  } else if (categoryId === 'consultations') {
    appendPatchText(formData, 'name', payload.name || payload.title);
    appendPatchText(formData, 'location', payload.location);
    appendPatchText(formData, 'hourlyRate', payload.hourlyRate || payload.price);
    appendPatchText(formData, 'specialties', payload.specialties);
    appendPatchText(formData, 'tags', payload.tags);

    if (imageUris[0]) formData.append('avatar', getUploadFile(imageUris[0], 'market-avatar.jpg'));
  } else {
    appendPatchText(formData, 'title', payload.title);
    appendPatchText(formData, 'category', payload.category);
    appendPatchText(formData, 'location', payload.location);
    appendPatchText(formData, 'price', payload.price);
    appendPatchText(formData, 'pricePrefix', payload.pricePrefix);
    appendPatchText(formData, 'unit', payload.unit);
    appendPatchText(formData, 'tags', payload.tags);
    appendPatchText(formData, 'badge', payload.badge);

    if (imageUris[0]) formData.append('image', getUploadFile(imageUris[0], 'market-photo.jpg'));
  }

  const { data } = await client.patch(`${category.endpoint}/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
}

export async function createServiceListing(payload: CreateServiceListingPayload): Promise<MarketListing> {
  const formData = new FormData();
  const category = getMarketCategory(payload.categoryId);

  if (payload.categoryId === 'consultations') {
    appendText(formData, 'name', payload.name || payload.title);
    appendText(formData, 'hourlyRate', payload.hourlyRate || payload.price);
    appendText(formData, 'specialties', payload.specialties);
    appendText(formData, 'experience', payload.experience);
    appendText(formData, 'consultations', payload.consultations);
    appendText(formData, 'tags', payload.tags);
    appendText(formData, 'rating', payload.rating);
    appendText(formData, 'reviewsCount', payload.reviews);
    appendText(formData, 'isVerified', 'false');
    formData.append('avatar', getUploadFile(payload.imageUri, 'market-avatar.jpg'));
  } else {
    appendText(formData, 'title', payload.title);
    appendText(formData, 'category', payload.category);
    appendText(formData, 'price', payload.price);
    appendText(formData, 'pricePrefix', payload.pricePrefix);
    appendText(formData, 'unit', payload.unit);
    appendText(formData, 'tags', payload.tags);
    appendText(formData, 'rating', payload.rating);
    appendText(formData, 'reviews', payload.reviews);
    appendText(formData, 'badge', payload.categoryId === 'auto-tuning' ? 'Tuning' : payload.categoryId === 'dry-cleaning' ? 'Clean' : '');
    formData.append('image', getUploadFile(payload.imageUri, 'market-photo.jpg'));
  }

  appendText(formData, 'location', payload.location);

  const { data } = await client.post(category.endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
}
