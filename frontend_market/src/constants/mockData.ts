import { Car, Service } from '../types';
import { API_URL } from '../utils/config';

export const SORT_OPTIONS = [
  'Новые',
  'Старые',
  'Цена: от низкой к высокой',
  'Цена: от высокой к низкой',
];

export const ALL_BRANDS: string[] = [
  'Acura',
  'Alfa Romeo',
  'Audi',
  'BMW',
  'Brilliance Auto',
  'BYD',
  'Cadillac',
  'Chery',
  'Chevrolet',
  'Chrysler',
  'Citroën',
  'Dacia',
  'Daewoo',
  'Daihatsu',
  'Dodge',
  'Fiat',
  'Ford',
  'Geely',
  'Great Wall Motors',
  'Honda',
  'Hummer',
  'Hyundai',
  'Infiniti',
  'Isuzu',
  'Jaguar',
  'Jeep',
  'Kia',
  'Lancia',
  'Land Rover',
  'Lexus',
  'Lifan',
  'Lincoln',
  'Mazda',
  'Mercedes-Benz',
  'MINI',
  'Mitsubishi',
  'Nissan',
  'Opel',
  'Peugeot',
  'Porsche',
  'Renault',
  'Rover',
  'Saab',
  'SEAT',
  'Škoda',
  'Smart',
  'SsangYong',
  'Subaru',
  'Suzuki',
  'Toyota',
  'Tesla',
  'Volkswagen',
  'Volvo',
  'AZLK',
  'IZH',
  'AvtoVAZ',
  'GAZ',
  'ZAZ',
  'UAZ',
  'Другая марка',
];

