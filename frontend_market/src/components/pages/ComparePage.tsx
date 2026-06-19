import React from 'react';
import { Scale, X } from 'lucide-react';
import { Car, Service } from '../../types';
import { CarCard } from '../shared/CarCard';
import { ServiceCard } from '../shared/ServiceCard';

interface ComparePageProps {
  setCurrentPage: (page: string) => void;
  compareList?: {id: number, type: string}[];
  toggleCompare?: (id: number, type: string) => void;
  allCars?: Car[];
  allServices?: Service[];
}

export const ComparePage: React.FC<ComparePageProps> = ({
  setCurrentPage,
  compareList = [],
  toggleCompare,
  allCars = [],
  allServices = [],
}) => {
  if (compareList.length === 0) {
    return (
      <div className="min-h-[60vh] bg-white flex flex-col items-center justify-center px-4 py-24">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Scale className="w-12 h-12 text-gray-700" strokeWidth={1.5} />
        </div>
        
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-4 text-center">
          Нет элементов для сравнения
        </h1>
        
        <p className="text-gray-600 text-center max-w-md mb-8">
          Добавьте элементы для сравнения, нажав кнопку сравнения на любой карточке объявления.
        </p>
        
        <button 
          onClick={() => setCurrentPage('home')}
          className="bg-[#0066ff] hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-colors"
        >
          Смотреть объявления
        </button>
      </div>
    );
  }

  const type = compareList[0].type;

  return (
    <div className="min-h-[60vh] bg-white px-4 sm:px-6 lg:px-8 py-12 max-w-[1536px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Сравнение</h1>
        <button 
          onClick={() => compareList.forEach(item => toggleCompare?.(item.id, item.type))}
          className="text-red-600 hover:text-red-700 font-bold text-[14px] flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Очистить список
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {compareList.map((item) => {
          if (type === 'car') {
            const car = allCars.find(c => c.id === item.id);
            if (!car) return null;
            return (
              <div key={`compare-${item.type}-${item.id}`} className="relative">
                <CarCard 
                  car={car} 
                  isCompared={true} 
                  onToggleCompare={() => toggleCompare?.(car.id, 'car')} 
                />
              </div>
            );
          }
          if (type === 'service') {
            const service = allServices.find(s => s.id === item.id);
            if (!service) return null;
            return (
              <div key={`compare-${item.type}-${item.id}`} className="relative">
                <ServiceCard 
                  service={service} 
                  isCompared={true} 
                  onToggleCompare={() => toggleCompare?.(service.id, 'service')} 
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};
