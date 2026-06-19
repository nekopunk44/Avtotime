import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Gauge, Fuel, Settings2, Calendar, MapPin, MessageCircle, Scale } from 'lucide-react';
import { Car } from '../../types';
import { formatAvtotimeNickname, openAvtotimeProfile } from '../../utils/avtotime';
import { marketAPI } from '../../utils/marketAPI';

interface VehicleListingViewProps {
  car: Car;
  onBack: () => void;
  compareList: {id: number, type: string}[];
  toggleCompare: (id: number, type: string) => void;
}

export const VehicleListingView: React.FC<VehicleListingViewProps> = ({ 
  car, 
  onBack, 
  compareList, 
  toggleCompare 
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = car.images || [car.image, car.image, car.image, car.image];

  const listingType: 'cars' | 'parts' = car.partGroup || car.partCategory ? 'parts' : 'cars';

  useEffect(() => {
    if (!car?.id) return;
    marketAPI.recordListingView(listingType, car.id);
  }, [car?.id, listingType]);

  const handleContactClick = () => {
    if (car?.id) marketAPI.recordListingLead(listingType, car.id);
    openAvtotimeProfile(car.socialNickname);
  };

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  const row1 = [
    { label: 'Тип предложения', value: car.type || 'Продажа' },
    { label: 'Место регистрации', value: car.registrationPlace || 'Германии' },
    { label: 'Регион', value: car.region || 'Бавария' },
  ];

  const row2 = [
    { label: 'Модель', value: car.model || 'X3' },
    { label: 'Марка', value: car.brand || 'BMW' },
    { label: 'Пробег', value: car.mileage || '50 000 км' },
  ];

  const row3 = [
    { label: 'Кузов', value: car.bodyType || 'Кроссовер' },
    { label: 'Привод', value: car.driveType || 'Полный' },
    { label: 'Коробка передач', value: car.transmission || 'Автомат' },
  ];

  const row4 = [
    { label: 'Объем двигателя', value: car.engineVolume || '3.0' },
    { label: 'Количество мест', value: car.seats || '5' },
    { label: 'Место регистрации', value: car.registrationPlace || 'Германия' },
  ];

  return (
    <div className="bg-white min-h-screen pb-4">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="hidden mb-8 flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group"
        >
          <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold uppercase tracking-widest">Назад</span>
        </button>

        {/* Main Listing Block */}
        <div className="border border-gray-200 rounded-[32px] overflow-hidden bg-white shadow-sm mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left: Image Carousel */}
            <div className="relative bg-gray-100 h-full min-h-[480px] overflow-hidden">
              <img 
                src={images[currentImageIndex]} 
                alt={car.title} 
                className="absolute inset-0 w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              
              {/* Carousel Arrows - Centered relative to the image */}
              <button 
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-900 shadow-lg hover:bg-gray-50 transition-all z-20"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-900 shadow-lg hover:bg-gray-50 transition-all z-20"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Thumbnails Overlay */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 z-20">
                {images.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === idx ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Specs and Price */}
            <div className="p-10 flex flex-col bg-white">
              <div className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-end gap-2 sm:gap-6">
                  <div className="min-w-0 text-[40px] font-bold text-gray-900 leading-none break-words">
                    {car.title}
                  </div>
                  <div className="text-[40px] font-bold text-gray-900 leading-none whitespace-nowrap">
                    {car.price}
                  </div>
                </div>
              </div>

              {/* Row 1 & 2 */}
              <div className="space-y-6 mb-6">
                {/* Row 1 */}
                <div className="grid grid-cols-3 gap-6">
                  {row1.map((spec, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                      <span className="text-[15px] font-bold text-gray-900">{spec.label}</span>
                      <div className="bg-black text-white text-[12px] font-bold py-5 px-4 rounded-xl text-center truncate">
                        {spec.value}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Row 2 */}
                <div className="grid grid-cols-3 gap-6">
                  {row2.map((spec, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                      <span className="text-[15px] font-bold text-gray-900">{spec.label}</span>
                      <div className="bg-black text-white text-[12px] font-bold py-4 px-4 rounded-xl text-center truncate">
                        {spec.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-black -mx-10 mb-6"></div>

              {/* Row 3 & 4 */}
              <div className="space-y-6 mb-8">
                {/* Row 3 */}
                <div className="grid grid-cols-3 gap-6">
                  {row3.map((spec, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                      <span className="text-[13px] font-bold text-gray-900">{spec.label}</span>
                      <div className="bg-black text-white text-[12px] font-bold py-3.5 px-4 rounded-xl text-center truncate">
                        {spec.value}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Row 4 */}
                <div className="grid grid-cols-3 gap-6">
                  {row4.map((spec, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                      <span className="text-[13px] font-bold text-gray-900">{spec.label}</span>
                      <div className="bg-black text-white text-[12px] font-bold py-3.5 px-4 rounded-xl text-center truncate">
                        {spec.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compare Button */}
              <button 
                onClick={() => toggleCompare(car.id, 'car')}
                className={`w-full py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                  compareList.some(i => i.id === car.id && i.type === 'car')
                    ? 'bg-red-50 text-red-600 border-2 border-red-600' 
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                <Scale className="w-5 h-5" />
                {compareList.some(i => i.id === car.id && i.type === 'car') ? 'В сравнении' : 'Сравнить'}
              </button>
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-black p-12">
            <p className="text-white text-[15px] leading-relaxed max-w-5xl opacity-90 font-medium">
              {car.description || 'Полный электропакет, люк, 2 ключа, сигнализация. 2 комплекта резины зима и лето. Новый аккумулятор. Вебасто бензиновая. Машина в хорошем техническом состоянии. Обмен не предлагать.'}
            </p>
          </div>

          {car.videoUrl ? (
            <div className="bg-black px-12 pb-12">
              <div className="max-w-5xl">
                <h3 className="text-white/80 text-xs font-bold uppercase tracking-[0.2em] mb-4">
                  Видео объявления
                </h3>
                <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src={car.videoUrl}
                    title="Видео объявления"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Contact Button */}
        <div className="flex flex-col items-center mt-6 mb-6 gap-3">
          {car.sellerBadge === 'pro' && (
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-red-100 text-red-700">Продавец Pro</span>
          )}
          {car.sellerBadge === 'business' && (
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-black text-white">Бизнес-аккаунт</span>
          )}
          <button
            onClick={handleContactClick}
            className="bg-black hover:bg-gray-900 text-white px-16 py-4 rounded-full flex items-center gap-3 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="font-bold text-sm">Написать <span className="text-red-500">{formatAvtotimeNickname(car.socialNickname) || '@alexmorgan13'}</span></span>
          </button>
        </div>

      </div>
    </div>
  );
};