export const BRANDS_AND_MODELS: Record<string, string[]> = {
  Acura: ['MDX', 'RDX', 'TLX', 'ILX', 'Integra', 'NSX', 'RLX', 'Другая модель'],
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Giulietta', 'Tonale', 'MiTo', '159', 'Brera', 'Другая модель'],
  Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'R8', 'e-tron', 'Другая модель'],
  BMW: ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4', 'i3', 'i4', 'i5', 'i7', 'i8', 'iX', 'Другая модель'],
  'Brilliance Auto': ['V5', 'H530', 'M2', 'BS4', 'BS6', 'Другая модель'],
  BYD: ['Dolphin', 'Atto 3', 'Seal', 'Tang', 'Han', 'Другая модель'],
  Cadillac: ['Escalade', 'CTS', 'ATS', 'SRX', 'XT5', 'XT6', 'Другая модель'],
  Chery: ['Tiggo', 'Tiggo 7', 'Tiggo 8', 'Arrizo 5', 'Amulet', 'Другая модель'],
  Chevrolet: ['Spark', 'Aveo', 'Cruze', 'Malibu', 'Camaro', 'Corvette', 'Trax', 'Equinox', 'Tahoe', 'Suburban', 'Silverado', 'Другая модель'],
  Chrysler: ['300', 'Voyager', 'Pacifica', 'Sebring', 'PT Cruiser', 'Другая модель'],
  'Citroën': ['C1', 'C2', 'C3', 'C4', 'C4 Picasso', 'C5', 'Berlingo', 'Jumpy', 'DS3', 'DS4', 'Другая модель'],
  Dacia: ['Logan', 'Sandero', 'Duster', 'Dokker', 'Lodgy', 'Jogger', 'Spring', 'Другая модель'],
  Daewoo: ['Matiz', 'Lanos', 'Nexia', 'Leganza', 'Другая модель'],
  Daihatsu: ['Sirion', 'Terios', 'Cuore', 'Move', 'Rocky', 'Другая модель'],
  Dodge: ['Charger', 'Challenger', 'Durango', 'Journey', 'Другая модель'],
  Fiat: ['500', 'Punto', 'Tipo', 'Doblo', 'Panda', 'Другая модель'],
  Ford: ['Fiesta', 'Focus', 'Mondeo', 'Mustang', 'Kuga', 'Explorer', 'Escape', 'Transit', 'Edge', 'Fusion', 'Другая модель'],
  Geely: ['Coolray', 'Atlas', 'Emgrand', 'Tugella', 'MK', 'Другая модель'],
  'Great Wall Motors': ['Hover H5', 'Wingle', 'Haval H6', 'Jolion', 'Другая модель'],
  Honda: ['Civic', 'Accord', 'CR-V', 'HR-V', 'Jazz', 'Pilot', 'Odyssey', 'City', 'Другая модель'],
  Hummer: ['H1', 'H2', 'H3', 'Другая модель'],
  Hyundai: ['i10', 'i20', 'i30', 'Accent', 'Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Kona', 'Creta', 'Другая модель'],
  Infiniti: ['Q50', 'Q60', 'QX50', 'QX60', 'QX80', 'FX', 'Другая модель'],
  Isuzu: ['D-Max', 'Trooper', 'Rodeo', 'MU-X', 'Другая модель'],
  Jaguar: ['XE', 'XF', 'XJ', 'F-Pace', 'E-Pace', 'Другая модель'],
  Jeep: ['Wrangler', 'Cherokee', 'Grand Cherokee', 'Compass', 'Renegade', 'Другая модель'],
  Kia: ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Sorento', 'Soul', 'Optima', 'Stinger', 'Seltos', 'Другая модель'],
  Lancia: ['Ypsilon', 'Delta', 'Thema', 'Musa', 'Другая модель'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Sport', 'Evoque', 'Velar', 'Freelander', 'Другая модель'],
  Lexus: ['IS', 'ES', 'GS', 'LS', 'RX', 'NX', 'UX', 'LX', 'CT', 'Другая модель'],
  Lifan: ['X60', 'X50', 'Solano', 'Breez', 'Другая модель'],
  Lincoln: ['Navigator', 'Continental', 'MKZ', 'MKT', 'MKC', 'Другая модель'],
  Mazda: ['2', '3', '6', 'CX-3', 'CX-5', 'CX-30', 'CX-7', 'CX-9', 'MX-5', 'Другая модель'],
  'Mercedes-Benz': ['A-Class', 'B-Class', 'C-Class', 'E-Class', 'S-Class', 'CLA', 'CLS', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class', 'V-Class', 'Другая модель'],
  MINI: ['Cooper', 'Clubman', 'Countryman', 'Paceman', 'Другая модель'],
  Mitsubishi: ['Lancer', 'Outlander', 'Pajero', 'ASX', 'Eclipse Cross', 'Galant', 'L200', 'Другая модель'],
  Nissan: ['Micra', 'Note', 'Juke', 'Qashqai', 'X-Trail', 'Pathfinder', 'Navara', 'Leaf', 'Almera', 'Другая модель'],
  Opel: ['Corsa', 'Astra', 'Insignia', 'Vectra', 'Zafira', 'Mokka', 'Meriva', 'Другая модель'],
  Peugeot: ['206', '207', '208', '301', '307', '308', '3008', '5008', 'Partner', 'Expert', 'Другая модель'],
  Porsche: ['911', 'Cayenne', 'Macan', 'Panamera', 'Boxster', 'Cayman', 'Taycan', 'Другая модель'],
  Renault: ['Clio', 'Megane', 'Laguna', 'Scenic', 'Captur', 'Koleos', 'Kadjar', 'Twingo', 'Trafic', 'Другая модель'],
  Rover: ['25', '45', '75', '200', '400', 'Другая модель'],
  Saab: ['9-3', '9-5', '900', '9000', 'Другая модель'],
  SEAT: ['Ibiza', 'Leon', 'Toledo', 'Altea', 'Ateca', 'Tarraco', 'Другая модель'],
  'Škoda': ['Fabia', 'Octavia', 'Superb', 'Rapid', 'Scala', 'Karoq', 'Kodiaq', 'Yeti', 'Другая модель'],
  Smart: ['Fortwo', 'Forfour', 'Roadster', 'Другая модель'],
  SsangYong: ['Kyron', 'Actyon', 'Rexton', 'Tivoli', 'Korando', 'Другая модель'],
  Subaru: ['Impreza', 'Forester', 'Outback', 'Legacy', 'XV', 'WRX', 'Другая модель'],
  Suzuki: ['Swift', 'Vitara', 'Jimny', 'Grand Vitara', 'SX4', 'Ignis', 'Другая модель'],
  Tesla: ['Model S', 'Model 3', 'Model X', 'Model Y', 'Cybertruck', 'Roadster', 'Другая модель'],
  Toyota: ['Yaris', 'Corolla', 'Auris', 'Camry', 'Prius', 'RAV4', 'Highlander', 'Avensis', 'Hilux', 'Land Cruiser', 'Другая модель'],
  Volkswagen: ['Polo', 'Golf', 'Jetta', 'Passat', 'Tiguan', 'Touareg', 'Arteon', 'Sharan', 'Caddy', 'Transporter', 'Другая модель'],
  Volvo: ['S40', 'S60', 'S80', 'S90', 'V40', 'V60', 'V90', 'XC40', 'XC60', 'XC90', 'Другая модель'],
  AZLK: ['Москвич 2141', 'Москвич 412', 'Москвич 2140', 'Другая модель'],
  IZH: ['Ода', 'Комби', '2715', 'Другая модель'],
  AvtoVAZ: ['Vesta', 'Granta', 'Kalina', 'Priora', 'Niva', 'Другая модель'],
  GAZ: ['Volga', 'Газель', 'Соболь', 'Валдай', 'Газон Next', 'Садко', 'Другая модель'],
  UAZ: ['Hunter', 'Patriot', 'Буханка', 'Пикап', 'Другая модель'],
  ZAZ: ['Lanos', 'Sens', 'Slavuta', 'Другая модель'],
  'Другая марка': ['Другая модель'],
};

export const TRUCK_BRANDS: string[] = ['MAN', 'Mercedes-Benz', 'Volvo', 'Scania', 'Iveco', 'DAF', 'КамАЗ', 'ГАЗ', 'Другая марка'];
export const TRUCK_MODELS: Record<string, string[]> = {
  MAN: ['TGX', 'TGS', 'TGL', 'Другая модель'],
  'Mercedes-Benz': ['Actros', 'Arocs', 'Atego', 'Другая модель'],
  Volvo: ['FH', 'FM', 'FL', 'Другая модель'],
  Scania: ['R-series', 'S-series', 'P-series', 'Другая модель'],
  Iveco: ['Stralis', 'Daily', 'Eurocargo', 'Другая модель'],
  DAF: ['XF', 'CF', 'LF', 'Другая модель'],
  КамАЗ: ['65115', '5490', '6520', 'Другая модель'],
  ГАЗ: ['Газон Next', 'Валдай', 'Другая модель'],
  'Другая марка': ['Другая модель'],
};

export const MOTO_BRANDS: string[] = ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'Harley-Davidson', 'KTM', 'Другая марка'];
export const MOTO_MODELS: Record<string, string[]> = {
  Honda: ['CBR', 'CB', 'Africa Twin', 'Gold Wing', 'Другая модель'],
  Yamaha: ['YZF-R1', 'MT-07', 'MT-09', 'Tenere', 'Другая модель'],
  Kawasaki: ['Ninja', 'Z', 'Versys', 'Другая модель'],
  Suzuki: ['GSX', 'V-Strom', 'SV', 'Другая модель'],
  BMW: ['GS', 'S 1000', 'R nineT', 'Другая модель'],
  Ducati: ['Monster', 'Panigale', 'Multistrada', 'Другая модель'],
  'Harley-Davidson': ['Sportster', 'Softail', 'Touring', 'Другая модель'],
  KTM: ['Duke', 'Adventure', 'Другая модель'],
  'Другая марка': ['Другая модель'],
};

