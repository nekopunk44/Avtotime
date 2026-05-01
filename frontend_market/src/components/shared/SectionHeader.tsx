import React from 'react';
import { Clock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string;
  showViewAll?: boolean;
  showArrows?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  onViewAll?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  showViewAll = true,
  showArrows = false,
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  onViewAll,
}) => (
  <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end mb-6 md:mb-8 gap-3 sm:gap-4 text-center sm:text-left">
    <div className="flex-1 min-w-0 flex flex-col items-center sm:items-start">
      <h2 className="text-2xl md:text-[28px] font-bold text-gray-900 flex items-center gap-3 leading-tight">
        {typeof title === 'string' && title === 'Новые объявления' && (
          <Clock className="w-7 h-7 md:w-8 md:h-8 shrink-0" strokeWidth={2.5} />
        )}
        <span className="truncate sm:whitespace-normal">{title}</span>
      </h2>
      {subtitle && (
        <p className="text-[10px] md:text-[11px] text-gray-500 mt-2 uppercase tracking-[0.05em] font-bold leading-relaxed max-w-[280px] sm:max-w-none">
          {subtitle}
        </p>
      )}
    </div>
    <div className="hidden sm:flex items-center gap-4 md:gap-6">
      {showViewAll && (
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onViewAll?.();
          }}
          className="text-sm font-bold text-gray-800 hover:text-red-600 transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          Посмотреть все <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
        </a>
      )}
      {showArrows && (
        <div className="hidden md:flex items-center gap-2 ml-4">
          <button
            type="button"
            onClick={onPrev}
            disabled={prevDisabled}
            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              nextDisabled ? 'text-gray-400' : 'text-red-600'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  </div>
);
