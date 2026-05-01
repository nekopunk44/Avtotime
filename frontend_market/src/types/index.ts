export interface Car {
  _id?: string;
  id: number;
  image: string;
  images?: string[];
  moderationStatus?: string;
  moderationReasons?: string[];
  moderationLastError?: string;
  price: string;
  title: string;
  mileage: string;
  fuel: string;
  transmission: string;
  year: string;
  location: string;
  seller: string;
  sellerAvatar: string;
  time: string;
  views: string;
  type: string;
  brand?: string;
  model?: string;
  bodyType?: string;
  driveType?: string;
  engineVolume?: string;
  seats?: string;
  registrationPlace?: string;
  region?: string;
  description?: string;
  socialNickname?: string;
  partGroup?: string;
  partCategory?: string;
  partCategoryKey?: string;
  priority?: number;
  sellerBadge?: string | null;
  expiresAt?: string | null;
  videoUrl?: string;
}

export interface Service {
  id: number;
  image: string;
  title: string;
  seller: string;
  sellerAvatar: string;
  rating: number;
  condition: string;
  price: string;
  location: string;
  description: string;
  time: string;
  views: string;
}

export interface ConsultationExpert {
  _id?: string;
  id: number;
  moderationStatus?: string;
  moderationReasons?: string[];
  moderationLastError?: string;
  name: string;
  avatar: string;
  socialNickname?: string;
  isVerified: boolean;
  rating: number;
  reviewsCount: number;
  specialties: string[];
  experience: number;
  consultations: number;
  hourlyRate: number;
  tags: string[];
  location: string;
}

export interface CarServiceListing {
  _id?: string;
  id: number;
  image: string;
  socialNickname?: string;
  moderationStatus?: string;
  moderationReasons?: string[];
  moderationLastError?: string;
  category: string;
  title: string;
  location: string;
  serviceQuality: number;
  reviews: number;
  price: number;
  pricePrefix?: string;
  unit: string;
}

export interface AutoTuningListing {
  _id?: string;
  id: number;
  title: string;
  socialNickname?: string;
  moderationStatus?: string;
  moderationReasons?: string[];
  moderationLastError?: string;
  category: string;
  location: string;
  rating: number;
  reviews: number;
  price: number;
  image: string;
  badge: string;
  tags: string[];
}

export interface DryCleaningListing {
  _id?: string;
  id: number;
  title: string;
  socialNickname?: string;
  moderationStatus?: string;
  moderationReasons?: string[];
  moderationLastError?: string;
  category: string;
  location: string;
  rating: number;
  reviews: number;
  price: number;
  image: string;
  badge: string;
  tags: string[];
}

export interface UserSummary {
  _id?: string;
  name?: string;
  userName?: string;
  profileImage?: string;
}

export interface AppNotification {
  _id: string;
  type: 'like' | 'comment' | 'follow' | 'message' | 'mention' | 'listing_comment' | 'system' | string;
  title?: string;
  description?: string;
  link?: string;
  image?: string;
  count?: number;
  isBatched?: boolean;
  isRead?: boolean;
  readAt?: string;
  createdAt?: string;
  actor?: UserSummary;
  actors?: UserSummary[];
  relatedType?: string;
  relatedId?: unknown;
}

export interface MarketGame {
  id: number;
  title: string;
  description?: string;
  category?: string;
  image?: string;
  url?: string;
}

export type CarServiceCreatePayload = Omit<CarServiceListing, "id" | "image"> & {
  image?: string;
  imageFile?: File | null;
};

export type AutoTuningCreatePayload = Omit<AutoTuningListing, "id" | "image" | "tags"> & {
  image?: string;
  imageFile?: File | null;
  tags: string[];
};

export type DryCleaningCreatePayload = Omit<DryCleaningListing, "id" | "image" | "tags"> & {
  image?: string;
  imageFile?: File | null;
  tags: string[];
};

export type ConsultationExpertCreatePayload = Omit<ConsultationExpert, "id" | "avatar" | "specialties" | "tags"> & {
  avatar?: string;
  avatarFile?: File | null;
  specialties: string[];
  tags: string[];
};