export const BUS_BRANDS: string[] = ['Mercedes-Benz', 'Volkswagen', 'Ford', 'Iveco', 'ГАЗ', 'ПАЗ', 'Другая марка'];
export const BUS_MODELS: Record<string, string[]> = {
  'Mercedes-Benz': ['Sprinter', 'Vito', 'Другая модель'],
  Volkswagen: ['Transporter', 'Crafter', 'Другая модель'],
  Ford: ['Transit', 'Tourneo', 'Другая модель'],
  Iveco: ['Daily', 'Другая модель'],
  ГАЗ: ['Газель', 'Соболь', 'Другая модель'],
  ПАЗ: ['3205', '4234', 'Другая модель'],
  'Другая марка': ['Другая модель'],
};

export const BIKE_BRANDS: string[] = ['Trek', 'Giant', 'Specialized', 'Cannondale', 'Cube', 'Scott', 'Merida', 'Bianchi', 'Другая марка'];
export const BIKE_MODELS: Record<string, string[]> = {
  Trek: ['Marlin', 'Domane', 'Fuel EX', 'Другая модель'],
  Giant: ['Talon', 'Defy', 'Trance', 'Другая модель'],
  Specialized: ['Rockhopper', 'Stumpjumper', 'Allez', 'Другая модель'],
  Cannondale: ['Trail', 'Synapse', 'Habit', 'Другая модель'],
  Cube: ['Aim', 'Reaction', 'Agree', 'Другая модель'],
  Scott: ['Aspect', 'Scale', 'Addict', 'Другая модель'],
  Merida: ['Big Nine', 'Reacto', 'Scultura', 'Другая модель'],
  Bianchi: ['Oltre', 'Infinito', 'Другая модель'],
  'Другая марка': ['Другая модель'],
};

