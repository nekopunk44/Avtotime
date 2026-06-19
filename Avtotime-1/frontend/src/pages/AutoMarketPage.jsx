import React, { Suspense, lazy, Component } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { serverURL } from "../App";
import { setUserData } from "../redux/userSlice";

const MarketApp = lazy(() => import("../../../../frontend_market/src/App.tsx"));

class MarketErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff', color: '#c00', minHeight: '100vh' }}>
          <h2>Market Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#666', marginTop: 12 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_PUBLIC_MARKET_LIMIT = 60;
const DEFAULT_MINE_MARKET_LIMIT = 200;

const buildMarketListParams = (options = {}) =>
  options?.mine ? { mine: true, limit: DEFAULT_MINE_MARKET_LIMIT } : { limit: DEFAULT_PUBLIC_MARKET_LIMIT };

const ensureMarketApiUrl = () => {
  if (typeof window === "undefined") return;
  if (typeof window.__MARKET_API_URL__ === "string" && window.__MARKET_API_URL__) return;
  const origin = String(serverURL || "").replace(/\/+$/, "");
  window.__MARKET_API_URL__ = `${origin}/api`;
};

export default function AutoMarketPage() {
  ensureMarketApiUrl();
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleOpenFeed = () => {
    navigate("/", { state: { transition: "market-to-social" } });
  };

  const handleOpenReels = () => {
    navigate("/loops", { state: { transition: "market-to-social" } });
  };

  const handleOpenProfile = () => {
    if (!userData?.userName) {
      return;
    }

    navigate(`/profile/${userData.userName}`, { state: { transition: "market-to-social" } });
  };

  const handleOpenUserProfile = (userName) => {
    if (!userName) {
      return;
    }

    navigate(`/profile/${userName}`, { state: { transition: "market-to-social" } });
  };

  const handleCheckUserExists = async (userName) => {
    if (!userName) {
      return false;
    }

    try {
      await axios.get(`${serverURL}/api/user/getProfile/${encodeURIComponent(userName)}`, {
        withCredentials: true,
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleOpenTariffs = () => {
    navigate("/market?view=tariffs");
  };

  const handleOpenAdmin = () => {
    navigate("/admin", { state: { transition: "market-to-social" } });
  };

  const handleLoadCarServiceListings = async (options = {}) => {
    const { data } = await axios.get(`${serverURL}/api/market/car-services`, {
      withCredentials: true,
      params: buildMarketListParams(options),
    });
    return data;
  };

  const handleCreateCarServiceListing = async (service) => {
    if (service?.imageFile) {
      const formData = new FormData();
      formData.append("image", service.imageFile);

      Object.entries(service || {}).forEach(([key, value]) => {
        if (key === "imageFile") return;
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });

      const { data } = await axios.post(`${serverURL}/api/market/car-services`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    }

    const { imageFile: _imageFile, ...rest } = service || {};
    const { data } = await axios.post(`${serverURL}/api/market/car-services`, rest, { withCredentials: true });
    return data;
  };

  const handleLoadAutoTuningListings = async (options = {}) => {
    const { data } = await axios.get(`${serverURL}/api/market/auto-tuning`, {
      withCredentials: true,
      params: buildMarketListParams(options),
    });
    return data;
  };

  const handleCreateAutoTuningListing = async (listing) => {
    if (listing?.imageFile) {
      const formData = new FormData();
      formData.append("image", listing.imageFile);

      Object.entries(listing || {}).forEach(([key, value]) => {
        if (key === "imageFile") return;
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });

      const { data } = await axios.post(`${serverURL}/api/market/auto-tuning`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    }

    const { imageFile: _imageFile, ...rest } = listing || {};
    const { data } = await axios.post(`${serverURL}/api/market/auto-tuning`, rest, { withCredentials: true });
    return data;
  };

  const handleLoadConsultationExperts = async (options = {}) => {
    const { data } = await axios.get(`${serverURL}/api/market/consultations`, {
      withCredentials: true,
      params: buildMarketListParams(options),
    });
    return data;
  };

  const handleCreateConsultationExpert = async (expert) => {
    if (expert?.avatarFile) {
      const formData = new FormData();
      formData.append("avatar", expert.avatarFile);

      Object.entries(expert || {}).forEach(([key, value]) => {
        if (key === "avatarFile") return;
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });

      const { data } = await axios.post(`${serverURL}/api/market/consultations`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    }

    const { avatarFile: _avatarFile, ...rest } = expert || {};
    const { data } = await axios.post(`${serverURL}/api/market/consultations`, rest, { withCredentials: true });
    return data;
  };

  const handleLoadCarListings = async (options = {}) => {
    const { data } = await axios.get(`${serverURL}/api/market/cars`, {
      withCredentials: true,
      params: buildMarketListParams(options),
    });
    return data;
  };

  const handleCreateCarListing = async (listing) => {
    const formData = new FormData();

    Object.entries(listing || {}).forEach(([key, value]) => {
      if (key === "images") {
        return;
      }

      if (value === undefined || value === null) {
        return;
      }

      formData.append(key, String(value));
    });

    const images = Array.isArray(listing?.images) ? listing.images : [];
    images.forEach((file) => {
      if (file) {
        formData.append("images", file);
      }
    });

    if (images.length === 0 && !listing?.image) {
      formData.append(
        "image",
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=1200&auto=format&fit=crop",
      );
    }

    const { data } = await axios.post(`${serverURL}/api/market/cars`, formData, {
      withCredentials: true,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  };

  const handleLoadDryCleaningListings = async (options = {}) => {
    const { data } = await axios.get(`${serverURL}/api/market/dry-cleaning`, {
      withCredentials: true,
      params: buildMarketListParams(options),
    });
    return data;
  };

  const handleCreateDryCleaningListing = async (listing) => {
    if (listing?.imageFile) {
      const formData = new FormData();
      formData.append("image", listing.imageFile);

      Object.entries(listing || {}).forEach(([key, value]) => {
        if (key === "imageFile") return;
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });

      const { data } = await axios.post(`${serverURL}/api/market/dry-cleaning`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    }

    const { imageFile: _imageFile, ...rest } = listing || {};
    const { data } = await axios.post(`${serverURL}/api/market/dry-cleaning`, rest, { withCredentials: true });
    return data;
  };

  const handleLoadGames = async () => {
    const { data } = await axios.get(`${serverURL}/api/market/games`, {
      withCredentials: true,
    });
    return data;
  };

  const handleLoadCompareState = async () => {
    const { data } = await axios.get(`${serverURL}/api/market/compare`, {
      withCredentials: true,
    });
    return data;
  };

  const handleSaveCompareState = async (items) => {
    await axios.put(
      `${serverURL}/api/market/compare`,
      { items },
      {
        withCredentials: true,
      },
    );
  };

  const handleSignOut = async () => {
    try {
      await axios.get(`${serverURL}/api/auth/signout`, { withCredentials: true });
    } catch (error) {
      console.error("Error signing out from market:", error);
    } finally {
      dispatch(setUserData(null));
      navigate("/signin");
    }
  };

  const handleResendVerification = async () => {
    await axios.post(`${serverURL}/api/auth/resend-verification`, {}, { withCredentials: true });
  };

  return (
    <MarketErrorBoundary>
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white text-sm uppercase tracking-[0.24em] text-white/70">Loading</div>}>
      <MarketApp
        userData={userData}
        onOpenFeed={handleOpenFeed}
        onOpenReels={handleOpenReels}
        onOpenProfile={handleOpenProfile}
        onOpenUserProfile={handleOpenUserProfile}
        onOpenTariffs={handleOpenTariffs}
        onOpenAdmin={handleOpenAdmin}
        onCheckUserExists={handleCheckUserExists}
        onLoadCarListings={handleLoadCarListings}
        onCreateCarListing={handleCreateCarListing}
        onLoadCarServiceListings={handleLoadCarServiceListings}
        onCreateCarServiceListing={handleCreateCarServiceListing}
        onLoadAutoTuningListings={handleLoadAutoTuningListings}
        onCreateAutoTuningListing={handleCreateAutoTuningListing}
        onLoadConsultationExperts={handleLoadConsultationExperts}
        onCreateConsultationExpert={handleCreateConsultationExpert}
        onLoadDryCleaningListings={handleLoadDryCleaningListings}
        onCreateDryCleaningListing={handleCreateDryCleaningListing}
        onLoadGames={handleLoadGames}
        onLoadCompareState={handleLoadCompareState}
        onSaveCompareState={handleSaveCompareState}
        onSignOut={handleSignOut}
        onResendVerification={handleResendVerification}
      />
    </Suspense>
    </MarketErrorBoundary>
  );
}
