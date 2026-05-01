import React from 'react';
import { Scale, Gauge, Fuel, Settings2, Calendar, MapPin, Clock, Eye } from 'lucide-react';
import { Car } from '../../types';

interface CarCardProps {
  car: Car;
  isCompared: boolean;
  onToggleCompare: () => void;
  onClick?: () => void;
}

export const CarCard: React.FC<CarCardProps> = ({ car, isCompared, onToggleCompare, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col cursor-pointer"
  >
    {/* Image Container */}
    <div className="relative h-56">
      <img src={car.image} alt={car.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
        {car.type}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleCompare();
        }}
        className={`absolute top-3 right-3 p-2 rounded-full transition-colors shadow-sm backdrop-blur-sm ${
          isCompared ? 'bg-red-600 text-white' : 'bg-white/90 text-gray-600 hover:text-red-600'
        }`}
      >
        <Scale className="w-4 h-4" />
      </button>
    </div>

    {/* Content */}
    <div className="p-5 flex flex-col flex-grow">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h3 className="text-xl font-bold text-gray-900 truncate">{car.title}</h3>
        <div className="text-xl font-bold text-gray-900 whitespace-nowrap">{car.price}</div>
      </div>

      {/* Specs Grid */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-gray-400" /> {car.mileage}
        </div>
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-gray-400" /> {car.fuel}
        </div>
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-400" /> {car.transmission}
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" /> {car.year}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <MapPin className="w-4 h-4 text-gray-400" /> {car.location}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <img
          src={car.sellerAvatar}
          alt={car.seller}
          className="w-8 h-8 rounded-full bg-gray-100"
          referrerPolicy="no-referrer"
        />
        <span className="text-sm text-gray-600 truncate">{car.seller}</span>
        {car.sellerBadge === 'pro' && (
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">Pro</span>
        )}
        {car.sellerBadge === 'business' && (
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black text-white">Business</span>
        )}
      </div>

      <div className="mt-auto">
        <button className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-3 rounded-full transition-all uppercase tracking-wider">
          Смотреть детали
        </button>
      </div>
    </div>

    {/* Footer */}
    <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
      <div className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" /> {car.time}
      </div>
      <div className="flex items-center gap-1">
        <Eye className="w-3.5 h-3.5" /> {car.views}
      </div>
    </div>
  </div>
);