// Fetch brands from API
async function fetchBrands(): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/market/brands`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch brands');
    }
    const data = await response.json();
    const apiBrands = Array.isArray(data)
      ? data
      : data && Array.isArray((data as any).brands)
        ? (data as any).brands
        : [];

    const merged = Array.from(
      new Set(
        [...ALL_BRANDS, ...apiBrands]
          .map((brand) => (typeof brand === 'string' ? brand.trim() : ''))
          .filter(Boolean),
      ),
    );

    return merged.sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.error('Error fetching brands:', error);
    // Return fallback brands if API fails
    return ALL_BRANDS;
  }
}

// Fetch car models for a specific brand
async function fetchModels(brand: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/market/models?brand=${encodeURIComponent(brand)}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }
    const data = await response.json();
    const apiModels = Array.isArray(data) ? data : data?.models || [];
    const fallback = BRANDS_AND_MODELS[brand] || [];

    const merged = Array.from(
      new Set(
        [...fallback, ...apiModels]
          .map((model) => (typeof model === 'string' ? model.trim() : ''))
          .filter(Boolean),
      ),
    );

    return merged;
  } catch (error) {
    console.error('Error fetching models:', error);
    // Return fallback models if API fails
    return BRANDS_AND_MODELS[brand] || [];
  }
}

export const CARS: Car[] = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=600&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1200&auto=format&fit=crop'
    ],
    price: '$42 500',
    title: 'BMW X3 Series 2025',
    brand: 'BMW',
    model: 'X3',
    mileage: '50 000 км',
    fuel: 'Бензин',
    transmission: 'Автомат',
    year: '2025',
    location: 'Адрес',
    seller: 'Ник нэйм из социальной сети',
    sellerAvatar: 'https://i.pravatar.cc/150?u=1',
    time: '15:41',
    views: '1287',
    type: 'Продажа',
    bodyType: 'Кроссовер',
    driveType: 'Полный',
    engineVolume: '3.0',
    seats: '5',
    registrationPlace: 'Германия',
    region: 'Бавария',
    description: 'Полный электропакет, люк, 2 ключа, сигнализация. 2 комплекта резины зима и лето. Новый аккумулятор. Вебасто бензиновая. Машина в хорошем техническом состоянии. Обмен не предлагать.',
    socialNickname: '@alexmorgan13'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=600&auto=format&fit=crop',
    socialNickname: '@buyer.audi',
    price: '$42 500',
    title: '2025 Audi Wallpapers 3 Series 330i',
    mileage: '20 000 км',
    fuel: 'Бензин',
    transmission: 'Автомат',
    year: '2025',
    location: 'Адрес',
    seller: 'Ник нэйм из социальной сети',
    sellerAvatar: 'https://i.pravatar.cc/150?u=2',
    time: '15:41',
    views: '1287',
    type: 'Покупка',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=600&auto=format&fit=crop',
    socialNickname: '@rent.auto.pro',
    price: '$42 500',
    title: '2025 Audi Wallpapers 3 Series 330i',
    mileage: '20 000 км',
    fuel: 'Бензин',
    transmission: 'Автомат',
    year: '2025',
    location: 'Адрес',
    seller: 'Ник нэйм из социальной сети',
    sellerAvatar: 'https://i.pravatar.cc/150?u=3',
    time: '15:41',
    views: '1287',
    type: 'Аренда',
  },
];

export const SERVICES: Service[] = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?q=80&w=600&auto=format&fit=crop',
    title: 'Детейлинг автомобилей',
    seller: 'Ник нэйм',
    sellerAvatar: 'https://i.pravatar.cc/150?u=4',
    rating: 4.7,
    condition: '4/5',
    price: '$60',
    location: 'Адрес',
    description: 'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Itaque, debitis. (описание)',
    time: '15:41',
    views: '1287',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1597404298341-8563e3bc2f62?q=80&w=600&auto=format&fit=crop',
    title: 'Детейлинг автомобилей',
    seller: 'Ник нэйм',
    sellerAvatar: 'https://i.pravatar.cc/150?u=5',
    rating: 4.7,
    condition: '2/5',
    price: '$90',
    location: 'Адрес',
    description: 'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Itaque, debitis. (описание)',
    time: '15:41',
    views: '1287',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=600&auto=format&fit=crop',
    title: 'Детейлинг автомобилей',
    seller: 'Ник нэйм',
    sellerAvatar: 'https://i.pravatar.cc/150?u=6',
    rating: 4.7,
    condition: '5/5',
    price: '$60',
    location: 'Адрес',
    description: 'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Itaque, debitis. (описание)',
    time: '15:41',
    views: '1287',
  },
];

let _brandsPromise: Promise<string[]> | null = null;

export async function getBrands(): Promise<string[]> {
  if (!_brandsPromise) {
    _brandsPromise = fetchBrands();
  }
  return _brandsPromise;
}

let _modelsPromise: Record<string, Promise<string[]>> = {};

export async function getModels(brand: string): Promise<string[]> {
  if (!_modelsPromise[brand]) {
    _modelsPromise[brand] = fetchModels(brand);
  }
  return _modelsPromise[brand];
}
