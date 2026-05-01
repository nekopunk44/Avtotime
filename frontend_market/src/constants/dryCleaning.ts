import { DryCleaningListing } from '../types';

export const DRY_CLEANING_TYPES = [
  'Химчистка салона',
  'Химчистка сидений',
  'Химчистка потолка',
  'Химчистка ковров',
  'Удаление запахов',
  'Озонация',
  'Полировка',
  'Защитные покрытия',
];

export const INITIAL_DRY_CLEANING_LISTINGS: DryCleaningListing[] = [
  {
    id: 1,
    title: 'Премиум химчистка салона',
    socialNickname: '@clean.car.kzn',
    category: 'Химчистка салона',
    location: 'Кишинев',
    rating: 5,
    reviews: 128,
    price: 1200,
    image: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=900&auto=format&fit=crop',
    badge: 'Топ мастер',
    tags: ['салон', 'пятна', 'быстро', 'без запаха'],
  },
  {
    id: 2,
    title: 'Озонация + удаление запахов',
    socialNickname: '@detailing.msk',
    category: 'Озонация',
    location: 'Бельцы',
    rating: 4,
    reviews: 64,
    price: 600,
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=900&auto=format&fit=crop',
    badge: 'С гарантией',
    tags: ['озон', 'запах', 'антибактериально'],
  },
];

