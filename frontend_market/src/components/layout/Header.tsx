import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronRight, ChevronLeft, Menu, X, ChevronDown, Gamepad2, Palette, Puzzle, Sparkles, Tv, Bell, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LoginModal } from '../auth/LoginModal';
import { useVehicleCatalog } from '../../constants/vehicleCatalog';
import { PARTS_CATEGORIES } from '../../constants/partsCategories';
import type { AppNotification } from '../../types';

interface HeaderProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  onLogoClick?: (origin?: { left: number; top: number; width: number; height: number }) => void;
  setSelectedVehicleType: (type: string) => void;
  selectedVehicleType?: string;
  compareCount: number;
  notifications?: AppNotification[];
  unreadNotificationsCount?: number;
  onNotificationRead?: (notificationId: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onNotificationsMenuOpen?: () => void;
  userData?: {
    _id?: string;
    userName?: string;
    name?: string;
    profileImage?: string;
    isEmailVerified?: boolean;
    email?: string;
  } | null;
  onResendVerification?: () => void;
  onOpenFeed?: () => void;
  onOpenReels?: () => void;
  onOpenProfile?: () => void;
  onOpenTariffs?: () => void;
  onSignOut?: () => void | Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSignIn?: (userData: any) => void;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onOpenKidsTab?: (tab: string) => void;
}

const INITIAL_UNREAD_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Новое сообщение по вашему объявлению',
    description: 'Пользователь уточнил цену и условия сделки.',
    time: '2 мин назад',
  },
  {
    id: 2,
    title: 'Новый отклик на услугу',
    description: 'Вашим предложением заинтересовался новый клиент.',
    time: '15 мин назад',
  },
  {
    id: 3,
    title: 'Напоминание о непрочитанном чате',
    description: 'У вас есть сообщение, которое еще ждет ответа.',
    time: '1 ч назад',
  },
];

const splitIntoColumns = <T,>(items: T[], columnsCount: number): T[][] => {
  if (items.length === 0) {
    return [];
  }

  const itemsPerColumn = Math.ceil(items.length / columnsCount);

  return Array.from({ length: columnsCount }, (_, index) =>
    items.slice(index * itemsPerColumn, (index + 1) * itemsPerColumn)
  ).filter((column) => column.length > 0);
};

