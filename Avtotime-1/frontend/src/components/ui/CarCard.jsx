import React from 'react';
import {
  FaBalanceScale,
  FaClock,
  FaEye,
  FaMapMarkerAlt,
  FaRegCalendarAlt,
  FaRegHeart,
  FaTachometerAlt,
  FaHeart,
} from 'react-icons/fa';

const CarCard = ({ 
  car, 
  isCompared = false, 
  isFavorite = false,
  onToggleCompare,
  onToggleFavorite,
  imageStyle
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 group">
      <div className="relative h-48 overflow-hidden">
        <img 
          src={car.image} 
          alt={car.title} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          style={imageStyle}
        />
        
        <div className="absolute top-3 right-3 flex gap-2">
          <button 
            onClick={onToggleFavorite}
            className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${
              isFavorite 
                ? 'bg-red-600 text-white shadow-lg' 
                : 'bg-white/90 text-gray-600 hover:text-red-600 hover:bg-white'
            }`}
          >
            {isFavorite ? <FaHeart className="w-4 h-4" /> : <FaRegHeart className="w-4 h-4" />}
          </button>
          <button 
            onClick={onToggleCompare}
            className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${
              isCompared 
                ? 'bg-red-600 text-white shadow-lg' 
                : 'bg-white/90 text-gray-600 hover:text-red-600 hover:bg-white'
            }`}
          >
            <FaBalanceScale className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
          {car.type}
        </div>

        <div className="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          HD Photo
        </div>
      </div>

      <div className="p-5">
        <div className="mb-3">
          <div className="text-2xl font-bold text-gray-900 mb-2">{car.price}</div>
          <h3 className="text-lg font-semibold text-gray-800 line-clamp-2 leading-tight">
            {car.title}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FaTachometerAlt className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">{car.mileage}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FaRegCalendarAlt className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">{car.year}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 col-span-2">
            <FaMapMarkerAlt className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">{car.location}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <span className="bg-gray-100 px-2 py-1 rounded">{car.fuel}</span>
          <span className="bg-gray-100 px-2 py-1 rounded">{car.transmission}</span>
        </div>

        <button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]">
          View Details
        </button>
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <FaClock className="w-3.5 h-3.5" />
          {car.time}
        </div>
        <div className="flex items-center gap-1">
          <FaEye className="w-3.5 h-3.5" />
          {car.views}
        </div>
      </div>
    </div>
  );
};

export default CarCard;
