import client from './client';
import { MarketCategoryId } from './market';

export type ReviewListingType = 'car' | 'car-service' | 'auto-tuning' | 'consultation' | 'dry-cleaning';

export interface ReviewUser {
  _id: string;
  name?: string;
  userName?: string;
  profileImage?: string;
}

export interface ReviewItem {
  _id: string;
  reviewer: ReviewUser;
  targetUser: ReviewUser;
  listing?: string;
  listingType?: ReviewListingType;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string[];
  cons?: string[];
  helpful?: string[];
  unhelpful?: string[];
  isVerifiedPurchase?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewStats {
  totalReviews: number;
  avgRating: number | string;
  ratingBreakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface ReviewsResponse {
  reviews: ReviewItem[];
  stats: ReviewStats;
}

export interface ReviewPayload {
  targetUserId: string;
  listingId?: string;
  listingType?: ReviewListingType;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string[];
  cons?: string[];
  isVerifiedPurchase?: boolean;
}

const listingTypeByCategory: Partial<Record<MarketCategoryId, ReviewListingType>> = {
  cars: 'car',
  'car-services': 'car-service',
  'auto-tuning': 'auto-tuning',
  consultations: 'consultation',
  'dry-cleaning': 'dry-cleaning',
};

export function getReviewListingType(categoryId: MarketCategoryId) {
  return listingTypeByCategory[categoryId];
}

export async function getReviews(params: {
  targetUserId: string;
  listingId?: string;
  listingType?: ReviewListingType;
}): Promise<ReviewsResponse> {
  const { data } = await client.get('/reviews', { params });
  return {
    reviews: Array.isArray(data?.reviews) ? data.reviews : [],
    stats: data?.stats ?? {
      totalReviews: 0,
      avgRating: 0,
      ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    },
  };
}

export async function getUserRatingStats(userId: string): Promise<ReviewStats> {
  const { data } = await client.get(`/reviews/user/${encodeURIComponent(userId)}/stats`);
  return {
    totalReviews: Number(data?.totalReviews || 0),
    avgRating: Number(data?.avgRating || 0),
    ratingBreakdown: data?.ratingBreakdown ?? { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  };
}

export async function addReview(payload: ReviewPayload): Promise<ReviewItem> {
  const { data } = await client.post('/reviews', payload);
  return data;
}

export async function updateReview(
  reviewId: string,
  payload: Pick<ReviewPayload, 'rating' | 'title' | 'comment' | 'pros' | 'cons'>,
): Promise<ReviewItem> {
  const { data } = await client.patch(`/reviews/${reviewId}`, payload);
  return data;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await client.delete(`/reviews/${reviewId}`);
}

export async function markReviewHelpful(reviewId: string): Promise<ReviewItem> {
  const { data } = await client.post(`/reviews/${reviewId}/helpful`);
  return data;
}

export async function markReviewUnhelpful(reviewId: string): Promise<ReviewItem> {
  const { data } = await client.post(`/reviews/${reviewId}/unhelpful`);
  return data;
}
