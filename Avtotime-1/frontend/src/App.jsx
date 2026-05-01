import React, { Suspense, lazy, useEffect, useRef } from "react";
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";

import useGetCurrentUser from "./hooks/getCurrentUser";
import useGetSuggestedUsers from "./hooks/getSuggestedUsers";
import useGetAllPost from "./hooks/getAllPost";
import useGetAllLoops from "./hooks/getAllLoops";
import { FaGrinBeamSweat } from "react-icons/fa";
import { RxAlignCenterHorizontally } from "react-icons/rx";
import getAllStories from "./hooks/getAllStories";
import { io } from 'socket.io-client';
import { setOnlineUsers } from "./redux/socketSlise";
import PageTransition from "./components/layout/PageTransition";
import useNotifications from "./hooks/useNotifications";
import { prependNotification } from "./redux/notificationSlice";
import LogoBridgeTransition from "./components/common/LogoBridgeTransition";
import Nav from "./components/layout/Nav";

const lazyWithPreload = (factory) => {
  const Component = lazy(factory);
  Component.preload = factory;
  return Component;
};

const SignUp = lazyWithPreload(() => import("./pages/SignUp"));
const SignIn = lazyWithPreload(() => import("./pages/SignIn"));
const ForgotPassword = lazyWithPreload(() => import("./pages/ForgotPassword"));
const AppChoice = lazyWithPreload(() => import("./pages/AppChoice"));
const AutoMarketPage = lazyWithPreload(() => import("./pages/AutoMarketPage"));
const Home = lazyWithPreload(() => import("./pages/Home"));
const Profile = lazyWithPreload(() => import("./pages/Profile"));
const EditProfile = lazyWithPreload(() => import("./pages/EditProfile"));
const Upload = lazyWithPreload(() => import("./pages/Upload"));
const Loops = lazyWithPreload(() => import("./pages/Loops"));
const Search = lazyWithPreload(() => import("./pages/Search"));
const Story = lazyWithPreload(() => import("./pages/Story"));
const Messages = lazyWithPreload(() => import("./pages/Messages"));
const MessageArea = lazyWithPreload(() => import("./pages/MessagesArea"));
const Notifications = lazyWithPreload(() => import("./pages/Notifications"));
const AdminMarketPage = lazyWithPreload(() => import("./pages/AdminMarketPage"));
const NotFound = lazyWithPreload(() => import("./pages/NotFound"));
const VerifyEmail = lazyWithPreload(() => import("./pages/VerifyEmail"));
const PrivacyPolicy = lazyWithPreload(() => import("./pages/PrivacyPolicy"));

const normalizeServerUrl = (raw) => {
  const fallback = typeof window !== "undefined" ? window.location.origin : "http://localhost:8000";
  if (typeof raw !== "string") return fallback;

  let value = raw.trim();
  if (!value) return fallback;

  // Some envs are configured as ":8000" (port only) вЂ” normalize to an origin.
  if (value.startsWith(":")) value = `http://localhost${value}`;
  if (/^\d+$/.test(value)) value = `http://localhost:${value}`;

  // Remove trailing slashes and accidental "/api" suffix (we append "/api" in requests).
  value = value.replace(/\/+$/, "");
  value = value.replace(/\/api$/, "");

  // If a user provided "localhost:8000" (without protocol), add it.
  if (!/^https?:\/\//i.test(value) && /^[\w.-]+:\d+/.test(value)) {
    value = `http://${value}`;
  }

  return value || fallback;
};

export const serverURL = normalizeServerUrl(import.meta.env.VITE_API_URL);

const RouteLoader = () => (
  <div className="pointer-events-none fixed inset-x-0 top-0 z-[120]">
    <div className="h-[2px] w-full overflow-hidden bg-white/5">
      <div className="route-loader-bar h-full w-[34%] bg-gradient-to-r from-transparent via-white/85 to-transparent" />
    </div>
  </div>
);