const formatRelativeTime = (iso?: string) => {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  const seconds = Math.max(0, Math.floor(diff / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  return `${days} д назад`;
};

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  setCurrentPage,
  onLogoClick,
  setSelectedVehicleType,
  selectedVehicleType,
  compareCount,
  notifications = [],
  unreadNotificationsCount,
  onNotificationRead,
  onMarkAllNotificationsRead,
  onNotificationsMenuOpen,
  userData,
  onOpenFeed,
  onOpenReels,
  onOpenProfile,
  onOpenTariffs,
  onSignOut,
  onSignIn,
  isAdmin = false,
  onOpenAdmin,
  onResendVerification,
  onOpenKidsTab,
}) => {
  const catalog = useVehicleCatalog();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAutoDropdownOpen, setIsAutoDropdownOpen] = useState(false);
  const [isPartsMenuOpen, setIsPartsMenuOpen] = useState(false);
  const [isKidsDropdownOpen, setIsKidsDropdownOpen] = useState(false);
  const [isGamesDropdownOpen, setIsGamesDropdownOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileAccountMenuOpen, setIsMobileAccountMenuOpen] = useState(false);
  const [verifSent, setVerifSent] = useState(false);
  const [verifLoading, setVerifLoading] = useState(false);
  const [partsMenuStep, setPartsMenuStep] = useState(0); // 0: brands, 1: models, 2: categories
  const [selectedPartsBrand, setSelectedPartsBrand] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const partsMenuRef = useRef<HTMLDivElement>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAutoDropdownOpen(false);
      }
      if (partsMenuRef.current && !partsMenuRef.current.contains(event.target as Node) && 
          megaMenuRef.current && !megaMenuRef.current.contains(event.target as Node)) {
        setIsPartsMenuOpen(false);
      }
      // Close kids and games dropdowns
      if (!(event.target as HTMLElement).closest('.kids-dropdown-trigger')) {
        setIsKidsDropdownOpen(false);
      }
      if (!(event.target as HTMLElement).closest('.games-dropdown-trigger')) {
        setIsGamesDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      setIsUserMenuOpen(false);
      setIsNotificationsOpen(false);
      setIsMobileAccountMenuOpen(false);
    } else {
      document.body.style.overflow = 'unset';
      setIsMobileAccountMenuOpen(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const headerElement = headerRef.current;

    if (!headerElement || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const updateHeaderHeight = () => {
      root.style.setProperty('--market-header-height', `${headerElement.offsetHeight}px`);
    };

    updateHeaderHeight();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeaderHeight) : null;

    resizeObserver?.observe(headerElement);
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  const handleVehicleTypeClick = (type: string) => {
    setSelectedVehicleType(type);
    setCurrentPage('vehicle-details');
    setIsAutoDropdownOpen(false);
  };

  const handleProfileClick = () => {
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsMobileMenuOpen(false);
    onOpenProfile?.();
  };

  const handleSettingsClick = () => {
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsMobileMenuOpen(false);
    onOpenTariffs?.();
  };

  const handleSignOutClick = async () => {
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsMobileMenuOpen(false);
    await onSignOut?.();
  };

  const handleNotificationClick = (notificationId: string) => {
    onNotificationRead?.(notificationId);
    setIsNotificationsOpen(false);
  };

  const partsBrandColumns = splitIntoColumns(catalog.cars.brands, 7);
  const selectedPartsModels = selectedPartsBrand ? catalog.cars.models[selectedPartsBrand] ?? [] : [];
  const partsModelColumns = splitIntoColumns(selectedPartsModels, 6);
  const emailVerifPending = userData?.isEmailVerified === false ? 1 : 0;
  const unreadCount = (typeof unreadNotificationsCount === 'number' ? unreadNotificationsCount : notifications.length) + emailVerifPending;

  const renderUserAvatar = (sizeClasses: string) => {
    if (userData?.profileImage) {
      return (
        <img
          src={userData.profileImage}
          alt={userData.userName || '\u041f\u0440\u043e\u0444\u0438\u043b\u044c'}
          className={`${sizeClasses} rounded-full object-cover`}
        />
      );
    }

    return (
      <div className={`${sizeClasses} rounded-full bg-gradient-to-br from-[#7B61FF] via-[#E9546B] to-[#FFB457] text-white flex items-center justify-center font-black uppercase`}>
        {userData?.userName?.[0] || userData?.name?.[0] || 'U'}
      </div>
    );
  };

  const renderUserMenu = () => (
    <AnimatePresence>
      {isUserMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="absolute right-0 top-full mt-3 w-[190px] overflow-hidden rounded-[24px] bg-black text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] z-[90]"
        >
          <button
            onClick={handleProfileClick}
            className="w-full px-5 py-5 text-center text-[13px] font-medium hover:bg-white/5 transition-colors"
          >
            {'\u041c\u043e\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430'}</button>
          <div className="h-px bg-white/70" />
          {isAdmin ? (
            <>
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  if (onOpenAdmin) {
                    onOpenAdmin();
                  } else {
                    setCurrentPage('admin');
                  }
                }}
                className="w-full px-5 py-5 text-center text-[13px] font-medium hover:bg-white/5 transition-colors"
              >
                {'\u0410\u0434\u043c\u0438\u043d\u043a\u0430'}
              </button>
              <div className="h-px bg-white/70" />
            </>
          ) : null}
          <button
            onClick={handleSettingsClick}
            className="w-full px-5 py-5 text-center text-[13px] font-medium hover:bg-white/5 transition-colors"
          >
            {'\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438'}</button>
          <div className="h-px bg-white/70" />
          <button
            onClick={handleSignOutClick}
            className="w-full px-5 py-5 text-center text-[13px] font-medium text-[#FF6250] hover:bg-white/5 transition-colors"
          >
            {'\u0412\u044b\u0445\u043e\u0434 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430'}</button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderNotificationsMenu = () => (
    <AnimatePresence>
      {isNotificationsOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="absolute right-0 top-full mt-3 w-[320px] overflow-hidden rounded-[24px] bg-white border border-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.18)] z-[90]"
        >
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-bold text-gray-900">Непрочитанные уведомления</div>
                <div className="text-[12px] text-gray-500 mt-1">Показаны все новые сообщения</div>
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAllNotificationsRead?.();
                    setIsNotificationsOpen(false);
                  }}
                  className="text-[12px] font-bold text-gray-500 hover:text-gray-800 transition-colors whitespace-nowrap"
                >
                  Прочитать все
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {userData && userData.isEmailVerified === false && (
              <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
                <div className="flex items-start gap-3">
                  <Mail className="w-[18px] h-[18px] text-amber-700 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-amber-900">Подтвердите email</div>
                    <div className="text-[12px] text-amber-700 mt-0.5 leading-4">
                      Письмо отправлено на <span className="font-semibold">{userData.email}</span>. Подтвердите адрес, чтобы создавать объявления и посты.
                    </div>
                    <div className="mt-2">
                      {verifSent ? (
                        <span className="text-[12px] text-green-700 font-semibold">Письмо отправлено!</span>
                      ) : (
                        <button
                          type="button"
                          disabled={verifLoading}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setVerifLoading(true);
                            try { await onResendVerification?.(); setVerifSent(true); } finally { setVerifLoading(false); }
                          }}
                          className="text-[12px] text-amber-800 font-semibold underline hover:text-amber-900 disabled:opacity-50"
                        >
                          {verifLoading ? 'Отправка...' : 'Отправить повторно'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <button
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification._id)}
                  className="w-full text-left px-5 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-gray-900">
                        {notification.title || 'Новое уведомление'}
                      </div>
                      {notification.description && (
                        <div className="text-[12px] text-gray-500 mt-1 leading-5">{notification.description}</div>
                      )}
                      <div className="text-[11px] text-gray-400 mt-2">{formatRelativeTime(notification.createdAt)}</div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-5 py-8 text-center">
                <div className="text-[13px] font-semibold text-gray-900">Новых уведомлений нет</div>
                <div className="text-[12px] text-gray-500 mt-2">Все сообщения уже прочитаны.</div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <header ref={headerRef} className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Top Bar */}
        <div className="flex justify-between items-center py-1 lg:py-2 gap-3 lg:gap-8">
          
          {/* Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (onLogoClick) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onLogoClick({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
                return;
              }
              if (onOpenFeed) {
                onOpenFeed();
                return;
              }
              setCurrentPage('home');
            }}
            className="flex-shrink-0 flex items-center transition-transform duration-200 hover:scale-105"
          >
            <img 
              src="/logo.png" 
              alt="AVTOTIME" 
              className="h-14 lg:h-[72px] object-contain" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const span = document.createElement('span');
                span.className = 'font-black text-3xl lg:text-4xl tracking-tighter italic text-gray-900';
                span.innerText = 'AVTOTIME';
                e.currentTarget.parentNode?.appendChild(span);
              }}
            />
          </a>

          {/* Search (Mobile & Desktop) */}
          <div className="relative flex-1 w-full max-w-none lg:max-w-[800px]">
            <input
              type="text"
              placeholder="Молдова, Кишинев"
              className="w-full pl-4 lg:pl-5 pr-10 lg:pr-12 py-1 lg:py-1.5 text-[13px] lg:text-[14px] border border-black rounded-full focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 placeholder-gray-500 bg-gray-50 lg:bg-white transition-colors"
            />
            <Search className="absolute right-3 lg:right-4 top-1/2 -translate-y-1/2 text-gray-500 lg:text-gray-600 w-4 h-4 lg:w-5 lg:h-5" strokeWidth={2} />
          </div>

          {/* Top Links (Desktop) */}
          <div className="hidden lg:flex items-center justify-end gap-10 xl:gap-14 text-[13px] text-black font-medium">
            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentPage('kids'); }} className="hover:text-red-600 transition-colors whitespace-nowrap">Для детей</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onOpenFeed?.(); }} className="hover:text-red-600 transition-colors whitespace-nowrap">Лента</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentPage('driving-courses'); }} className="hover:text-red-600 transition-colors whitespace-nowrap">Авто-курсы</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentPage('eco-tips'); }} className="hover:text-red-600 transition-colors whitespace-nowrap">Советы по экологии</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentPage('help-others'); }} className="hover:text-red-600 transition-colors whitespace-nowrap">Помощь другим</a>
            {userData ? (
              <div className="flex items-center gap-3">
                <div className="relative" ref={notificationsRef}>
                  <button
                    onClick={() => {
                      setIsNotificationsOpen((prev) => {
                        const next = !prev;
                        if (next) onNotificationsMenuOpen?.();
                        return next;
                      });
                      setIsUserMenuOpen(false);
                      setIsMobileMenuOpen(false);
                    }}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition-all hover:-translate-y-0.5 hover:border-red-200 hover:text-red-600"
                    aria-label="Уведомления"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {renderNotificationsMenu()}
                </div>

                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen((prev) => !prev);
                      setIsNotificationsOpen(false);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-full transition-transform hover:-translate-y-0.5"
                  >
                    {renderUserAvatar('w-11 h-11')}
                  </button>
                  {renderUserMenu()}
                </div>
              </div>
            ) : (
              <a href="#" onClick={(e) => { e.preventDefault(); setIsLoginModalOpen(true); }} className="hover:text-red-600 transition-colors whitespace-nowrap">Войти</a>
            )}
          </div>
          
          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden p-1.5 -mr-1.5 text-gray-900 hover:text-red-600 focus:outline-none flex-shrink-0"
            onClick={() => {
              setIsMobileMenuOpen((prev) => !prev);
              setIsUserMenuOpen(false);
              setIsNotificationsOpen(false);
              setIsAutoDropdownOpen(false);
              setIsPartsMenuOpen(false);
              setIsKidsDropdownOpen(false);
              setIsGamesDropdownOpen(false);
              setIsMobileAccountMenuOpen(false);
            }}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="lg:hidden fixed top-0 right-0 h-full w-[300px] bg-[#111] text-white z-50 flex flex-col overflow-y-auto"
              >
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
                  <span className="text-[17px] font-bold">Меню</span>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-4 py-4 border-b border-white/10">
                  {userData ? (
                    <div className="flex items-center gap-3">
                      {renderUserAvatar('w-12 h-12')}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px] truncate">{userData.userName || userData.name}</div>
                        {userData.name && <div className="text-[12px] text-white/50 truncate">{userData.name}</div>}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setIsLoginModalOpen(true); setIsMobileMenuOpen(false); }} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-[14px] py-3 rounded-2xl transition-colors">
                      Войти в аккаунт
                    </button>
                  )}
                </div>

                <div className="flex flex-col px-3 py-3 gap-1 flex-1">
                  {[
                    { label: 'Детям',              icon: <Gamepad2 className="w-5 h-5" />,   action: () => setCurrentPage('kids') },
                    { label: 'Лента',              icon: <Bell className="w-5 h-5" />,        action: () => onOpenFeed?.() },
                    { label: 'Авто-курсы',         icon: <Tv className="w-5 h-5" />,          action: () => setCurrentPage('driving-courses') },
                    { label: 'Советы по экологии', icon: <Sparkles className="w-5 h-5" />,    action: () => setCurrentPage('eco-tips') },
                    { label: 'Помощь другим',      icon: <Mail className="w-5 h-5" />,        action: () => setCurrentPage('help-others') },
                    { label: 'Игры',               icon: <Puzzle className="w-5 h-5" />,      action: () => setCurrentPage('kids') },
                  ].map((item) => (
                    <a
                      key={item.label}
                      href="#"
                      onClick={(e) => { e.preventDefault(); item.action(); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/8 transition-colors"
                    >
                      <span className="w-8 flex justify-center text-white/60">{item.icon}</span>
                      <span className="text-[15px] font-semibold">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-white/30 ml-auto" />
                    </a>
                  ))}
                </div>

                {userData && (
                  <div className="px-3 pb-6 flex flex-col gap-1 border-t border-white/10 pt-3">
                    <button onClick={() => { handleProfileClick(); setIsMobileMenuOpen(false); }} className="flex items-center px-4 py-3 rounded-2xl hover:bg-white/8 transition-colors text-[14px] font-medium text-left w-full">
                      Моя страница
                    </button>
                    <button onClick={() => { handleSettingsClick(); setIsMobileMenuOpen(false); }} className="flex items-center px-4 py-3 rounded-2xl hover:bg-white/8 transition-colors text-[14px] font-medium text-left w-full">
                      Настройки
                    </button>
                    <button onClick={() => { handleSignOutClick(); setIsMobileMenuOpen(false); }} className="flex items-center px-4 py-3 rounded-2xl hover:bg-white/8 transition-colors text-[14px] font-medium text-left text-red-400 w-full">
                      Выйти из аккаунта
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>


        {/* Main Nav (Desktop & Mobile Horizontal Scroll) */}
        <nav className={`flex items-center justify-between gap-6 lg:gap-0 w-full pt-1 pb-1 lg:pt-0 lg:pb-0 min-h-[40px] scrollbar-hide relative ${(isAutoDropdownOpen || isPartsMenuOpen) ? 'overflow-visible' : 'overflow-x-auto lg:overflow-visible'}`}>
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsAutoDropdownOpen(!isAutoDropdownOpen)}
              className={`text-[14px] lg:text-[15px] font-bold transition-all whitespace-nowrap px-6 py-1 rounded-full flex items-center gap-1 ${isAutoDropdownOpen || (currentPage === 'vehicle-details' && selectedVehicleType !== 'Автозапчасти') ? 'bg-black text-white' : 'text-black hover:text-red-600'}`}
            >
              АВТО
            </button>
            
            {/* Dropdown Menu */}
            <AnimatePresence>
              {isAutoDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute top-full left-0 mt-1 w-[280px] bg-black text-white rounded-2xl p-1 shadow-2xl z-[60]"
                >
                  <div className="flex flex-col gap-0.5">
                    {[
                      { label: 'Легковые автомобили', src: '/auto/transport.png', size: 'w-8 h-8' },
                      { label: 'Перевозки',           src: '/auto/truck.png',      size: 'w-6 h-6' },
                      { label: 'Прицепы',             src: '/auto/semi-trailer.png', size: 'w-6 h-6' },
                      { label: 'Мото',                src: '/auto/motobike.png',   size: 'w-6 h-6' },
                      { label: 'Грузовые автомобили', src: '/auto/truk2.png',      size: 'w-6 h-6' },
                      { label: 'Велосипеды',          src: '/auto/bycle.png',      size: 'w-6 h-6' },
                      { label: 'Микроавтобусы',       src: '/bus.png',             size: 'w-6 h-6' },
                    ].map((item, i) => (
                      <motion.a
                        key={item.label}
                        href="#"
                        onClick={(e) => { e.preventDefault(); handleVehicleTypeClick(item.label); }}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors group"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: i * 0.04, ease: 'easeOut' }}
                      >
                        <div className="w-10 flex justify-center">
                          <img src={item.src} alt={item.label} className={`${item.size} object-contain opacity-70 group-hover:opacity-100`} style={{ filter: 'brightness(0) invert(1)' }} referrerPolicy="no-referrer" />
                        </div>
                        <span className="text-[15px] font-semibold">{item.label}</span>
                      </motion.a>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage('car-services');
            }}
            className={`text-[14px] lg:text-[15px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
              !isAutoDropdownOpen && currentPage === 'car-services'
                ? 'bg-black text-white px-6 py-1 rounded-full'
                : 'text-black hover:text-red-600 px-2 lg:px-0'
            }`}
          >
            АВТОСЕРВИС
          </button>

          {['КОНСУЛЬТАЦИИ', 'ХИМЧИСТКА'].map((item) => (
            <a
              key={item}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (item === 'КОНСУЛЬТАЦИИ') setCurrentPage('consultations');
                if (item === 'ХИМЧИСТКА') setCurrentPage('dry-cleaning');
              }}
              className={`text-[14px] lg:text-[15px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                !isAutoDropdownOpen && item === 'КОНСУЛЬТАЦИИ' && currentPage === 'consultations'
                  ? 'bg-black text-white px-6 py-1 rounded-full'
                  : !isAutoDropdownOpen && item === 'ХИМЧИСТКА' && currentPage === 'dry-cleaning'
                    ? 'bg-black text-white px-6 py-1 rounded-full'
                    : 'text-black hover:text-red-600 px-2 lg:px-0'
              }`}
            >
              {item}
            </a>
          ))}

          <div className="relative" ref={partsMenuRef}>
            <button
              onClick={(e) => {
                e.preventDefault();
                setSelectedVehicleType('Автозапчасти');
                setCurrentPage('vehicle-details');
                setIsPartsMenuOpen(false);
              }}
              className={`text-[14px] lg:text-[15px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                !isAutoDropdownOpen && (isPartsMenuOpen || (currentPage === 'vehicle-details' && selectedVehicleType === 'Автозапчасти'))
                  ? 'bg-black text-white px-6 py-1 rounded-full'
                  : 'text-black hover:text-red-600 px-2 lg:px-0'
              }`}
            >
              АВТОЗАПЧАСТИ
            </button>
          </div>

          {['АВТОТЮНИНГ', 'REELS'].map((item) => (
            <a
              key={item}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (item === 'АВТОТЮНИНГ') {
                  setCurrentPage('auto-tuning');
                }
                if (item === 'REELS') {
                  onOpenReels?.();
                }
              }}
              className={`text-[14px] lg:text-[15px] font-bold transition-all whitespace-nowrap ${
                !isAutoDropdownOpen && item === 'АВТОТЮНИНГ' && currentPage === 'auto-tuning'
                  ? 'bg-black text-white px-6 py-1 rounded-full'
                  : 'text-black hover:text-red-600 px-2 lg:px-0 first:pl-0'
              }`}
            >
              {item}
            </a>
          ))}

          <div className="relative games-dropdown-trigger">
            <button 
              onClick={() => setIsGamesDropdownOpen(!isGamesDropdownOpen)}
              className={`text-[14px] lg:text-[15px] font-bold transition-all whitespace-nowrap px-2 lg:px-0 flex items-center gap-1 ${isGamesDropdownOpen ? 'text-red-600' : 'text-black hover:text-red-600'}`}
            >
              ИГРЫ
              <ChevronDown className={`w-4 h-4 transition-transform ${isGamesDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isGamesDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2"
                >
                  {[
                    { name: 'Раскраски', tab: 'Раскраски', icon: Palette },
                    { name: 'Головоломки', tab: 'Головоломки', icon: Puzzle },
                    { name: 'Игры', tab: 'Игры', icon: Gamepad2 },
                    { name: 'Классика', tab: 'Классика', icon: Sparkles },
                  ].map((item) => (
                    <button
                      key={item.name}
                      onClick={() => {
                        setIsGamesDropdownOpen(false);
                        onOpenKidsTab?.(item.tab);
                      }}
                      className="w-full text-left px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors flex items-center gap-3"
                    >
                      <item.icon className="w-4 h-4 text-gray-400" />
                      {item.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage('compare');
            }}
            className={`relative text-[14px] lg:text-[15px] font-bold transition-colors whitespace-nowrap inline-flex items-center px-2 lg:px-0 ${
              currentPage === 'compare' ? 'text-red-600' : 'text-black hover:text-red-600'
            }`}
          >
            СРАВНИТЬ
            {compareCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full leading-none z-10 border border-white">{compareCount}</span>
            )}
          </a>
        </nav>

        {/* Mega Menu */}
        <AnimatePresence>
          {isPartsMenuOpen && (
            <motion.div 
              ref={megaMenuRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full mt-0 bg-black text-white z-[100] rounded-[24px] overflow-hidden min-h-[450px] lg:min-h-[500px]"
              style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)' }}
            >
              <div className="relative w-full h-full min-h-[450px] lg:min-h-[500px]">
                {/* Global Navigation Arrows */}
                {partsMenuStep > 0 && (
                  <button 
                    onClick={() => setPartsMenuStep(partsMenuStep - 1)}
                    className="absolute left-2 sm:left-4 lg:left-4 top-1/2 -translate-y-1/2 p-2 text-white hover:text-white/70 transition-colors z-[110] focus:outline-none"
                  >
                    <ChevronLeft className="w-8 h-8 lg:w-12 lg:h-12" strokeWidth={1} />
                  </button>
                )}
                {partsMenuStep === 1 && selectedPartsModels.length > 0 && (
                  <button 
                    onClick={() => setPartsMenuStep(partsMenuStep + 1)}
                    className="absolute right-2 sm:right-4 lg:right-4 top-1/2 -translate-y-1/2 p-2 text-white hover:text-white/70 transition-colors z-[110] focus:outline-none"
                  >
                    <ChevronRight className="w-8 h-8 lg:w-12 lg:h-12" strokeWidth={1} />
                  </button>
                )}

                <div className="w-full">
                  <AnimatePresence mode="wait">
                    {/* Step 0: Brands */}
                    {partsMenuStep === 0 && (
                      <motion.div 
                        key="brands"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="w-full pl-8 lg:pl-12 pr-16 lg:pr-24 pt-16 lg:pt-20 pb-0"
                      >
                        <div className="grid grid-cols-7 w-full gap-x-14 lg:gap-x-32">
                          {partsBrandColumns.map((column, colIdx) => (
                            <div key={colIdx} className="flex flex-col min-w-0 items-start">
                              {column.map((brand) => (
                                <button 
                                  key={brand} 
                                  onClick={() => {
                                    setSelectedPartsBrand(brand);
                                    setPartsMenuStep(1);
                                  }}
                                  className={`block w-full text-left transition-colors text-[14px] lg:text-[15px] font-normal mb-[14px] cursor-pointer whitespace-nowrap leading-[1.3] ${
                                    selectedPartsBrand === brand ? 'text-white' : 'text-white hover:text-white/80'
                                  }`}
                                >
                                  {brand}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                  {/* Step 1: Models */}
                  {partsMenuStep === 1 && (
                    <motion.div 
                      key="models"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="w-full pl-24 lg:pl-40 pr-20 lg:pr-32 pt-16 lg:pt-20 pb-0"
                    >
                      {selectedPartsBrand && (
                        <div className="mb-8 text-white/70 text-[14px] lg:text-[16px]">
                          Модели для <span className="text-white font-semibold">{selectedPartsBrand}</span>
                        </div>
                      )}

                      {selectedPartsModels.length > 0 ? (
                        <div className="grid grid-cols-6 w-full gap-x-16 lg:gap-x-40">
                          {partsModelColumns.map((column, colIdx) => (
                            <div key={colIdx} className="flex flex-col min-w-0 items-start">
                              {column.map((model) => (
                                <button 
                                  key={model} 
                                  onClick={() => setPartsMenuStep(2)}
                                  className="block w-full text-left text-white hover:text-white/80 transition-colors text-[14px] lg:text-[15px] font-normal mb-[14px] cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis leading-[1.3]"
                                >
                                  {model}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="max-w-[420px] rounded-[24px] border border-white/10 bg-white/5 px-6 py-5 text-white/80">
                          <div className="text-[18px] font-semibold text-white">Модели не найдены</div>
                          <div className="mt-2 text-[14px] leading-6">
                            {selectedPartsBrand
                              ? `Для марки ${selectedPartsBrand} список моделей пока не добавлен.`
                              : 'Сначала выберите автомобиль на предыдущем экране.'}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Step 2: Categories */}
                  {partsMenuStep === 2 && (
                    <motion.div 
                      key="categories"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="w-full pl-12 lg:pl-20 pr-16 lg:pr-24 py-4 md:py-6 lg:py-10"
                    >
                      <div className="grid grid-cols-6 w-full gap-x-4 lg:gap-x-6 gap-y-4 md:gap-y-6 lg:gap-y-12">
                        {/*
                          { title: 'Запчасти для ТО', items: ['Масляные фильтры', 'Воздушные фильтры', 'Р СћР С•РЎР‚Р СР С•Р В·Р Р…РЎвЂ№Р Вµ Р С”Р С•Р В»Р С•Р Т‘Р С”Р С‘', 'Р С’Р Р†РЎвЂљР С•Р В»Р В°Р СР С—РЎвЂ№', 'Свечи зажигания'] },
                          { title: 'Автосвет', items: ['Фары', 'Р СџР С•Р Т‘РЎРѓР Р†Р ВµРЎвЂљР С”Р В° Р Т‘Р В»РЎРЏ Р В°Р Р†РЎвЂљР С•Р СР С•Р В±Р С‘Р В»РЎРЏ', 'Р СџРЎР‚Р С•Р В±Р В»Р ВµРЎРѓР С”Р С•Р Р†РЎвЂ№Р Вµ Р СР В°РЎРЏР С”Р С‘', 'Р С’Р Р†РЎвЂљР С•Р СР С•Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№Р Вµ Р С—РЎР‚Р С•Р В¶Р ВµР С”РЎвЂљР С•РЎР‚РЎвЂ№', 'Р С™Р С•Р СР С—Р В»Р ВµР С”РЎвЂљРЎС“РЎР‹РЎвЂ°Р С‘Р Вµ Р Т‘Р В»РЎРЏ РЎвЂћР В°РЎР‚'] },
                          { title: 'Р СћР С•РЎР‚Р СР С•Р В·Р Р…Р В°РЎРЏ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СР В°', items: ['Р СћР С•РЎР‚Р СР С•Р В·Р Р…РЎвЂ№Р Вµ Р Т‘Р С‘РЎРѓР С”Р С‘', 'Р СћР С•РЎР‚Р СР С•Р В·Р Р…РЎвЂ№Р Вµ РЎРѓРЎС“Р С—Р С—Р С•РЎР‚РЎвЂљРЎвЂ№', 'Р СћР С•РЎР‚Р СР С•Р В·Р Р…РЎвЂ№Р Вµ РЎвЂљРЎР‚РЎС“Р В±Р С”Р С‘ Р С‘ РЎв‚¬Р В»Р В°Р Р…Р С–Р С‘', 'Р СћР С•РЎР‚Р СР С•Р В·Р Р…РЎвЂ№Р Вµ РЎвЂ Р С‘Р В»Р С‘Р Р…Р Т‘РЎР‚РЎвЂ№', 'Р СћР С•РЎР‚Р СР С•Р В·Р Р…РЎвЂ№Р Вµ Р В±Р В°РЎР‚Р В°Р В±Р В°Р Р…РЎвЂ№'] },
                          { title: 'Р РЋР С‘РЎРѓРЎвЂљР ВµР СР В° Р Р†РЎвЂ№Р С—РЎС“РЎРѓР С”Р В°', items: ['Выхлопные трубы', 'Глушители', 'Р СџР В»Р В°Р СР ВµР С–Р В°РЎРѓР С‘РЎвЂљР ВµР В»Р С‘', 'Клапаны EGR', 'Р С™Р С•Р СР С—Р В»Р ВµР С”РЎвЂљР С•РЎР‚РЎвЂ№ Р Р†РЎвЂ№Р С—РЎС“РЎРѓР С”Р Р…РЎвЂ№Р Вµ'] },
                          { title: 'Р РЋР С‘РЎРѓРЎвЂљР ВµР СР В° Р В·Р В°Р В¶Р С‘Р С–Р В°Р Р…Р С‘РЎРЏ', items: ['Р вЂ”Р В°Р СР С”Р С‘ Р В·Р В°Р В¶Р С‘Р С–Р В°Р Р…Р С‘РЎРЏ', 'Провода высоковольтные', 'Катушки зажигания', 'Свечи накаливания', 'Свечи зажигания'] },
                          { title: 'Кузовные запчасти', items: ['Р вЂР В°Р СР С—Р ВµРЎР‚РЎвЂ№', 'Р вЂќР Р†Р ВµРЎР‚Р С‘ Р В°Р Р†РЎвЂљР С•Р СР С•Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№Р Вµ', 'Р С™Р В°Р С—Р С•РЎвЂљ Р В°Р Р†РЎвЂљР С•Р СР С•Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№Р в„–', 'Детали багажника', 'Р вЂР С•Р С”Р С•Р Р†РЎвЂ№Р Вµ Р В·Р ВµРЎР‚Р С”Р В°Р В»Р В°'] },
                          { title: 'Р СћР С•Р С—Р В»Р С‘Р Р†Р Р…Р В°РЎРЏ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СР В°', items: ['ТНВД', 'Топливные фильтры', 'Топливные форсунки', 'Топливные шланги', 'Газобаллонное оборудование'] },
                          { title: 'Рулевое управление', items: ['Рулевые рейки и редукторы', 'Рулевые тяги', 'Маятниковые рычаги', 'Рулевые колонки', 'Р СњР В°Р С”Р С•Р Р…Р ВµРЎвЂЎР Р…Р С‘Р С”Р С‘ Р С‘ Р В°Р СР С•РЎР‚РЎвЂљР С‘Р В·Р В°РЎвЂљР С•РЎР‚РЎвЂ№'] },
                          { title: 'Электрооборудование', items: ['Р вЂќР В°РЎвЂљРЎвЂЎР С‘Р С”Р С‘ Р В°Р Р†РЎвЂљР С•Р СР С•Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№Р Вµ', 'Звуковые сигналы', 'Генераторы в сборе', 'Р ВР Р…Р Р†Р ВµРЎР‚РЎвЂљР С•РЎР‚РЎвЂ№ Р Т‘Р В»РЎРЏ Р В°Р Р†РЎвЂљР С•Р СР С•Р В±Р С‘Р В»РЎРЏ', 'Стартеры в сборе'] },
                          { title: 'Детали салона', items: ['Зеркала заднего вида', 'Р вЂР В°РЎР‚Р Т‘Р В°РЎвЂЎР С•Р С”', 'Сиденья и их запчасти', 'Ручки и опоры', 'Р С™Р С•Р Р…РЎРѓР С•Р В»Р С‘ Р Р† Р В°Р Р†РЎвЂљР С•Р СР С•Р В±Р С‘Р В»РЎРЉ'] },
                          { title: 'Подшипники', items: ['Подшипники универсальные', 'Р СџР С•Р Т‘РЎв‚¬Р С‘Р С—Р Р…Р С‘Р С”Р С‘ Р Р†РЎвЂ№Р В¶Р С‘Р СР Р…РЎвЂ№Р Вµ', 'Р СџР С•Р Т‘РЎв‚¬Р С‘Р С—Р Р…Р С‘Р С”Р С‘ Р В°Р СР С•РЎР‚РЎвЂљР С‘Р В·Р В°РЎвЂљР С•РЎР‚Р В°', 'Подшипники ступицы', 'Подшипники подвесные'] },
                          { title: 'Р РЋР С‘РЎРѓРЎвЂљР ВµР СР В° Р С•РЎвЂЎР С‘РЎРѓРЎвЂљР С”Р С‘ РЎРѓРЎвЂљР ВµР С”Р С•Р В» Р С‘ РЎвЂћР В°РЎР‚', items: ['Щетки стеклоочистителя', 'Р С›Р СРЎвЂ№Р Р†Р В°РЎвЂљР ВµР В»Р С‘ РЎвЂћР В°РЎР‚ Р С‘ Р С”Р В°Р СР ВµРЎР‚', 'Резинки щеток стеклоочистителя', 'Р С™Р С•Р СР С—Р В»Р ВµР С”РЎвЂљРЎС“РЎР‹РЎвЂ°Р С‘Р Вµ РЎРѓРЎвЂљР ВµР С”Р В»Р С•Р С•РЎвЂЎР С‘РЎРѓРЎвЂљР С‘РЎвЂљР ВµР В»РЎРЏ', 'Р С™Р С•Р СР С—Р В»Р ВµР С”РЎвЂљРЎС“РЎР‹РЎвЂ°Р С‘Р Вµ РЎРѓРЎвЂљР ВµР С”Р В»Р С•Р С•Р СРЎвЂ№Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ'] },
                        */}{PARTS_CATEGORIES.map((cat) => (
                          <div key={cat.title} className="flex flex-col items-start text-left">
                            <h3 className="text-[11px] md:text-[10px] lg:text-[14px] font-bold mb-[4px] md:mb-[6px] lg:mb-[10px] text-white lg:whitespace-nowrap">{cat.title}</h3>
                            <ul className="flex flex-col gap-[2px] md:gap-[4px] items-start">
                              {cat.items.map((item) => (
                                <li key={item} className="text-[10px] md:text-[9px] lg:text-[13px] text-[#A0A0A0] hover:text-white cursor-pointer transition-colors leading-[1.3] md:leading-[1.4] lg:whitespace-nowrap">{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    <LoginModal
      isOpen={isLoginModalOpen}
      onClose={() => setIsLoginModalOpen(false)}
      onSuccess={(user) => { setIsLoginModalOpen(false); onSignIn?.(user); }}
    />
  </header>
);
};
