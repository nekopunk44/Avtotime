import React from 'react';
import { X, Mail, Lock, Car, Chrome, Facebook, Instagram, Twitter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-[480px] bg-white rounded-[32px] shadow-2xl overflow-hidden"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-900 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="p-6 lg:p-8 flex flex-col items-center">
            {/* Logo Icon */}
            <div className="mb-2">
              <img 
                src="/logo.png" 
                alt="AVTOTIME" 
                className="h-24 object-contain" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const span = document.createElement('span');
                  span.className = 'font-black text-2xl tracking-tighter italic text-gray-900';
                  span.innerText = 'AVTOTIME';
                  e.currentTarget.parentNode?.appendChild(span);
                }}
              />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Добро пожаловать в AutoMarket</h2>
              <p className="text-gray-500 text-sm font-medium">Пожалуйста, войдите, чтобы добавить объявление</p>
            </div>

            {/* Form */}
            <div className="w-full space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-gray-900 ml-1">Электронная почта</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input 
                    type="email" 
                    placeholder="demo@example.com"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder:text-gray-400 font-medium text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-gray-900 ml-1">Пароль</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input 
                    type="password" 
                    placeholder="••••••••••••"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder:text-gray-400 font-medium text-sm"
                  />
                </div>
              </div>

              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-bold text-[15px] transition-all shadow-lg shadow-red-600/20 hover:shadow-xl active:scale-[0.98] mt-1">
                Войти
              </button>
            </div>

            {/* Divider */}
            <div className="w-full flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-100"></div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Или продолжить с</span>
              <div className="flex-1 h-px bg-gray-100"></div>
            </div>

            {/* Social Logins */}
            <div className="w-full grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2.5 py-2.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-bold text-[13px] text-gray-700">
                <Chrome className="w-4 h-4 text-[#4285F4]" />
                <span>Google</span>
              </button>
              <button className="flex items-center justify-center gap-2.5 py-2.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-bold text-[13px] text-gray-700">
                <Facebook className="w-4 h-4 text-[#1877F2]" />
                <span>Facebook</span>
              </button>
              <button className="flex items-center justify-center gap-2.5 py-2.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-bold text-[13px] text-gray-700">
                <Instagram className="w-4 h-4 text-[#E4405F]" />
                <span>Instagram</span>
              </button>
              <button className="flex items-center justify-center gap-2.5 py-2.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-bold text-[13px] text-gray-700">
                <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                <span>Twitter (X)</span>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm font-medium">
                Нет аккаунта? <button className="text-[#007AFF] font-bold hover:underline">Создайте его</button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