function App() {
  const location = useLocation();
  const transition = location?.state?.transition;

  useGetCurrentUser();
  useGetSuggestedUsers();
  useGetAllPost();
  useGetAllLoops();
  getAllStories();
  useNotifications();

  const { userData } = useSelector(state => state.user);
  const socketRef = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const authPreloaders = [
      AppChoice,
      Home,
      Profile,
      EditProfile,
      Upload,
      Loops,
      Search,
      Story,
      Messages,
      MessageArea,
      Notifications,
      PrivacyPolicy,
      VerifyEmail,
      NotFound,
    ];

    const guestPreloaders = [
      SignIn,
      SignUp,
      ForgotPassword,
      PrivacyPolicy,
      VerifyEmail,
      NotFound,
    ];

    const targets = (userData ? authPreloaders : guestPreloaders)
      .map((item) => item?.preload)
      .filter(Boolean);

    const preload = () => {
      targets.forEach((load) => {
        try {
          load();
        } catch (error) {
          console.log("Route preload skipped:", error);
        }
      });
    };

    const idleId = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(preload, { timeout: 1200 })
      : window.setTimeout(preload, 250);

    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
        return;
      }
      window.clearTimeout(idleId);
    };
  }, [userData]);

  useEffect(() => {
    if (userData) {
      socketRef.current?.close();

      const socketIo = io(serverURL, {
        withCredentials: true,
      });
      socketRef.current = socketIo;

      socketIo.on('getOnlineUsers', (users) => {
        dispatch(setOnlineUsers(users));
      });

      socketIo.on("notification", (notification) => {
        dispatch(prependNotification(notification));
      });

      return () => {
        socketIo.close();
        if (socketRef.current === socketIo) {
          socketRef.current = null;
        }
      };
    }

    socketRef.current?.close();
    socketRef.current = null;
    dispatch(setOnlineUsers([]));
  }, [dispatch, userData]);

  const showNav = userData && [
    '/', '/upload', '/loops',
  ].some(p => location.pathname === p) ||
    (userData && (
      location.pathname.startsWith('/profile/') ||
      location.pathname.startsWith('/search/')
    ))

  return (
    <>
      <LogoBridgeTransition />
      {showNav && <Nav />}
      <PageTransition transition={transition} key={location.pathname}>
        <Suspense fallback={<RouteLoader />}>
          <Routes location={location}>
            <Route path='/signup' element={!userData ? <SignUp /> : <Navigate to="/choose-app" />} />
            <Route path='/signin' element={!userData ? <SignIn /> : <Navigate to="/choose-app" />} />
            <Route path='/choose-app' element={userData ? <AppChoice /> : <Navigate to="/signin" />} />
            <Route path='/market' element={userData ? <AutoMarketPage /> : <Navigate to="/signin" />} />
            <Route path='/' element={userData ? <Home /> : <Navigate to="/signin" />} />
            <Route path='/forgot-password' element={!userData ? <ForgotPassword /> : <Navigate to="/" />} />
            <Route path='/notifications' element={userData ? <Notifications /> : <Navigate to="/signin" />} />
            <Route path='/editprofile' element={userData ? <EditProfile /> : <Navigate to="/signin" />} />
            <Route path='/profile/:userName' element={userData ? <Profile /> : <Navigate to="/signin" />} />
            <Route path='/profile/:userName/loops' element={userData ? <Profile /> : <Navigate to="/signin" />} />
            <Route path='/story/:userName' element={userData ? <Story /> : <Navigate to="/signin" />} />
            <Route path='/upload' element={userData ? <Upload /> : <Navigate to="/signin" />} />
            <Route path='/loops' element={userData ? <Loops /> : <Navigate to="/signin" />} />
            <Route path='/search' element={userData ? <Navigate to="/search/posts" replace /> : <Navigate to="/signin" />} />
            <Route path='/search/posts' element={userData ? <Search initialTab="posts" /> : <Navigate to="/signin" />} />
            <Route path='/search/users' element={userData ? <Search initialTab="users" /> : <Navigate to="/signin" />} />
            <Route path='/messages' element={userData ? <Messages /> : <Navigate to="/signin" />} />
            <Route path='/messagesArea' element={userData ? <MessageArea /> : <Navigate to="/signin" />} />
            <Route path='/admin' element={userData ? <AdminMarketPage /> : <Navigate to="/signin" />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PageTransition>
    </>
  );
}

export default App;
