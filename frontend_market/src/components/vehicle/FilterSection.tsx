import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FilterSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ title, isOpen, onToggle, children }) => (
  <div>
    <button 
      onClick={onToggle}
      className="w-full py-3 flex items-center justify-between text-left group"
    >
      <span className="text-[14px] font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">{title}</span>
      {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
    </button>
    {isOpen && (
      <div className="pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
        {children}
      </div>
    )}
  </div>
);
