import React from 'react';
import { Scale, MapPin, Clock, Eye } from 'lucide-react';
import { Service } from '../../types';

interface ServiceCardProps {
  service: Service;
  isCompared?: boolean;
  onToggleCompare?: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  isCompared = false,
  onToggleCompare,
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full group">
    {/* Image Container */}
    <div className="relative aspect-[4/3] overflow-hidden">
      <img
        src={service.image}
        alt={service.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        referrerPolicy="no-referrer"
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleCompare?.();
        }}
        className={`absolute top-3 right-3 p-1.5 rounded-full transition-colors shadow-sm backdrop-blur-sm ${
          isCompared ? 'bg-red-600 text-white' : 'bg-white/90 text-gray-600 hover:text-red-600'
        }`}
      >
        <Scale className="w-4 h-4" />
      </button>
    </div>

    {/* Content */}
    <div className="p-5 flex flex-col flex-grow">
      <h3 className="text-[15px] font-bold italic text-gray-900 mb-4 leading-tight">{service.title}</h3>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={service.sellerAvatar}
            alt={service.seller}
            className="w-7 h-7 rounded-full bg-gray-100 object-cover"
            referrerPolicy="no-referrer"
          />
          <span className="text-xs text-gray-500 font-medium truncate">{service.seller}</span>
        </div>
        <div className="text-gray-900 text-xs font-bold whitespace-nowrap">{service.condition}</div>
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-[11px] text-gray-400">От</span>
        <span className="text-2xl font-bold text-gray-900">${service.price.replace(/[^0-9]/g, '')}</span>
      </div>

      <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-4">
        <MapPin className="w-3 h-3" /> {service.location || 'Адрес'}
      </div>

      <p className="text-[11px] text-gray-400 line-clamp-2 mb-6 leading-relaxed">{service.description}</p>

      <div className="mt-auto">
        <button className="w-full bg-black hover:bg-gray-900 text-white text-xs font-bold py-3 rounded-full transition-all uppercase tracking-wider">
          Смотреть детали
        </button>
      </div>
    </div>

    {/* Footer */}
    <div className="px-5 py-4 flex justify-between items-center text-[11px] text-gray-400 border-t border-gray-50">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> {service.time}
      </div>
      <div className="flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" /> {service.views}
      </div>
    </div>
  </div>
);
