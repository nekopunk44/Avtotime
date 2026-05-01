export type VehicleType =
  | 'Легковые автомобили'
  | 'Перевозки'
  | 'Прицепы'
  | 'Мото'
  | 'Грузовые автомобили'
  | 'Велосипеды'
  | 'Микроавтобусы';

export type VehicleListingSchema = {
  vehicleType: VehicleType;
  showBrandModel: boolean;
  showAutoSpecs: boolean;
  showBikeSpecs: boolean;
  showTransportSpecs: boolean;
  showTrailerSpecs: boolean;
  showSeatsRegistration: boolean;
};

export const VEHICLE_LISTING_SCHEMAS: Record<VehicleType, VehicleListingSchema> = {
  'Легковые автомобили': {
    vehicleType: 'Легковые автомобили',
    showBrandModel: true,
    showAutoSpecs: true,
    showBikeSpecs: false,
    showTransportSpecs: false,
    showTrailerSpecs: false,
    showSeatsRegistration: true,
  },
  'Грузовые автомобили': {
    vehicleType: 'Грузовые автомобили',
    showBrandModel: true,
    showAutoSpecs: true,
    showBikeSpecs: false,
    showTransportSpecs: false,
    showTrailerSpecs: false,
    showSeatsRegistration: true,
  },
  Мото: {
    vehicleType: 'Мото',
    showBrandModel: true,
    showAutoSpecs: true,
    showBikeSpecs: false,
    showTransportSpecs: false,
    showTrailerSpecs: false,
    showSeatsRegistration: true,
  },
  Микроавтобусы: {
    vehicleType: 'Микроавтобусы',
    showBrandModel: true,
    showAutoSpecs: true,
    showBikeSpecs: false,
    showTransportSpecs: false,
    showTrailerSpecs: false,
    showSeatsRegistration: true,
  },
  Велосипеды: {
    vehicleType: 'Велосипеды',
    showBrandModel: true,
    showAutoSpecs: false,
    showBikeSpecs: true,
    showTransportSpecs: false,
    showTrailerSpecs: false,
    showSeatsRegistration: false,
  },
  Перевозки: {
    vehicleType: 'Перевозки',
    showBrandModel: false,
    showAutoSpecs: false,
    showBikeSpecs: false,
    showTransportSpecs: true,
    showTrailerSpecs: false,
    showSeatsRegistration: false,
  },
  Прицепы: {
    vehicleType: 'Прицепы',
    showBrandModel: false,
    showAutoSpecs: false,
    showBikeSpecs: false,
    showTransportSpecs: false,
    showTrailerSpecs: true,
    showSeatsRegistration: false,
  },
};

export const TRANSPORT_TYPES = [
  'Все',
  'Грузоперевозки',
  'Пассажирские перевозки',
  'Эвакуатор',
  'Спецтехника',
  'Другой тип',
];

export const BIKE_TYPES = [
  'Все',
  'Горные (MTB)',
  'Шоссейные',
  'Городские',
  'Гибридные',
  'Складные',
  'Электровелосипеды',
  'BMX',
  'Детские',
  'Другой тип',
];

export const BIKE_CONDITIONS = ['Все', 'Новый', 'Б/У'];
export const BIKE_FRAME_MATERIALS = ['Все', 'Алюминий', 'Сталь', 'Карбон', 'Титан', 'Магний', 'Другой материал'];
export const BIKE_SUSPENSIONS = ['Все', 'Rigid', 'Hardtail', 'Full Suspension'];
export const BIKE_FRAME_SIZES = ['Все', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const TRAILER_TYPES = [
  'Легковой прицеп',
  'Полуприцеп',
  'Рефрижератор',
  'Автовоз',
  'Цистерна',
  'Платформа',
  'Самосвал',
  'Другое',
];

export const normalizeVehicleType = (raw: string | undefined): VehicleType => {
  const t = String(raw || '').trim();
  if (
    t === 'Легковые автомобили' ||
    t === 'Перевозки' ||
    t === 'Прицепы' ||
    t === 'Мото' ||
    t === 'Грузовые автомобили' ||
    t === 'Велосипеды' ||
    t === 'Микроавтобусы'
  ) {
    return t;
  }
  return 'Легковые автомобили';
};

