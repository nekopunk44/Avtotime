import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronRight, ChevronLeft, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Hero, type HeroQuickSearchPayload } from './components/home/Hero';
import { SectionHeader } from './components/shared/SectionHeader';
import { CarCard } from './components/shared/CarCard';
import { ServiceCard } from './components/shared/ServiceCard';
import { FeatureCards } from './components/home/FeatureCards';
import { RequestBanner } from './components/home/RequestBanner';
import {
  AutoTuningCreatePayload,
  AutoTuningListing,
  Car,
  CarServiceCreatePayload,
  CarServiceListing,
  ConsultationExpert,
  ConsultationExpertCreatePayload,
  DryCleaningCreatePayload,
  DryCleaningListing,
  AppNotification,
  MarketGame,
  Service,
} from './types';
import { getAvtotimeProfileUrl, MARKET_OPEN_PROFILE_EVENT, MARKET_TOAST_EVENT, showMarketToast } from './utils/avtotime';
import { marketAPI } from './utils/marketAPI';
import { CARS } from './constants/mockData';

const VehicleDetailsPage = lazy(() =>
  import('./components/vehicle/VehicleDetailsPage').then((module) => ({ default: module.VehicleDetailsPage }))
);
const VehicleListingView = lazy(() =>
  import('./components/vehicle/VehicleListingView').then((module) => ({ default: module.VehicleListingView }))
);
const AddListingPage = lazy(() =>
  import('./components/AddListingPage').then((module) => ({ default: module.AddListingPage }))
);
const AddCarServicePage = lazy(() =>
  import('./components/pages/AddCarServicePage').then((module) => ({ default: module.AddCarServicePage }))
);
const AddAutoTuningPage = lazy(() =>
  import('./components/pages/AddAutoTuningPage').then((module) => ({ default: module.AddAutoTuningPage }))
);
const AddConsultationPage = lazy(() =>
  import('./components/pages/AddConsultationPage').then((module) => ({ default: module.AddConsultationPage }))
);
const CarServicesPage = lazy(() =>
  import('./components/pages/CarServicesPage').then((module) => ({ default: module.CarServicesPage }))
);
const DryCleaningPage = lazy(() =>
  import('./components/pages/DryCleaningPage').then((module) => ({ default: module.DryCleaningPage }))
);
const AddDryCleaningPage = lazy(() =>
  import('./components/pages/AddDryCleaningPage').then((module) => ({ default: module.AddDryCleaningPage }))
);
const GamesPage = lazy(() =>
  import('./components/pages/GamesPage').then((module) => ({ default: module.GamesPage }))
);
const KidsPage = lazy(() =>
  import('./components/pages/KidsPage').then((module) => ({ default: module.KidsPage }))
);
const ConsultationsPage = lazy(() =>
  import('./components/pages/ConsultationsPage').then((module) => ({ default: module.ConsultationsPage }))
);
const EcoTipsPage = lazy(() =>
  import('./components/pages/EcoTipsPage').then((module) => ({ default: module.EcoTipsPage }))
);
const HelpOthersPage = lazy(() =>
  import('./components/pages/HelpOthersPage').then((module) => ({ default: module.HelpOthersPage }))
);
const DrivingCoursesPage = lazy(() =>
  import('./components/pages/DrivingCoursesPage').then((module) => ({ default: module.DrivingCoursesPage }))
);
const AutoTuningPage = lazy(() =>
  import('./components/pages/AutoTuningPage').then((module) => ({ default: module.AutoTuningPage }))
);
const ComparePage = lazy(() =>
  import('./components/pages/ComparePage').then((module) => ({ default: module.ComparePage }))
);
const SettingsPage = lazy(() =>
  import('./components/pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))
);
const SettingsDetailPage = lazy(() =>
  import('./components/pages/SettingsDetailPage').then((module) => ({ default: module.SettingsDetailPage }))
);
const TariffsPage = lazy(() =>
  import('./components/pages/TariffsPage').then((module) => ({ default: module.TariffsPage }))
);
const PaymentPage = lazy(() =>
  import('./components/pages/PaymentPage').then((module) => ({ default: module.PaymentPage }))
);
const PaymentHistoryPage = lazy(() =>
  import('./components/pages/PaymentHistoryPage').then((module) => ({ default: module.PaymentHistoryPage }))
);
const MarketAnalyticsPage = lazy(() =>
  import('./components/pages/MarketAnalyticsPage').then((module) => ({ default: module.MarketAnalyticsPage }))
);
const AdminPage = lazy(() =>
  import('./components/pages/AdminPage').then((module) => ({ default: module.AdminPage }))
);
const TermsOfServicePage = lazy(() =>
  import('./components/pages/TermsOfServicePage').then((module) => ({ default: module.TermsOfServicePage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('./components/pages/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage }))
);
const CookiePolicyPage = lazy(() =>
  import('./components/pages/CookiePolicyPage').then((module) => ({ default: module.CookiePolicyPage }))
);

const preloadAllChunks = () => {
  import('./components/vehicle/VehicleDetailsPage');
  import('./components/vehicle/VehicleListingView');
  import('./components/pages/CarServicesPage');
  import('./components/pages/ConsultationsPage');
  import('./components/pages/AutoTuningPage');
  import('./components/pages/DryCleaningPage');
  import('./components/pages/DrivingCoursesPage');
  import('./components/pages/GamesPage');
  import('./components/pages/KidsPage');
  import('./components/pages/EcoTipsPage');
  import('./components/pages/HelpOthersPage');
  import('./components/pages/SettingsPage');
  import('./components/pages/SettingsDetailPage');
  import('./components/pages/TariffsPage');
  import('./components/pages/ComparePage');
  import('./components/pages/AdminPage');
  import('./components/AddListingPage');
  import('./components/pages/AddCarServicePage');
  import('./components/pages/AddAutoTuningPage');
  import('./components/pages/AddConsultationPage');
  import('./components/pages/AddDryCleaningPage');
  import('./components/pages/PaymentPage');
  import('./components/pages/PaymentHistoryPage');
  import('./components/pages/MarketAnalyticsPage');
};

interface MarketPlanLimits {
  maxListings: number | null;
  maxPhotos: number | null;
  maxDescriptionLen: number | null;
  listingDays?: number | null;
  priority?: number;
  phoneVisible?: boolean;
  analyticsEnabled?: boolean;
  videoEnabled?: boolean;
  badge?: string | null;
}

interface MarketUserData {
  _id?: string;
  userName?: string;
  name?: string;
  profileImage?: string;
  email?: string;
  bio?: string;
  profession?: string;
  gender?: string;
  location?: string;
  phone?: string;
  address?: string;
  region?: string;
  preferredContact?: string;
  plan?: string;
  effectivePlan?: string;
  planLimits?: MarketPlanLimits;
  planExpiresAt?: string | null;
  isEmailVerified?: boolean;
}

interface AppProps {
  userData?: MarketUserData | null;
  onOpenFeed?: () => void;
  onOpenReels?: () => void;
  onOpenProfile?: () => void;
  onOpenUserProfile?: (userName: string) => void;
  onOpenTariffs?: () => void;
  onOpenAdmin?: () => void;
  onCheckUserExists?: (userName: string) => Promise<boolean>;
  onLoadCarListings?: (options?: { mine?: boolean }) => Promise<Car[]>;
  onLoadPartListings?: (options?: { mine?: boolean }) => Promise<Car[]>;
  onCreateCarListing?: (listing: {
    offerType: string;
    brand: string;
    model: string;
    year: string;
    mileage: string;
    fuel: string;
    body: string;
    drive: string;
    gearbox: string;
    engineVolume: string;
    seats: string;
    registration: string;
    region: string;
    price: string;
    currency: string;
    title: string;
    description: string;
    images: File[];
    videoUrl?: string;
  }) => Promise<Car>;
  onLoadConsultationExperts?: (options?: { mine?: boolean }) => Promise<ConsultationExpert[]>;
  onCreateConsultationExpert?: (expert: ConsultationExpertCreatePayload) => Promise<ConsultationExpert>;
  onLoadCarServiceListings?: (options?: { mine?: boolean }) => Promise<CarServiceListing[]>;
  onCreateCarServiceListing?: (service: CarServiceCreatePayload) => Promise<CarServiceListing>;
  onLoadAutoTuningListings?: (options?: { mine?: boolean }) => Promise<AutoTuningListing[]>;
  onCreateAutoTuningListing?: (listing: AutoTuningCreatePayload) => Promise<AutoTuningListing>;
  onLoadDryCleaningListings?: (options?: { mine?: boolean }) => Promise<DryCleaningListing[]>;
  onCreateDryCleaningListing?: (listing: DryCleaningCreatePayload) => Promise<DryCleaningListing>;
  onLoadGames?: () => Promise<MarketGame[]>;
  onLoadCompareState?: () => Promise<{ id: number; type: string }[]>;
  onSaveCompareState?: (items: { id: number; type: string }[]) => Promise<void>;
  onSignOut?: () => void | Promise<void>;
  onResendVerification?: () => Promise<void>;
}

interface AppToast {
  id: number;
  message: string;
}

export default function App({
  userData = null,
  onOpenFeed,
  onOpenReels,
  onOpenProfile,
  onOpenUserProfile,
  onOpenTariffs,
  onOpenAdmin,
  onCheckUserExists,
  onLoadCarListings,
  onLoadPartListings,
  onCreateCarListing,
  onLoadConsultationExperts,
  onCreateConsultationExpert,
  onLoadCarServiceListings,
  onCreateCarServiceListing,
  onLoadAutoTuningListings,
  onCreateAutoTuningListing,
  onLoadDryCleaningListings,
  onCreateDryCleaningListing,
  onLoadGames,
  onLoadCompareState,
  onSaveCompareState,
  onSignOut,
  onResendVerification,
}: AppProps) {
  const [userDataOverrides, setUserDataOverrides] = useState<Partial<MarketUserData>>({});
  const [sessionUserData, setSessionUserData] = useState<MarketUserData | null>(null);
  const sessionLoaded = useRef(false);

  // Load session on mount (standalone mode — when no userData prop is provided)
  useEffect(() => {
    if (userData !== null && userData !== undefined) return; // parent manages auth
    if (sessionLoaded.current) return;
    sessionLoaded.current = true;
    marketAPI.getSession().then((u) => { if (u) setSessionUserData(u as MarketUserData); }).catch(() => {});
  }, [userData]);

  const resolvedUserData = userData ?? sessionUserData;

  const effectiveUserData = React.useMemo(
    () => (resolvedUserData ? { ...resolvedUserData, ...userDataOverrides } : null),
    [resolvedUserData, userDataOverrides]
  );

  const handleSignIn = React.useCallback((user: MarketUserData) => {
    setSessionUserData(user);
    setUserDataOverrides({});
  }, []);

  const handleSignOut = React.useCallback(async () => {
    if (onSignOut) { await onSignOut(); return; }
    try { await marketAPI.signOut(); } catch { /* ignore */ }
    setSessionUserData(null);
    setUserDataOverrides({});
  }, [onSignOut]);

  const handleUserDataChange = React.useCallback((updates: Partial<MarketUserData>) => {
    setUserDataOverrides((prev) => ({ ...prev, ...updates }));
  }, []);

  const [currentPage, setCurrentPage] = useState('home');
  const [logoTransition, setLogoTransition] = useState<
    | null
    | {
        id: number;
        left: number;
        top: number;
        diameter: number;
        phase: 'cover' | 'reveal';
      }
  >(null);
  const logoTransitionTimers = useRef<{ cover?: number; cleanup?: number }>({});
  const [kidsInitialTab, setKidsInitialTab] = useState<string | undefined>(undefined);
  const [pendingPaymentPlan, setPendingPaymentPlan] = useState<'pro' | 'business' | null>(null);
  const [selectedVehicleType, setSelectedVehicleType] = useState('');
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [compareList, setCompareList] = useState<{id: number, type: string}[]>([]);
  const [catalogKey, setCatalogKey] = useState(0);
  const [carListings, setCarListings] = useState<Car[]>([]);
  const [partsListings, setPartsListings] = useState<Car[]>([]);
  const [consultationExperts, setConsultationExperts] = useState<ConsultationExpert[]>([]);
  const [carServiceListings, setCarServiceListings] = useState<CarServiceListing[]>([]);
  const [autoTuningListings, setAutoTuningListings] = useState<AutoTuningListing[]>([]);
  const [dryCleaningListings, setDryCleaningListings] = useState<DryCleaningListing[]>([]);
  const [games, setGames] = useState<MarketGame[]>([]);
  const [activeToast, setActiveToast] = useState<AppToast | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [moderationQueue, setModerationQueue] = useState<Array<{ kind: string; id: number; startedAt: number }>>([]);
  const moderationTickInFlight = useRef(false);
  const [homeNewAdsPage, setHomeNewAdsPage] = useState(0);
  const [homeNewAdsDirection, setHomeNewAdsDirection] = useState<1 | -1>(1);
  const [vehicleQuickSearch, setVehicleQuickSearch] = useState<HeroQuickSearchPayload | null>(null);
  const [vehicleQuickSearchKey, setVehicleQuickSearchKey] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (logoTransitionTimers.current.cover) window.clearTimeout(logoTransitionTimers.current.cover);
      if (logoTransitionTimers.current.cleanup) window.clearTimeout(logoTransitionTimers.current.cleanup);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage]);

  useEffect(() => {
    preloadAllChunks();
  }, []);

  const startLogoNavigation = React.useCallback(
    (targetPage: string, origin?: { x: number; y: number }) => {
      if (typeof window === 'undefined') {
        setCurrentPage(targetPage);
        return;
      }

      const viewportW = window.innerWidth || 1;
      const viewportH = window.innerHeight || 1;
      const originX = origin?.x ?? viewportW * 0.14;
      const originY = origin?.y ?? Math.max(56, Math.min(viewportH * 0.12, 110));

      const corners = [
        { x: 0, y: 0 },
        { x: viewportW, y: 0 },
        { x: 0, y: viewportH },
        { x: viewportW, y: viewportH },
      ];

      const radius = Math.max(...corners.map((corner) => Math.hypot(corner.x - originX, corner.y - originY)));
      const diameter = Math.ceil(radius * 2);

      if (logoTransitionTimers.current.cover) window.clearTimeout(logoTransitionTimers.current.cover);
      if (logoTransitionTimers.current.cleanup) window.clearTimeout(logoTransitionTimers.current.cleanup);

      const id = Date.now();
      setLogoTransition({
        id,
        left: Math.round(originX - radius),
        top: Math.round(originY - radius),
        diameter,
        phase: 'cover',
      });

      const COVER_MS = 520;
      const REVEAL_MS = 580;

      logoTransitionTimers.current.cover = window.setTimeout(() => {
        setCurrentPage(targetPage);
        setLogoTransition((prev) => (prev ? { ...prev, phase: 'reveal' } : prev));
      }, COVER_MS);

      logoTransitionTimers.current.cleanup = window.setTimeout(() => {
        setLogoTransition(null);
      }, COVER_MS + REVEAL_MS);
    },
    []
  );

  const handleLogoClick = React.useCallback(
    (originRect?: { left: number; top: number; width: number; height: number }) => {
      if (typeof window === 'undefined') {
        setCurrentPage('home');
        return;
      }

      if (onOpenFeed) {
        window.dispatchEvent(
          new CustomEvent('avtotime:logo-bridge', {
            detail: {
              from: 'market',
              to: '/',
              originRect: originRect || null,
            },
          })
        );
        return;
      }

      const origin = originRect
        ? { x: originRect.left + originRect.width / 2, y: originRect.top + originRect.height / 2 }
        : undefined;
      startLogoNavigation('home', origin);
    },
    [onOpenFeed, startLogoNavigation]
  );

  const mergeListings = <T extends { id?: number; _id?: string }>(primary: T[], secondary: T[]) => {
    const byKey = new Map<string, T>();
    const getKey = (item: T) => (typeof item.id === 'number' ? `id:${item.id}` : item._id ? `oid:${item._id}` : '');

    for (const item of primary) {
      const key = getKey(item);
      if (key) byKey.set(key, item);
    }

    for (const item of secondary) {
      const key = getKey(item);
      if (key && !byKey.has(key)) byKey.set(key, item);
    }

    return Array.from(byKey.values());
  };

  const homeNewAds = React.useMemo(() => {
    const approved = carListings.filter((car) => {
      const status = String((car as any)?.moderationStatus || '').toLowerCase();
      return !status || status === 'approved';
    });
    return approved.slice().sort((a, b) => (b.id || 0) - (a.id || 0));
  }, [carListings]);

  const HOME_NEW_ADS_PAGE_SIZE = 3;
  const homeNewAdsMaxPage = Math.max(0, Math.ceil(homeNewAds.length / HOME_NEW_ADS_PAGE_SIZE) - 1);

  useEffect(() => {
    setHomeNewAdsPage((prev) => Math.min(prev, homeNewAdsMaxPage));
  }, [homeNewAdsMaxPage]);

  const isApprovedListing = (status?: string) => {
    const normalized = String(status || '').toLowerCase();
    return !normalized || normalized === 'approved';
  };

  const CONSULTATION_CARD_IMAGE =
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1200&auto=format&fit=crop';

  const HOME_TOP_SERVICES_PAGE_SIZE = 4;
  const [homeTopServicesPage, setHomeTopServicesPage] = useState(0);
  const [homeTopServicesDirection, setHomeTopServicesDirection] = useState<1 | -1>(1);

  const homeTopServices = React.useMemo<Service[]>(() => {
    const services: Service[] = [];

    for (const listing of carServiceListings) {
      if (!isApprovedListing((listing as any)?.moderationStatus)) continue;
      const rating = Number((listing as any)?.serviceQuality ?? 0) || 0;
      services.push({
        id: 2000000 + (listing.id || 0),
        image: listing.image,
        title: listing.title,
        seller: listing.socialNickname || 'Автосервис',
        sellerAvatar: `https://i.pravatar.cc/150?u=car-service-${listing._id || listing.id}`,
        rating,
        condition: `${Math.max(0, Math.min(5, Math.round(rating)))}/5`,
        price: String((listing as any)?.price ?? ''),
        location: listing.location || '',
        description: listing.category ? `Категория: ${listing.category}` : '',
        time: 'только что',
        views: '0',
      });
    }

    for (const listing of autoTuningListings) {
      if (!isApprovedListing((listing as any)?.moderationStatus)) continue;
      const rating = Number((listing as any)?.rating ?? 0) || 0;
      const tags = Array.isArray((listing as any)?.tags) ? (listing as any).tags.join(', ') : '';
      services.push({
        id: 3000000 + (listing.id || 0),
        image: listing.image,
        title: listing.title,
        seller: listing.socialNickname || 'Автотюнинг',
        sellerAvatar: `https://i.pravatar.cc/150?u=auto-tuning-${listing._id || listing.id}`,
        rating,
        condition: `${rating.toFixed(1)}/5`,
        price: String((listing as any)?.price ?? ''),
        location: listing.location || '',
        description: tags || listing.badge || listing.category || '',
        time: 'только что',
        views: '0',
      });
    }

    for (const listing of dryCleaningListings) {
      if (!isApprovedListing((listing as any)?.moderationStatus)) continue;
      const rating = Number((listing as any)?.rating ?? 0) || 0;
      const tags = Array.isArray((listing as any)?.tags) ? (listing as any).tags.join(', ') : '';
      services.push({
        id: 4000000 + (listing.id || 0),
        image: listing.image,
        title: listing.title,
        seller: listing.socialNickname || 'Химчистка',
        sellerAvatar: `https://i.pravatar.cc/150?u=dry-cleaning-${listing._id || listing.id}`,
        rating,
        condition: `${rating.toFixed(1)}/5`,
        price: String((listing as any)?.price ?? ''),
        location: listing.location || '',
        description: tags || listing.badge || listing.category || '',
        time: 'только что',
        views: '0',
      });
    }

    for (const expert of consultationExperts) {
      if (!isApprovedListing((expert as any)?.moderationStatus)) continue;
      const rating = Number((expert as any)?.rating ?? 0) || 0;
      const specialties = Array.isArray(expert.specialties) ? expert.specialties.join(', ') : '';
      services.push({
        id: 5000000 + (expert.id || 0),
        image: CONSULTATION_CARD_IMAGE,
        title: expert.name,
        seller: expert.socialNickname || expert.name,
        sellerAvatar: expert.avatar,
        rating,
        condition: `${rating.toFixed(1)}/5`,
        price: String((expert as any)?.hourlyRate ?? ''),
        location: expert.location || '',
        description: specialties || 'Консультации',
        time: 'только что',
        views: '0',
      });
    }

    services.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return services;
  }, [autoTuningListings, carServiceListings, consultationExperts, dryCleaningListings]);

  const homeTopServicesMaxPage = Math.max(
    0,
    Math.ceil(homeTopServices.length / HOME_TOP_SERVICES_PAGE_SIZE) - 1
  );

  useEffect(() => {
    setHomeTopServicesPage((prev) => Math.min(prev, homeTopServicesMaxPage));
  }, [homeTopServicesMaxPage]);

  const hashString = (value: string) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const mulberry32 = (seed: number) => {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  };

  const seededShuffle = <T,>(items: T[], seed: number) => {
    const next = items.slice();
    const rand = mulberry32(seed || 1);

    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }

    return next;
  };

  type ViewedCar = {
    id: number;
    brand?: string;
    model?: string;
    fuel?: string;
    transmission?: string;
    year?: string;
    bodyType?: string;
    driveType?: string;
    location?: string;
    viewedAt: number;
  };

  const VIEWED_CARS_STORAGE_KEY = 'market_viewed_cars_v1';
  const [viewedCars, setViewedCars] = useState<ViewedCar[]>([]);
  const lastRecordedView = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(VIEWED_CARS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setViewedCars(
        parsed
          .filter((item) => item && typeof item.id === 'number')
          .slice(0, 30)
          .map((item) => ({
            id: item.id,
            brand: typeof item.brand === 'string' ? item.brand : undefined,
            model: typeof item.model === 'string' ? item.model : undefined,
            fuel: typeof item.fuel === 'string' ? item.fuel : undefined,
            transmission: typeof item.transmission === 'string' ? item.transmission : undefined,
            year: typeof item.year === 'string' ? item.year : undefined,
            bodyType: typeof item.bodyType === 'string' ? item.bodyType : undefined,
            driveType: typeof item.driveType === 'string' ? item.driveType : undefined,
            location: typeof item.location === 'string' ? item.location : undefined,
            viewedAt: typeof item.viewedAt === 'number' ? item.viewedAt : Date.now(),
          }))
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(VIEWED_CARS_STORAGE_KEY, JSON.stringify(viewedCars.slice(0, 30)));
    } catch {
      // ignore
    }
  }, [viewedCars]);

  useEffect(() => {
    if (currentPage !== 'vehicle-view' || !selectedCar) return;
    if (lastRecordedView.current === selectedCar.id) return;
    lastRecordedView.current = selectedCar.id;

    const viewed: ViewedCar = {
      id: selectedCar.id,
      brand: selectedCar.brand,
      model: selectedCar.model,
      fuel: selectedCar.fuel,
      transmission: selectedCar.transmission,
      year: selectedCar.year,
      bodyType: selectedCar.bodyType,
      driveType: selectedCar.driveType,
      location: selectedCar.location,
      viewedAt: Date.now(),
    };

    setViewedCars((prev) => {
      const next = [viewed, ...prev.filter((item) => item.id !== viewed.id)];
      return next.slice(0, 30);
    });
  }, [currentPage, selectedCar]);

  const [homeRecommendationsPage, setHomeRecommendationsPage] = useState(0);
  const [homeRecommendationsDirection, setHomeRecommendationsDirection] = useState<1 | -1>(1);

  const homeRecommendations = React.useMemo(() => {
    const approved = carListings.filter((car) => {
      const status = String((car as any)?.moderationStatus || '').toLowerCase();
      return !status || status === 'approved';
    });

    const seedSource = String(userData?._id || userData?.userName || userData?.name || 'default');
    const seed = hashString(`${seedSource}:${viewedCars[0]?.id ?? 'no-history'}`);

    const normalize = (value?: string) =>
      String(value || '')
        .trim()
        .toLowerCase();

    const getYear = (value?: string) => {
      const num = Number(String(value || '').replace(/[^\d]/g, ''));
      return Number.isFinite(num) ? num : null;
    };

    if (!viewedCars.length) {
      return seededShuffle(approved, seed);
    }

    const recent = viewedCars.slice(0, 10);
    const recentlyViewedIds = new Set(recent.map((v) => v.id));

    const scored = approved
      .filter((car) => !recentlyViewedIds.has(car.id))
      .map((car) => {
        const carBrand = normalize(car.brand);
        const carModel = normalize(car.model);
        const carFuel = normalize(car.fuel);
        const carTransmission = normalize(car.transmission);
        const carBody = normalize(car.bodyType);
        const carDrive = normalize(car.driveType);
        const carLocation = normalize(car.location);
        const carYear = getYear(car.year);

        let score = 0;

        recent.forEach((view, index) => {
          const weight = 1 / (index + 1);
          const viewBrand = normalize(view.brand);
          const viewModel = normalize(view.model);
          const viewFuel = normalize(view.fuel);
          const viewTransmission = normalize(view.transmission);
          const viewBody = normalize(view.bodyType);
          const viewDrive = normalize(view.driveType);
          const viewLocation = normalize(view.location);
          const viewYear = getYear(view.year);

          if (viewModel && carModel && viewModel === carModel) score += 6 * weight;
          if (viewBrand && carBrand && viewBrand === carBrand) score += 4 * weight;
          if (viewFuel && carFuel && viewFuel === carFuel) score += 1.5 * weight;
          if (viewTransmission && carTransmission && viewTransmission === carTransmission) score += 1.5 * weight;
          if (viewBody && carBody && viewBody === carBody) score += 1.0 * weight;
          if (viewDrive && carDrive && viewDrive === carDrive) score += 1.0 * weight;
          if (viewLocation && carLocation && viewLocation === carLocation) score += 0.75 * weight;

          if (viewYear && carYear) {
            const diff = Math.abs(viewYear - carYear);
            if (diff <= 1) score += 1.5 * weight;
            else if (diff <= 3) score += 1.0 * weight;
            else if (diff <= 5) score += 0.5 * weight;
          }
        });

        const tieBreaker = hashString(`${seed}:${car.id}`) / 2 ** 32;
        return { car, score, tieBreaker };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.tieBreaker - a.tieBreaker;
      })
      .map((item) => item.car);

    if (scored.length >= approved.length) return scored;

    const remaining = approved.filter((car) => !recentlyViewedIds.has(car.id) && !scored.some((c) => c.id === car.id));
    const fallback = seededShuffle(remaining, seed);
    return [...scored, ...fallback];
  }, [carListings, userData, viewedCars]);

  const HOME_RECOMMENDATIONS_PAGE_SIZE = 3;
  const homeRecommendationsMaxPage = Math.max(
    0,
    Math.ceil(homeRecommendations.length / HOME_RECOMMENDATIONS_PAGE_SIZE) - 1
  );

  useEffect(() => {
    setHomeRecommendationsPage((prev) => Math.min(prev, homeRecommendationsMaxPage));
  }, [homeRecommendationsMaxPage]);

  const getErrorMessage = (error: unknown) => {
    if (!error) return '';
    if (error instanceof Error) return error.message;
    return String(error);
  };

  const refreshNotifications = async () => {
    if (!userData) return;
    try {
      const [count, items] = await Promise.all([
        marketAPI.loadUnreadNotificationsCount(),
        marketAPI.loadNotifications({ isRead: false }),
      ]);
      setUnreadNotificationsCount(count);
      setNotifications(items);
    } catch {
      // ignore (backend may be offline during dev)
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!userData) {
      setNotifications([]);
      setUnreadNotificationsCount(0);
      return;
    }

    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 15000);
    return () => window.clearInterval(timer);
  }, [userData?._id]);

  const handleNotificationRead = async (notificationId: string) => {
    setNotifications((prev) => prev.filter((item) => item._id !== notificationId));
    setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
    try {
      await marketAPI.markNotificationRead(notificationId);
    } catch {
      refreshNotifications();
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const removed = notifications.length;
    setNotifications([]);
    setUnreadNotificationsCount((prev) => Math.max(0, prev - removed));
    try {
      await marketAPI.markAllNotificationsRead();
      setUnreadNotificationsCount(0);
    } catch {
      refreshNotifications();
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get('view');

    if (requestedView === 'tariffs') {
      setCurrentPage('tariffs');
      return;
    }

    if (requestedView === 'settings') {
      setCurrentPage('settings');
      return;
    }

    if (
      requestedView === 'settings-main-info' ||
      requestedView === 'settings-personal-data' ||
      requestedView === 'settings-security' ||
      requestedView === 'settings-listings'
    ) {
      setCurrentPage(requestedView);
      return;
    }

    setCurrentPage((prev) => (prev === 'tariffs' || prev === 'settings' ? 'home' : prev));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleToastEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const message = customEvent.detail?.message?.trim();

      if (!message) {
        return;
      }

      setActiveToast({
        id: Date.now(),
        message,
      });
    };

    window.addEventListener(MARKET_TOAST_EVENT, handleToastEvent as EventListener);

    return () => {
      window.removeEventListener(MARKET_TOAST_EVENT, handleToastEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!activeToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveToast((current) => (current?.id === activeToast.id ? null : current));
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [activeToast]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOpenProfileEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ userName?: string; nickname?: string }>;
      const rawUserName = customEvent.detail?.userName ?? customEvent.detail?.nickname ?? '';
      const userName = rawUserName.trim().replace(/^@+/, '');

      if (!userName) {
        showMarketToast('Пользователь не найден.');
        return;
      }

      event.preventDefault();

      void (async () => {
        if (onCheckUserExists) {
          try {
            const exists = await onCheckUserExists(userName);
            if (!exists) {
              showMarketToast('Пользователь не найден.');
              return;
            }
          } catch {
            showMarketToast('Пользователь не найден.');
            return;
          }
        }

        if (onOpenUserProfile) {
          onOpenUserProfile(userName);
          return;
        }

        const profileUrl = getAvtotimeProfileUrl(userName);
        if (!profileUrl) {
          showMarketToast('Пользователь не найден.');
          return;
        }

        window.location.assign(profileUrl);
      })();
    };

    window.addEventListener(MARKET_OPEN_PROFILE_EVENT, handleOpenProfileEvent as EventListener);

    return () => {
      window.removeEventListener(MARKET_OPEN_PROFILE_EVENT, handleOpenProfileEvent as EventListener);
    };
  }, [onOpenUserProfile, onCheckUserExists]);

  useEffect(() => {
    let cancelled = false;
    const loader = onLoadCarServiceListings || marketAPI.loadCarServices;

    let publicError: unknown = null;
    let mineError: unknown = null;

    Promise.all([
      loader().catch((err) => {
        publicError = err;
        return [];
      }),
      loader({ mine: true }).catch((err) => {
        mineError = err;
        return [];
      }),
    ])
      .then(([publicListings, mineListings]) => {
        if (cancelled) return;
        setCarServiceListings(mergeListings(mineListings, publicListings));

        if (publicListings.length === 0 && mineListings.length === 0 && (publicError || mineError)) {
          const detail = getErrorMessage(mineError || publicError);
          showMarketToast(detail ? `Не удалось загрузить объявления автосервиса: ${detail}` : 'Не удалось загрузить объявления автосервиса.');
        }
      })
      .catch((err) => {
        const detail = getErrorMessage(err);
        showMarketToast(detail ? `Не удалось загрузить объявления автосервиса: ${detail}` : 'Не удалось загрузить объявления автосервиса.');
      });

    return () => {
      cancelled = true;
    };
  }, [onLoadCarServiceListings]);

  useEffect(() => {
    let cancelled = false;
    const loader = onLoadAutoTuningListings || marketAPI.loadAutoTuning;

    let publicError: unknown = null;
    let mineError: unknown = null;

    Promise.all([
      loader().catch((err) => {
        publicError = err;
        return [];
      }),
      loader({ mine: true }).catch((err) => {
        mineError = err;
        return [];
      }),
    ])
      .then(([publicListings, mineListings]) => {
        if (cancelled) return;
        setAutoTuningListings(mergeListings(mineListings, publicListings));

        if (publicListings.length === 0 && mineListings.length === 0 && (publicError || mineError)) {
          const detail = getErrorMessage(mineError || publicError);
          showMarketToast(detail ? `Не удалось загрузить объявления автотюнинга: ${detail}` : 'Не удалось загрузить объявления автотюнинга.');
        }
      })
      .catch((err) => {
        const detail = getErrorMessage(err);
        showMarketToast(detail ? `Не удалось загрузить объявления автотюнинга: ${detail}` : 'Не удалось загрузить объявления автотюнинга.');
      });

    return () => {
      cancelled = true;
    };
  }, [onLoadAutoTuningListings]);

  useEffect(() => {
    if (!onLoadConsultationExperts) {
      return;
    }

    onLoadConsultationExperts()
      .then((next) => setConsultationExperts(next))
      .catch(() => showMarketToast('Не удалось загрузить консультации.'));
  }, [onLoadConsultationExperts]);

  useEffect(() => {
    let cancelled = false;
    const loader = onLoadCarListings || marketAPI.loadCars;

    let publicError: unknown = null;
    let mineError: unknown = null;

    Promise.all([
      loader().catch((err) => {
        publicError = err;
        return [];
      }),
      loader({ mine: true }).catch((err) => {
        mineError = err;
        return [];
      }),
    ])
      .then(([publicListings, mineListings]) => {
        if (cancelled) return;
        setCarListings(mergeListings(mineListings, publicListings));

        if (publicListings.length === 0 && mineListings.length === 0 && (publicError || mineError)) {
          const detail = getErrorMessage(mineError || publicError);
          showMarketToast(detail ? `Не удалось загрузить объявления авто: ${detail}` : 'Не удалось загрузить объявления авто.');
        }
      })
      .catch((err) => {
        const detail = getErrorMessage(err);
        showMarketToast(detail ? `Не удалось загрузить объявления авто: ${detail}` : 'Не удалось загрузить объявления авто.');
      });

    return () => {
      cancelled = true;
    };
  }, [onLoadCarListings]);

  useEffect(() => {
    let cancelled = false;
    const loader = onLoadPartListings || marketAPI.loadParts;

    let publicError: unknown = null;
    let mineError: unknown = null;

    Promise.all([
      loader().catch((err) => {
        publicError = err;
        return [];
      }),
      loader({ mine: true }).catch((err) => {
        mineError = err;
        return [];
      }),
    ])
      .then(([publicListings, mineListings]) => {
        if (cancelled) return;
        setPartsListings(mergeListings(mineListings, publicListings));

        if (publicListings.length === 0 && mineListings.length === 0 && (publicError || mineError)) {
          const detail = getErrorMessage(mineError || publicError);
          showMarketToast(detail ? `Не удалось загрузить объявления автозапчастей: ${detail}` : 'Не удалось загрузить объявления автозапчастей.');
        }
      })
      .catch((err) => {
        const detail = getErrorMessage(err);
        showMarketToast(detail ? `Не удалось загрузить объявления автозапчастей: ${detail}` : 'Не удалось загрузить объявления автозапчастей.');
      });

    return () => {
      cancelled = true;
    };
  }, [onLoadPartListings]);

  useEffect(() => {
    let cancelled = false;
    const loader = onLoadDryCleaningListings || marketAPI.loadDryCleaning;

    let publicError: unknown = null;
    let mineError: unknown = null;

    Promise.all([
      loader().catch((err) => {
        publicError = err;
        return [];
      }),
      loader({ mine: true }).catch((err) => {
        mineError = err;
        return [];
      }),
    ])
      .then(([publicListings, mineListings]) => {
        if (cancelled) return;
        setDryCleaningListings(mergeListings(mineListings, publicListings));

        if (publicListings.length === 0 && mineListings.length === 0 && (publicError || mineError)) {
          const detail = getErrorMessage(mineError || publicError);
          showMarketToast(detail ? `Не удалось загрузить химчистку: ${detail}` : 'Не удалось загрузить химчистку.');
        }
      })
      .catch((err) => {
        const detail = getErrorMessage(err);
        showMarketToast(detail ? `Не удалось загрузить химчистку: ${detail}` : 'Не удалось загрузить химчистку.');
      });

    return () => {
      cancelled = true;
    };
  }, [onLoadDryCleaningListings]);

  useEffect(() => {
    if (!onLoadGames) {
      return;
    }

    onLoadGames()
      .then((next) => setGames(next))
      .catch(() => showMarketToast('Не удалось загрузить игры.'));
  }, [onLoadGames]);

  useEffect(() => {
    if (!onLoadCompareState) {
      return;
    }

    onLoadCompareState()
      .then((items) => {
        if (Array.isArray(items)) {
          setCompareList(items);
        }
      })
      .catch(() => undefined);
  }, [onLoadCompareState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const path = window.location.pathname || '';
    const params = new URLSearchParams(window.location.search || '');
    const view = String(params.get('view') || '').trim();

    if (path === '/admin' || view === 'admin') {
      setCurrentPage('admin');
      return;
    }

    if (view === 'tariffs') {
      setCurrentPage('tariffs');
      return;
    }

    if (view === 'settings') {
      setCurrentPage('settings');
      return;
    }

    if (
      view === 'settings-main-info' ||
      view === 'settings-personal-data' ||
      view === 'settings-security' ||
      view === 'settings-listings' ||
      view === 'payment-history' ||
      view === 'market-analytics'
    ) {
      setCurrentPage(view);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextUrl =
      currentPage === 'tariffs'
        ? '/market?view=tariffs'
        : currentPage === 'admin'
          ? window.location.pathname === '/admin'
            ? '/admin'
            : '/market?view=admin'
        : currentPage === 'settings'
          ? '/market?view=settings'
          : currentPage === 'settings-main-info' ||
              currentPage === 'settings-personal-data' ||
              currentPage === 'settings-security' ||
              currentPage === 'settings-listings' ||
              currentPage === 'payment-history' ||
              currentPage === 'market-analytics'
            ? `/market?view=${currentPage}`
          : '/market';
    window.history.replaceState({}, '', nextUrl);
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;

    if (!userData?._id) {
      setIsAdmin(false);
      return () => {
        cancelled = true;
      };
    }

    marketAPI
      .getAdminStatus()
      .then((data) => {
        if (cancelled) return;
        setIsAdmin(Boolean(data?.isAdmin));
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userData?._id]);

  const handleVehicleSelect = (type: string) => {
    setSelectedVehicleType(type);
    setCatalogKey(prev => prev + 1);
  };

  const handleCarListingPublish = async (listing: {
    offerType: string;
    brand: string;
    model: string;
    year: string;
    mileage: string;
    fuel: string;
    body: string;
    drive: string;
    gearbox: string;
    engineVolume: string;
    seats: string;
    registration: string;
    region: string;
    price: string;
    currency: string;
    title: string;
    description: string;
    images: File[];
    videoUrl?: string;
  }) => {
    try {
      if (onCreateCarListing) {
        const created = await onCreateCarListing(listing);
        const status = String((created as any)?.moderationStatus || '').toLowerCase();
        if (status === 'pending') {
          showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
          enqueueModerationTracking('cars', created.id);
        } else {
          setCarListings((prev) => [created, ...prev]);
        }
      } else {
        try {
          const created = await marketAPI.createCar(listing);
          const status = String((created as any)?.moderationStatus || '').toLowerCase();
          if (status === 'pending') {
            showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
            enqueueModerationTracking('cars', created.id);
          } else {
            setCarListings((prev) => [created, ...prev]);
          }
          setCurrentPage('vehicle-details');
          return;
        } catch (error) {
          showMarketToast((error as any)?.message || 'Backend unavailable; added locally.');
        }

        setCarListings((prev) => {
          const nextId = prev.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;

          return [
            {
              id: nextId,
            image: CARS[0]?.image ?? '',
            images: [],
            price: listing.currency ? `${listing.currency} ${listing.price}` : listing.price,
            title: listing.title,
            mileage: listing.mileage,
            fuel: listing.fuel,
            transmission: listing.gearbox,
            year: listing.year,
            location: listing.region,
            seller: userData?.userName || userData?.name || 'Пользователь',
            sellerAvatar: userData?.profileImage || '',
            time: 'только что',
            views: '0',
            type: listing.offerType,
            brand: listing.brand,
            model: listing.model,
            bodyType: listing.body,
            driveType: listing.drive,
            engineVolume: listing.engineVolume,
            seats: listing.seats,
            registrationPlace: listing.registration,
            region: listing.region,
            description: listing.description,
            socialNickname: userData?.userName ? `@${userData.userName}` : undefined,
          },
          ...prev,
          ];
        });
      }

      setCurrentPage('vehicle-details');
    } catch (error: any) {
      const data = error?.response?.data || error?.data;
      const code = data?.code;
      const msg = data?.message || error?.message || 'Не удалось опубликовать объявление авто.';
      if (code === 'PLAN_LISTING_LIMIT' || code === 'PLAN_PHOTO_LIMIT' || code === 'PLAN_DESCRIPTION_LIMIT') {
        showMarketToast(msg);
      } else {
        showMarketToast(msg);
      }
    }
  };

  const toggleCompare = (id: number, type: string) => {
    setCompareList(prev => {
      const exists = prev.find(i => i.id === id && i.type === type);
      if (exists) {
        return prev.filter(i => !(i.id === id && i.type === type));
      }
      
      // Enforce same type
      if (prev.length > 0 && prev[0].type !== type) {
        return [{ id, type }];
      }
      
      if (prev.length < 2) {
        return [...prev, { id, type }];
      }
      return prev;
    });
  };

  useEffect(() => {
    if (!onSaveCompareState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void onSaveCompareState(compareList);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [compareList, onSaveCompareState]);

  const enqueueModerationTracking = (kind: string, id: number) => {
    if (!id || !Number.isFinite(id)) return;
    setModerationQueue((prev) => {
      const exists = prev.some((item) => item.kind === kind && item.id === id);
      if (exists) return prev;
      return [...prev, { kind, id, startedAt: Date.now() }];
    });
  };

  useEffect(() => {
    if (moderationQueue.length === 0) {
      return;
    }

    const POLL_INTERVAL_MS = 15_000;
    const POLL_TIMEOUT_MS = 5 * 60_000;

    const getMineLoader = (kind: string) => {
      switch (kind) {
        case 'cars':
          return onLoadCarListings;
        case 'car-services':
          return onLoadCarServiceListings;
        case 'auto-tuning':
          return onLoadAutoTuningListings;
        case 'consultations':
          return onLoadConsultationExperts;
        case 'dry-cleaning':
          return onLoadDryCleaningListings;
        default:
          return undefined;
      }
    };

    const refreshPublicList = async (kind: string) => {
      switch (kind) {
        case 'cars': {
          if (!onLoadCarListings) return;
          const next = await onLoadCarListings();
          setCarListings(next);
          return;
        }
        case 'car-services': {
          if (!onLoadCarServiceListings) return;
          const next = await onLoadCarServiceListings();
          setCarServiceListings(next);
          return;
        }
        case 'auto-tuning': {
          if (!onLoadAutoTuningListings) return;
          const next = await onLoadAutoTuningListings();
          setAutoTuningListings(next);
          return;
        }
        case 'consultations': {
          if (!onLoadConsultationExperts) return;
          const next = await onLoadConsultationExperts();
          setConsultationExperts(next);
          return;
        }
        case 'dry-cleaning': {
          if (!onLoadDryCleaningListings) return;
          const next = await onLoadDryCleaningListings();
          setDryCleaningListings(next);
          return;
        }
        default:
          return;
      }
    };

    const tick = async () => {
      if (moderationTickInFlight.current) return;
      moderationTickInFlight.current = true;

      try {
        const now = Date.now();
        const active = moderationQueue.filter((item) => now - item.startedAt < POLL_TIMEOUT_MS);
        if (active.length !== moderationQueue.length) {
          setModerationQueue(active);
          if (active.length === 0) return;
        }

        const kinds = Array.from(new Set(active.map((item) => item.kind)));
        const resolvedKeys = new Set<string>();
        const kindsToRefresh = new Set<string>();

        for (const kind of kinds) {
          const mineLoader = getMineLoader(kind);
          if (!mineLoader) continue;

          // eslint-disable-next-line no-await-in-loop
          const mine = await mineLoader({ mine: true }).catch(() => null);
          if (!Array.isArray(mine)) continue;

          const group = active.filter((item) => item.kind === kind);
          for (const item of group) {
            const found = mine.find((entry: any) => entry?.id === item.id);
            const status = String((found as any)?.moderationStatus || '').toLowerCase();

            if (status === 'approved') {
              resolvedKeys.add(`${kind}:${item.id}`);
              kindsToRefresh.add(kind);
              showMarketToast('Проверка завершена: объявление опубликовано.');
            } else if (status === 'rejected') {
              resolvedKeys.add(`${kind}:${item.id}`);
              showMarketToast('Объявление отклонено модерацией.');
            }
          }
        }

        if (kindsToRefresh.size > 0) {
          for (const kind of kindsToRefresh) {
            // eslint-disable-next-line no-await-in-loop
            await refreshPublicList(kind).catch(() => {});
          }
        }

        if (resolvedKeys.size > 0) {
          setModerationQueue((prev) => prev.filter((item) => !resolvedKeys.has(`${item.kind}:${item.id}`)));
        }
      } finally {
        moderationTickInFlight.current = false;
      }
    };

    void tick();
    const intervalId = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [
    moderationQueue,
    onLoadAutoTuningListings,
    onLoadCarListings,
    onLoadCarServiceListings,
    onLoadConsultationExperts,
    onLoadDryCleaningListings,
  ]);

  const handleConsultationPublish = async (expert: ConsultationExpertCreatePayload) => {
    try {
      if (onCreateConsultationExpert) {
        const created = await onCreateConsultationExpert(expert);
        const status = String((created as any)?.moderationStatus || '').toLowerCase();
        if (status === 'pending') {
          showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
          enqueueModerationTracking('consultations', created.id);
        } else {
          setConsultationExperts((prev) => [created, ...prev]);
        }
      } else {
        setConsultationExperts((prev) => {
          const nextId = prev.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
          const { avatarFile: _avatarFile, ...rest } = expert;
          return [{ ...rest, avatar: rest.avatar || '', id: nextId }, ...prev];
        });
      }

      setCurrentPage('consultations');
    } catch {
      showMarketToast('Не удалось опубликовать консультацию.');
    }
  };

  const handleCarServicePublish = async (service: CarServiceCreatePayload) => {
    try {
      if (onCreateCarServiceListing) {
        const created = await onCreateCarServiceListing(service);
        const status = String((created as any)?.moderationStatus || '').toLowerCase();
        if (status === 'pending') {
          showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
          enqueueModerationTracking('car-services', created.id);
        } else {
          setCarServiceListings((prev) => [created, ...prev]);
        }
      } else {
        try {
          const created = await marketAPI.createCarService(service);
          const status = String((created as any)?.moderationStatus || '').toLowerCase();
          if (status === 'pending') {
            showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
            enqueueModerationTracking('car-services', created.id);
          } else {
            setCarServiceListings((prev) => [created, ...prev]);
          }
          setCurrentPage('car-services');
          return;
        } catch (error) {
          showMarketToast((error as any)?.message || 'Backend unavailable; added locally.');
        }

        setCarServiceListings((prev) => {
          const nextId = prev.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
          const { imageFile: _imageFile, ...rest } = service;
          return [{ ...rest, image: rest.image || '', id: nextId }, ...prev];
        });
      }

      setCurrentPage('car-services');
    } catch {
      showMarketToast('Не удалось опубликовать автосервис.');
    }
  };

  const handleAutoTuningPublish = async (listing: AutoTuningCreatePayload) => {
    try {
      if (onCreateAutoTuningListing) {
        const created = await onCreateAutoTuningListing(listing);
        const status = String((created as any)?.moderationStatus || '').toLowerCase();
        if (status === 'pending') {
          showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
          enqueueModerationTracking('auto-tuning', created.id);
        } else {
          setAutoTuningListings((prev) => [created, ...prev]);
        }
      } else {
        try {
          const created = await marketAPI.createAutoTuning(listing);
          const status = String((created as any)?.moderationStatus || '').toLowerCase();
          if (status === 'pending') {
            showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
            enqueueModerationTracking('auto-tuning', created.id);
          } else {
            setAutoTuningListings((prev) => [created, ...prev]);
          }
          setCurrentPage('auto-tuning');
          return;
        } catch (error) {
          showMarketToast((error as any)?.message || 'Backend unavailable; added locally.');
        }

        setAutoTuningListings((prev) => {
          const nextId = prev.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
          const { imageFile: _imageFile, ...rest } = listing;
          return [{ ...rest, image: rest.image || '', id: nextId }, ...prev];
        });
      }

      setCurrentPage('auto-tuning');
    } catch {
      showMarketToast('Не удалось опубликовать автотюнинг.');
    }
  };

  const handleDryCleaningPublish = async (listing: DryCleaningCreatePayload) => {
    try {
      if (onCreateDryCleaningListing) {
        const created = await onCreateDryCleaningListing(listing);
        const status = String((created as any)?.moderationStatus || '').toLowerCase();
        if (status === 'pending') {
          showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
          enqueueModerationTracking('dry-cleaning', created.id);
        } else {
          setDryCleaningListings((prev) => [created, ...prev]);
        }
      } else {
        try {
          const created = await marketAPI.createDryCleaning(listing);
          const status = String((created as any)?.moderationStatus || '').toLowerCase();
          if (status === 'pending') {
            showMarketToast('Объявление отправлено на проверку. Появится в списке после модерации.');
            enqueueModerationTracking('dry-cleaning', created.id);
          } else {
            setDryCleaningListings((prev) => [created, ...prev]);
          }
          setCurrentPage('dry-cleaning');
          return;
        } catch (error) {
          showMarketToast((error as any)?.message || 'Backend unavailable; added locally.');
        }

        setDryCleaningListings((prev) => {
          const nextId = prev.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
          const { imageFile: _imageFile, ...rest } = listing;
          return [{ ...rest, image: rest.image || '', id: nextId }, ...prev];
        });
      }

      setCurrentPage('dry-cleaning');
    } catch {
      showMarketToast('Не удалось опубликовать химчистку.');
    }
  };

  const pageTransitionKey =
    currentPage === 'vehicle-details'
      ? `${currentPage}-${selectedVehicleType}-${catalogKey}`
      : currentPage === 'vehicle-view' && selectedCar
        ? `${currentPage}-${selectedCar.id}`
        : currentPage;

  const renderPageContent = () => {
    if (currentPage === 'home') {
      return (
        <>
          <Hero
            setCurrentPage={setCurrentPage}
            onQuickSearch={(payload) => {
              setVehicleQuickSearch(payload);
              setVehicleQuickSearchKey((prev) => prev + 1);
              handleVehicleSelect('Легковые автомобили');
              setCurrentPage('vehicle-details');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          />
          
          {/* New Ads Section */}
          <section className="pt-8 pb-8">
            <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
              <SectionHeader 
                onViewAll={() => {
                  handleVehicleSelect('Легковые автомобили');
                  setCurrentPage('vehicle-details');
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                title="Новые объявления" 
                subtitle={'Только что добавленные на рынок объявления'} 
              />
              <div className="sm:hidden -mx-4 px-4 overflow-x-auto scroll-smooth">
                <div className="flex gap-4 snap-x snap-mandatory scroll-px-4 pb-2">
                  {homeNewAds.map((car, index) => (
                    <div key={`new-m-${car.id}-${index}`} className="snap-start w-[85vw] max-w-[420px] min-w-[280px]">
                      <CarCard 
                        car={car} 
                        isCompared={compareList.some(i => i.id === car.id && i.type === 'car')} 
                        onToggleCompare={() => toggleCompare(car.id, 'car')} 
                        onClick={() => {
                          setSelectedCar(car);
                          setCurrentPage('vehicle-view');
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden sm:block relative">
                {homeNewAds.length > HOME_NEW_ADS_PAGE_SIZE && (
                  <>
                    {/* Full-bleed arrow zones so spacing is computed vs viewport edges */}
                    <div className="hidden md:block pointer-events-none absolute inset-0 left-1/2 -translate-x-1/2 w-screen z-10 md:[--home-arrow-zone:calc(max(0px,(100vw-1536px)/2)+88px)] lg:[--home-arrow-zone:calc(max(0px,(100vw-1536px)/2)+96px)]">
                      {homeNewAdsPage > 0 && (
                        <div className="absolute left-0 top-0 bottom-0 w-[var(--home-arrow-zone)] flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setHomeNewAdsDirection(-1);
                              setHomeNewAdsPage((prev) => Math.max(0, prev - 1));
                            }}
                            className="pointer-events-auto w-14 h-14 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Previous listings"
                          >
                            <ChevronLeft className="w-9 h-9" />
                          </button>
                        </div>
                      )}

                      {homeNewAdsPage < homeNewAdsMaxPage && (
                        <div className="absolute right-0 top-0 bottom-0 w-[var(--home-arrow-zone)] flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setHomeNewAdsDirection(1);
                              setHomeNewAdsPage((prev) => Math.min(homeNewAdsMaxPage, prev + 1));
                            }}
                            className="pointer-events-auto w-14 h-14 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Next listings"
                          >
                            <ChevronRight className="w-9 h-9" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={homeNewAdsPage}
                    initial={{ opacity: 0, x: homeNewAdsDirection * 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: homeNewAdsDirection * -24 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={`${
                      homeNewAds.length > HOME_NEW_ADS_PAGE_SIZE && homeNewAdsPage > 0 ? 'md:pl-16' : 'md:pl-0'
                    } ${
                      homeNewAds.length > HOME_NEW_ADS_PAGE_SIZE && homeNewAdsPage < homeNewAdsMaxPage ? 'md:pr-16' : 'md:pr-0'
                    }`}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      {homeNewAds
                        .slice(
                          homeNewAdsPage * HOME_NEW_ADS_PAGE_SIZE,
                          homeNewAdsPage * HOME_NEW_ADS_PAGE_SIZE + HOME_NEW_ADS_PAGE_SIZE
                        )
                        .map((car, index) => (
                          <CarCard 
                            key={`new-${car.id}-${index}`} 
                            car={car} 
                            isCompared={compareList.some(i => i.id === car.id && i.type === 'car')} 
                            onToggleCompare={() => toggleCompare(car.id, 'car')} 
                            onClick={() => {
                              setSelectedCar(car);
                              setCurrentPage('vehicle-view');
                            }}
                          />
                        ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="sm:hidden mt-4 flex justify-center">
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    handleVehicleSelect('Легковые автомобили');
                    setCurrentPage('vehicle-details');
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="text-[14px] font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                >
                  Посмотреть все <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </section>

          <section className="pb-8 overflow-hidden">
            <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
              <SectionHeader
                title="Топ услуги"
                subtitle="Профессиональные автомобильные услуги для вас"
                showArrows={false}
                onViewAll={() => {
                  setCurrentPage('car-services');
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              />

              <div className="sm:hidden -mx-4 px-4 overflow-x-auto scroll-smooth">
                <div className="flex gap-4 snap-x snap-mandatory scroll-px-4 pb-2">
                  {homeTopServices.map((service) => (
                    <div key={`svc-m-${service.id}`} className="snap-start w-[78vw] max-w-[380px] min-w-[260px]">
                      <ServiceCard
                        service={service}
                        isCompared={compareList.some((i) => i.id === service.id && i.type === 'service')}
                        onToggleCompare={() => toggleCompare(service.id, 'service')}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden sm:block relative">
                {homeTopServices.length > HOME_TOP_SERVICES_PAGE_SIZE && (
                  <div className="hidden md:block pointer-events-none absolute inset-0 left-1/2 -translate-x-1/2 w-screen z-10 md:[--home-services-arrow-zone:calc(max(0px,(100vw-1536px)/2)+88px)] lg:[--home-services-arrow-zone:calc(max(0px,(100vw-1536px)/2)+96px)]">
                    {homeTopServicesPage > 0 && (
                      <div className="absolute left-0 top-0 bottom-0 w-[var(--home-services-arrow-zone)] flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setHomeTopServicesDirection(-1);
                            setHomeTopServicesPage((prev) => Math.max(0, prev - 1));
                          }}
                          className="pointer-events-auto w-14 h-14 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="Previous services"
                        >
                          <ChevronLeft className="w-9 h-9" />
                        </button>
                      </div>
                    )}

                    {homeTopServicesPage < homeTopServicesMaxPage && (
                      <div className="absolute right-0 top-0 bottom-0 w-[var(--home-services-arrow-zone)] flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setHomeTopServicesDirection(1);
                            setHomeTopServicesPage((prev) => Math.min(homeTopServicesMaxPage, prev + 1));
                          }}
                          className="pointer-events-auto w-14 h-14 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="Next services"
                        >
                          <ChevronRight className="w-9 h-9" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={homeTopServicesPage}
                    initial={{ opacity: 0, x: homeTopServicesDirection * 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: homeTopServicesDirection * -24 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={`${homeTopServices.length > HOME_TOP_SERVICES_PAGE_SIZE && homeTopServicesPage > 0 ? 'md:pl-16' : 'md:pl-0'} ${
                      homeTopServices.length > HOME_TOP_SERVICES_PAGE_SIZE && homeTopServicesPage < homeTopServicesMaxPage ? 'md:pr-16' : 'md:pr-0'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {homeTopServices
                        .slice(
                          homeTopServicesPage * HOME_TOP_SERVICES_PAGE_SIZE,
                          homeTopServicesPage * HOME_TOP_SERVICES_PAGE_SIZE + HOME_TOP_SERVICES_PAGE_SIZE
                        )
                        .map((service) => (
                          <ServiceCard
                            key={`svc-${service.id}`}
                            service={service}
                            isCompared={compareList.some((i) => i.id === service.id && i.type === 'service')}
                            onToggleCompare={() => toggleCompare(service.id, 'service')}
                          />
                        ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="sm:hidden mt-4 flex justify-center">
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setCurrentPage('car-services');
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="text-[14px] font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                >
                  Посмотреть все <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </section>

          <section className="pb-8">
            <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
              <SectionHeader 
                title={<span className="flex items-center gap-2"><Sparkles className="w-6 h-6 text-gray-900" /> Рекомендации для тебя</span>}
                subtitle={'На основе ваших предпочтений и истории просмотров'} 
                onViewAll={() => {
                  handleVehicleSelect('Легковые автомобили');
                  setCurrentPage('vehicle-details');
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              />

              <div className="sm:hidden -mx-4 px-4 overflow-x-auto scroll-smooth">
                <div className="flex gap-4 snap-x snap-mandatory scroll-px-4 pb-2">
                  {homeRecommendations.map((car, index) => (
                    <div key={`rec-m-${car.id}-${index}`} className="snap-start w-[85vw] max-w-[420px] min-w-[280px]">
                      <CarCard
                        car={car}
                        isCompared={compareList.some((i) => i.id === car.id && i.type === 'car')}
                        onToggleCompare={() => toggleCompare(car.id, 'car')}
                        onClick={() => {
                          setSelectedCar(car);
                          setCurrentPage('vehicle-view');
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden sm:block relative">
                {homeRecommendations.length > HOME_RECOMMENDATIONS_PAGE_SIZE && (
                  <div className="hidden md:block pointer-events-none absolute inset-0 left-1/2 -translate-x-1/2 w-screen z-10 md:[--home-recs-arrow-zone:calc(max(0px,(100vw-1536px)/2)+88px)] lg:[--home-recs-arrow-zone:calc(max(0px,(100vw-1536px)/2)+96px)]">
                    {homeRecommendationsPage > 0 && (
                      <div className="absolute left-0 top-0 bottom-0 w-[var(--home-recs-arrow-zone)] flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setHomeRecommendationsDirection(-1);
                            setHomeRecommendationsPage((prev) => Math.max(0, prev - 1));
                          }}
                          className="pointer-events-auto w-14 h-14 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="Previous recommendations"
                        >
                          <ChevronLeft className="w-9 h-9" />
                        </button>
                      </div>
                    )}

                    {homeRecommendationsPage < homeRecommendationsMaxPage && (
                      <div className="absolute right-0 top-0 bottom-0 w-[var(--home-recs-arrow-zone)] flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setHomeRecommendationsDirection(1);
                            setHomeRecommendationsPage((prev) => Math.min(homeRecommendationsMaxPage, prev + 1));
                          }}
                          className="pointer-events-auto w-14 h-14 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="Next recommendations"
                        >
                          <ChevronRight className="w-9 h-9" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={homeRecommendationsPage}
                    initial={{ opacity: 0, x: homeRecommendationsDirection * 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: homeRecommendationsDirection * -24 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={`${
                      homeRecommendations.length > HOME_RECOMMENDATIONS_PAGE_SIZE && homeRecommendationsPage > 0 ? 'md:pl-16' : 'md:pl-0'
                    } ${
                      homeRecommendations.length > HOME_RECOMMENDATIONS_PAGE_SIZE && homeRecommendationsPage < homeRecommendationsMaxPage ? 'md:pr-16' : 'md:pr-0'
                    }`}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      {homeRecommendations
                        .slice(
                          homeRecommendationsPage * HOME_RECOMMENDATIONS_PAGE_SIZE,
                          homeRecommendationsPage * HOME_RECOMMENDATIONS_PAGE_SIZE + HOME_RECOMMENDATIONS_PAGE_SIZE
                        )
                        .map((car, index) => (
                          <CarCard
                            key={`rec-${car.id}-${index}`}
                            car={car}
                            isCompared={compareList.some((i) => i.id === car.id && i.type === 'car')}
                            onToggleCompare={() => toggleCompare(car.id, 'car')}
                            onClick={() => {
                              setSelectedCar(car);
                              setCurrentPage('vehicle-view');
                            }}
                          />
                        ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="sm:hidden mt-4 flex justify-center">
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    handleVehicleSelect('Легковые автомобили');
                    setCurrentPage('vehicle-details');
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="text-[14px] font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                >
                  Посмотреть все <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </section>

          <FeatureCards
            onOpenFeed={onOpenFeed}
            onOpenDrivingCourses={() => setCurrentPage('driving-courses')}
            onOpenKids={() => setCurrentPage('kids')}
          />
          <RequestBanner onSuccessNotification={refreshNotifications} />
        </>
      );
    }

	    if (currentPage === 'add-listing') {
	      return (
        <AddListingPage
          onBack={() => setCurrentPage('vehicle-details')}
          vehicleType={selectedVehicleType}
          planLimits={userData?.planLimits || null}
          effectivePlan={userData?.effectivePlan || userData?.plan || 'free'}
          onUpgradeClick={onOpenTariffs}
          onSubmit={handleCarListingPublish}
        />
	      );
	    }

	    if (currentPage === 'add-consultation') {
	      return (
	        <AddConsultationPage
	          onBack={() => setCurrentPage('consultations')}
	          onSubmit={handleConsultationPublish}
	          currentUserName={userData?.userName}
	        />
	      );
	    }

	    if (currentPage === 'add-car-service') {
	      return (
	        <AddCarServicePage
	          onBack={() => setCurrentPage('car-services')}
	          onSubmit={handleCarServicePublish}
	          currentUserName={userData?.userName}
	        />
	      );
	    }

	    if (currentPage === 'add-auto-tuning') {
	      return (
	        <AddAutoTuningPage
	          onBack={() => setCurrentPage('auto-tuning')}
	          onSubmit={handleAutoTuningPublish}
	          currentUserName={userData?.userName}
	        />
	      );
	    }

	    if (currentPage === 'add-dry-cleaning') {
	      return (
	        <AddDryCleaningPage
	          onBack={() => setCurrentPage('dry-cleaning')}
	          onSubmit={handleDryCleaningPublish}
	          currentUserName={userData?.userName}
	        />
	      );
	    }

    if (currentPage === 'admin') {
      return <AdminPage isAdmin={isAdmin} onBack={() => setCurrentPage('home')} />;
    }

    if (currentPage === 'vehicle-view' && selectedCar) {
      return (
        <VehicleListingView 
          car={selectedCar} 
          onBack={() => setCurrentPage('vehicle-details')} 
          compareList={compareList} 
          toggleCompare={toggleCompare} 
        />
      );
    }

	    if (currentPage === 'car-services') {
	      return (
	        <CarServicesPage
	          services={carServiceListings}
          compareList={compareList}
          toggleCompare={toggleCompare}
          onAddListingClick={() => setCurrentPage('add-car-service')}
          onOpenMyListings={() => setCurrentPage('settings-listings')}
          onLoadFiltered={(filters) => marketAPI.loadCarServices({ filters })}
        />
      );
    }

	    if (currentPage === 'kids') {
	      return <KidsPage initialTab={kidsInitialTab as any} />;
	    }

	    if (currentPage === 'games') {
	      return <GamesPage games={games} />;
	    }

    if (currentPage === 'consultations') {
      return (
        <ConsultationsPage
          experts={consultationExperts}
          compareList={compareList}
          toggleCompare={toggleCompare}
          onAddServiceClick={() => setCurrentPage('add-consultation')}
          onOpenMyListings={() => setCurrentPage('settings-listings')}
          onLoadFiltered={(filters) => marketAPI.loadConsultations({ filters })}
        />
      );
    }

    if (currentPage === 'eco-tips') {
      return <EcoTipsPage />;
    }

    if (currentPage === 'help-others') {
      return <HelpOthersPage />;
    }

    if (currentPage === 'driving-courses') {
      return <DrivingCoursesPage />;
    }

	    if (currentPage === 'auto-tuning') {
	      return (
	        <AutoTuningPage
	          listings={autoTuningListings}
	          onAddListingClick={() => setCurrentPage('add-auto-tuning')}
            onOpenMyListings={() => setCurrentPage('settings-listings')}
            onLoadFiltered={(filters) => marketAPI.loadAutoTuning({ filters })}
	        />
	      );
	    }

	    if (currentPage === 'dry-cleaning') {
	      return (
	        <DryCleaningPage
	          listings={dryCleaningListings}
	          onAddListingClick={() => setCurrentPage('add-dry-cleaning')}
          onLoadFiltered={(filters) => marketAPI.loadDryCleaning({ filters })}
	        />
	      );
	    }

    if (currentPage === 'settings') {
      return (
        <SettingsPage
          onOpenTariffs={() => setCurrentPage('tariffs')}
          onOpenPaymentHistory={() => setCurrentPage('payment-history')}
          onOpenAnalytics={() => setCurrentPage('market-analytics')}
          onOpenSection={(section) => setCurrentPage(section)}
          userData={effectiveUserData}
          onPlanChanged={(plan, extras) => handleUserDataChange({
            plan,
            effectivePlan: extras?.effectivePlan,
            planLimits: extras?.planLimits,
            planExpiresAt: extras?.planExpiresAt,
          })}
        />
      );
    }

    if (currentPage === 'payment-history') {
      return (
        <PaymentHistoryPage
          onBack={() => setCurrentPage('settings')}
          onOpenTariffs={() => setCurrentPage('tariffs')}
        />
      );
    }

    if (currentPage === 'market-analytics') {
      return (
        <MarketAnalyticsPage
          onBack={() => setCurrentPage('settings')}
          onOpenTariffs={() => setCurrentPage('tariffs')}
        />
      );
    }

    if (
      currentPage === 'settings-main-info' ||
      currentPage === 'settings-personal-data' ||
      currentPage === 'settings-security' ||
      currentPage === 'settings-listings'
    ) {
      return (
        <SettingsDetailPage
          section={currentPage}
          onBack={() => setCurrentPage('settings')}
          userData={effectiveUserData}
          onUserDataChange={handleUserDataChange}
        />
      );
    }

    if (currentPage === 'tariffs') {
      return (
        <TariffsPage
          onBack={() => setCurrentPage('settings')}
          currentPlan={effectiveUserData?.plan || 'free'}
          onPlanChanged={(plan, extras) => handleUserDataChange({
            plan,
            effectivePlan: extras?.effectivePlan,
            planLimits: extras?.planLimits,
            planExpiresAt: extras?.planExpiresAt,
          })}
          onSelectPaidPlan={(plan) => {
            setPendingPaymentPlan(plan);
            setCurrentPage('payment');
          }}
        />
      );
    }

    if (currentPage === 'payment' && pendingPaymentPlan) {
      return (
        <PaymentPage
          plan={pendingPaymentPlan}
          onBack={() => {
            setPendingPaymentPlan(null);
            setCurrentPage('tariffs');
          }}
          onSuccess={(plan, extras) => {
            handleUserDataChange({
              plan,
              effectivePlan: extras?.effectivePlan,
              planLimits: extras?.planLimits,
              planExpiresAt: extras?.planExpiresAt,
            });
            setPendingPaymentPlan(null);
            setCurrentPage('settings');
          }}
        />
      );
    }

    if (currentPage === 'terms') {
      return <TermsOfServicePage onBack={() => setCurrentPage('home')} />;
    }

    if (currentPage === 'privacy') {
      return <PrivacyPolicyPage onBack={() => setCurrentPage('home')} />;
    }

    if (currentPage === 'cookies') {
      return <CookiePolicyPage onBack={() => setCurrentPage('home')} />;
    }

    if (currentPage === 'compare') {
      return <ComparePage setCurrentPage={setCurrentPage} compareList={compareList} toggleCompare={toggleCompare} allCars={[...carListings, ...partsListings]} allServices={homeTopServices} />;
    }

      const listingsForCatalog = selectedVehicleType === 'Автозапчасти' ? partsListings : carListings;

	    return (
	      <VehicleDetailsPage
	        key={`${catalogKey}-${vehicleQuickSearchKey}`}
	        vehicleType={selectedVehicleType}
	        cars={listingsForCatalog}
          initialSearch={vehicleQuickSearch ?? undefined}
	        compareList={compareList}
	        toggleCompare={toggleCompare}
	        setCurrentPage={setCurrentPage}
	        onCarClick={(car) => {
	          setSelectedCar(car);
          setCurrentPage('vehicle-view');
        }}
        onLoadFilteredCars={(filters) => marketAPI.loadCars({ filters })}
        onLoadFilteredParts={(filters) => marketAPI.loadParts({ filters })}
      />
    );
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {currentPage !== 'add-listing' &&
        currentPage !== 'add-consultation' &&
        currentPage !== 'add-car-service' &&
        currentPage !== 'add-auto-tuning' &&
        currentPage !== 'add-dry-cleaning' && (
        <Header 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage} 
          setSelectedVehicleType={handleVehicleSelect}
          selectedVehicleType={selectedVehicleType}
          compareCount={compareList.length}
          onLogoClick={handleLogoClick}
          notifications={notifications}
          unreadNotificationsCount={unreadNotificationsCount}
          onNotificationRead={handleNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onNotificationsMenuOpen={refreshNotifications}
          userData={effectiveUserData}
          onOpenFeed={onOpenFeed}
          onOpenReels={onOpenReels}
          onOpenProfile={onOpenProfile}
          onOpenTariffs={() => {
            setCurrentPage('settings');
            onOpenTariffs?.();
          }}
          onOpenAdmin={onOpenAdmin}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          isAdmin={isAdmin}
          onResendVerification={onResendVerification}
          onOpenKidsTab={(tab) => {
            setKidsInitialTab(tab);
            setCurrentPage('kids');
          }}
        />
      )}

      <AnimatePresence>
        {logoTransition && (
          <motion.div
            key={logoTransition.id}
            className="pointer-events-none fixed inset-0 z-[120]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <motion.div
              className="absolute rounded-full"
              style={{
                left: logoTransition.left,
                top: logoTransition.top,
                width: logoTransition.diameter,
                height: logoTransition.diameter,
                background:
                  'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.10), rgba(0,0,0,1) 58%, rgba(0,0,0,1) 100%)',
                boxShadow: '0 38px 120px rgba(0,0,0,0.55)',
                willChange: 'transform, opacity',
              }}
              initial={{ scale: 0.04, opacity: 0.0 }}
              animate={
                logoTransition.phase === 'cover' ? { scale: 1, opacity: 1 } : { scale: 1.06, opacity: 0 }
              }
              transition={
                logoTransition.phase === 'cover'
                  ? { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
                  : { duration: 0.58, ease: [0.16, 1, 0.3, 1] }
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
      
       <main className="relative min-h-[60vh]">
         <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-[13px] font-semibold text-gray-500">Загрузка раздела...</div>}>
           <AnimatePresence mode="wait" initial={false}>
             <motion.div
               key={pageTransitionKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
             >
               {renderPageContent()}
             </motion.div>
           </AnimatePresence>
         </Suspense>
       </main>

      <AnimatePresence>
        {activeToast && (
          <motion.div
            key={activeToast.id}
            initial={{ opacity: 0, x: 24, y: -12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 24, y: -12 }}
            transition={{ duration: 0.22 }}
            className="fixed right-4 top-4 z-[140] w-[min(92vw,380px)]"
          >
            <div className="rounded-[24px] border border-red-100 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-gray-900">Пользователь не найден</div>
                  <div className="mt-1 text-[13px] leading-5 text-gray-500">{activeToast.message}</div>
                </div>
                <button
                  onClick={() => setActiveToast(null)}
                  className="rounded-full p-1 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-500"
                  aria-label="Закрыть уведомление"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {currentPage !== 'add-listing' && currentPage !== 'add-consultation' && currentPage !== 'add-car-service' && currentPage !== 'add-auto-tuning' && currentPage !== 'add-dry-cleaning' && <Footer onNavigate={setCurrentPage} />}
    </div>
  );
}
