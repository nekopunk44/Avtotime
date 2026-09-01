import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from "react-redux";

import useGetCurrentUser from "./hooks/useGetCurrentUser";
import useGetSuggestedUsers from "./hooks/useGetSuggestedUsers";
import useGetAllPost from "./hooks/useGetAllPost";
import useGetAllLoops from "./hooks/useGetAllLoops";
import useGetAllStories from "./hooks/useGetAllStories";
import useNotifications from "./hooks/useNotifications";
import PageTransition from "./components/layout/PageTransition";
import LogoBridgeTransition from "./components/common/LogoBridgeTransition";
import Nav from "./components/layout/Nav";
import { AUTH_STATUS } from "./redux/userSlice";

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

const RouteLoader = () => (
  <div className="pointer-events-none fixed inset-x-0 top-0 z-[120]">
    <div className="h-[2px] w-full overflow-hidden bg-white/5">
      <div className="route-loader-bar h-full w-[34%] bg-gradient-to-r from-transparent via-white/85 to-transparent" />
    </div>
  </div>
);

const AuthSplash = () => (
  <div className="w-full min-h-[100vh] bg-black flex items-center justify-center">
    <div className="flex flex-col items-center gap-[16px]">
      <div className="w-[42px] h-[42px] rounded-full border-2 border-white/15 border-t-white animate-spin" />
      <div className="text-gray-500 text-[13px]">Загрузка…</div>
    </div>
  </div>
);

// Routes must not decide anything until the session request has resolved,
// otherwise a page reload redirects to /signin (then /choose-app) before the
// httpOnly cookie has been exchanged for a user.
function RequireAuth({ children }) {
  const userData = useSelector((state) => state.user.userData);
  const location = useLocation();

  if (!userData) {
    return <Navigate to="/signin" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

function RequireGuest({ children, redirectTo = "/choose-app" }) {
  const userData = useSelector((state) => state.user.userData);

  if (userData) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

function App() {
  const location = useLocation();
  const transition = location?.state?.transition;

  useGetCurrentUser();
  useGetSuggestedUsers();
  useGetAllPost();
  useGetAllLoops();
  useGetAllStories();
  useNotifications();

  const userData = useSelector(state => state.user.userData);
  const authStatus = useSelector(state => state.user.authStatus);
  const { selectedUser } = useSelector(state => state.message);

  const isAuthResolved = authStatus === AUTH_STATUS.AUTHENTICATED || authStatus === AUTH_STATUS.ANONYMOUS;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!isAuthResolved) return undefined;

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

    const targets = (authStatus === AUTH_STATUS.AUTHENTICATED ? authPreloaders : guestPreloaders)
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
  }, [authStatus, isAuthResolved]);

  const showNav = Boolean(userData) && !selectedUser && (
    ['/', '/upload', '/loops'].includes(location.pathname) ||
    location.pathname.startsWith('/profile/') ||
    location.pathname.startsWith('/search/')
  )

  if (!isAuthResolved) {
    return <AuthSplash />;
  }

  return (
    <>
      <LogoBridgeTransition />
      {showNav && <Nav />}
      <PageTransition transition={transition} key={location.pathname}>
        <Suspense fallback={<RouteLoader />}>
          <Routes location={location}>
            <Route path='/signup' element={<RequireGuest><SignUp /></RequireGuest>} />
            <Route path='/signin' element={<RequireGuest><SignIn /></RequireGuest>} />
            <Route path='/forgot-password' element={<RequireGuest redirectTo="/"><ForgotPassword /></RequireGuest>} />
            <Route path='/choose-app' element={<RequireAuth><AppChoice /></RequireAuth>} />
            <Route path='/market' element={<RequireAuth><AutoMarketPage /></RequireAuth>} />
            <Route path='/' element={<RequireAuth><Home /></RequireAuth>} />
            <Route path='/notifications' element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path='/editprofile' element={<RequireAuth><EditProfile /></RequireAuth>} />
            <Route path='/profile/:userName' element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path='/profile/:userName/loops' element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path='/story/:userName' element={<RequireAuth><Story /></RequireAuth>} />
            <Route path='/upload' element={<RequireAuth><Upload /></RequireAuth>} />
            <Route path='/loops' element={<RequireAuth><Loops /></RequireAuth>} />
            <Route path='/search' element={<RequireAuth><Navigate to="/search/posts" replace /></RequireAuth>} />
            <Route path='/search/posts' element={<RequireAuth><Search initialTab="posts" /></RequireAuth>} />
            <Route path='/search/users' element={<RequireAuth><Search initialTab="users" /></RequireAuth>} />
            <Route path='/messages' element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path='/messagesArea' element={<RequireAuth><MessageArea /></RequireAuth>} />
            <Route path='/admin' element={<RequireAuth><AdminMarketPage /></RequireAuth>} />
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
