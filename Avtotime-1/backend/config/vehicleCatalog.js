/**
 * Справочник марок и моделей транспорта. Перенесён из веб-маркета
 * (frontend_market/src/constants/mockData.ts) на сервер, чтобы подсказки в
 * приложении и на сайте брались из одного места, а не заводились по второму
 * разу в каждом клиенте.
 *
 * Записи «Другая марка»/«Другая модель» нужны формам создания объявления, а в
 * подсказках фильтра только мешают — их отсеивает isRealName.
 */

export const ALL_BRANDS = [
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

export const BRANDS_AND_MODELS = {
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

export const TRUCK_BRANDS = ['MAN', 'Mercedes-Benz', 'Volvo', 'Scania', 'Iveco', 'DAF', 'КамАЗ', 'ГАЗ', 'Другая марка'];

export const TRUCK_MODELS = {
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

export const MOTO_BRANDS = ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'Harley-Davidson', 'KTM', 'Другая марка'];

export const MOTO_MODELS = {
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

export const BUS_BRANDS = ['Mercedes-Benz', 'Volkswagen', 'Ford', 'Iveco', 'ГАЗ', 'ПАЗ', 'Другая марка'];

export const BUS_MODELS = {
  'Mercedes-Benz': ['Sprinter', 'Vito', 'Другая модель'],
  Volkswagen: ['Transporter', 'Crafter', 'Другая модель'],
  Ford: ['Transit', 'Tourneo', 'Другая модель'],
  Iveco: ['Daily', 'Другая модель'],
  ГАЗ: ['Газель', 'Соболь', 'Другая модель'],
  ПАЗ: ['3205', '4234', 'Другая модель'],
  'Другая марка': ['Другая модель'],
};

export const BIKE_BRANDS = ['Trek', 'Giant', 'Specialized', 'Cannondale', 'Cube', 'Scott', 'Merida', 'Bianchi', 'Другая марка'];

export const BIKE_MODELS = {
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
/**
 * Полный справочник по видам транспорта — как есть, вместе со служебными
 * «Другая марка»/«Другая модель»: формам создания объявления они нужны, это
 * законный выбор пользователя, а не мусор.
 */
export const vehicleCatalog = () => ({
  cars: { brands: ALL_BRANDS, models: BRANDS_AND_MODELS },
  trucks: { brands: TRUCK_BRANDS, models: TRUCK_MODELS },
  moto: { brands: MOTO_BRANDS, models: MOTO_MODELS },
  buses: { brands: BUS_BRANDS, models: BUS_MODELS },
  bikes: { brands: BIKE_BRANDS, models: BIKE_MODELS },
});

const OTHER = new Set(["Другая марка", "Другая модель"]);
export const isRealName = (value) => Boolean(value) && !OTHER.has(String(value).trim());

const uniqueSorted = (values) =>
  Array.from(new Set(values.map((v) => String(v || "").trim()).filter(isRealName)))
    .sort((a, b) => a.localeCompare(b, "ru"));

/** Все марки справочника: легковые, грузовые, мото, автобусы, велосипеды. */
export const catalogBrands = () =>
  uniqueSorted([...ALL_BRANDS, ...TRUCK_BRANDS, ...MOTO_BRANDS, ...BUS_BRANDS, ...BIKE_BRANDS]);

const MODEL_MAPS = [BRANDS_AND_MODELS, TRUCK_MODELS, MOTO_MODELS, BUS_MODELS, BIKE_MODELS];

/**
 * Модели марки во всех видах транспорта сразу: одна и та же марка бывает и
 * легковой, и грузовой (Mercedes-Benz, Volvo, ГАЗ). Без марки — все модели
 * справочника.
 */
export const catalogModels = (brand) => {
  const wanted = String(brand || "").trim().toLowerCase();
  const collected = [];
  MODEL_MAPS.forEach((map) => {
    Object.entries(map).forEach(([name, models]) => {
      if (!wanted || name.trim().toLowerCase() === wanted) collected.push(...models);
    });
  });
  return uniqueSorted(collected);
};
