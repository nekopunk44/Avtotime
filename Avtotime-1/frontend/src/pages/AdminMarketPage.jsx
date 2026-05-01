import React, { Suspense, lazy, useEffect, useState } from "react";
import axios from "axios";
import { Navigate, useNavigate } from "react-router-dom";

import { serverURL } from "../App";

const AdminPage = lazy(() =>
  import("../../../../frontend_market/src/components/pages/AdminPage.tsx").then((module) => ({
    default: module.AdminPage,
  })),
);

export default function AdminMarketPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const origin = String(serverURL || "").replace(/\/+$/, "");
    window.__MARKET_API_URL__ = `${origin}/api`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    axios
      .get(`${serverURL}/api/admin/status`, { withCredentials: true })
      .then(({ data }) => {
        if (cancelled) return;
        setIsAdmin(Boolean(data?.isAdmin));
        setCurrentUserId(data?.userId);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043f\u0440\u0430\u0432\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430";
        setError(String(message));
        setIsAdmin(false);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isLoading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="w-full min-h-[100vh] flex items-center justify-center bg-gray-50">
        <div className="text-gray-700 text-[14px] font-semibold">
          {"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..."}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-[100vh] flex flex-col items-center justify-center bg-gray-50 px-6">
        <div className="text-gray-900 text-[14px] font-semibold text-center">{error}</div>
        <button
          className="mt-4 px-5 py-3 rounded-xl bg-black text-white text-[13px] font-semibold"
          onClick={() => navigate("/market")}
        >
          {"\u0412\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u0432 \u043c\u0430\u0440\u043a\u0435\u0442"}
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="w-full min-h-[100vh] flex items-center justify-center bg-gray-50"><div className="text-gray-700 text-[14px] font-semibold">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..."}</div></div>}>
      <AdminPage isAdmin={isAdmin} onBack={() => navigate("/market")} currentUserId={currentUserId} />
    </Suspense>
  );
}
