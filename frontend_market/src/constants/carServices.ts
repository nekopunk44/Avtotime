import { CarServiceListing } from '../types';

export const CAR_SERVICE_TYPES = [
  'Ремонт',
  'Техобслуживание',
  'Детейлинг',
  'Мойка',
  'Диагностика',
  'Шиномонтаж',
  'Кузовные работы',
  'Электрика',
];

export const INITIAL_CAR_SERVICE_LISTINGS: CarServiceListing[] = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1625047509168-a7026f36fe04?q=80&w=900&auto=format&fit=crop',
    socialNickname: '@engine.fix.spb',
    category: 'Диагностика',
    title: 'Диагностика и ремонт двигателя',
    location: 'Санкт-Петербург',
    serviceQuality: 5,
    reviews: 89,
    price: 50,
    unit: '/час',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=900&auto=format&fit=crop',
    socialNickname: '@clean.car.kzn',
    category: 'Мойка',
    title: 'Профессиональная мойка авто',
    location: 'Казань',
    serviceQuality: 4,
    reviews: 256,
    price: 25,
    pricePrefix: 'от',
    unit: '',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1597404298341-8563e3bc2f62?q=80&w=900&auto=format&fit=crop',
    socialNickname: '@detailing.msk',
    category: 'Детейлинг',
    title: 'Комплексный детейлинг',
    location: 'Москва',
    serviceQuality: 5,
    reviews: 124,
    price: 120,
    unit: '',
  },
];
