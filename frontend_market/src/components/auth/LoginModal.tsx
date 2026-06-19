import React, { useEffect, useRef, useState } from 'react';
import { X, Mail, Lock, User, AtSign, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../../utils/config';

type Mode = 'login' | 'register';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (userData: any) => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const loadGoogleScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts) { resolve(); return; }
    const existing = document.getElementById('google-gsi');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id = 'google-gsi';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<Mode>('login');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleInitialized = useRef(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMode('login');
      setIdentifier('');
      setLoginPassword('');
      setRegName('');
      setRegUsername('');
      setRegEmail('');
      setRegPassword('');
      setError('');
      setShowPassword(false);
      googleInitialized.current = false;
    }
  }, [isOpen]);

  // Load & render Google button
  useEffect(() => {
    if (!isOpen || !GOOGLE_CLIENT_ID || googleInitialized.current) return;

    loadGoogleScript()
      .then(() => {
        if (!googleBtnRef.current || googleInitialized.current) return;
        googleInitialized.current = true;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: { credential: string }) => {
            setError('');
            setLoading(true);
            try {
              const res = await fetch(`${API_URL}/auth/google`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
              });
              const data = await res.json();
              if (!res.ok) { setError(data.message || 'Ошибка входа через Google'); return; }
              onSuccess?.(data);
              onClose();
            } catch {
              setError('Ошибка соединения. Попробуйте ещё раз.');
            } finally {
              setLoading(false);
            }
          },
          ux_mode: 'popup',
        });

        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: googleBtnRef.current.offsetWidth || 380,
          locale: 'ru',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
        });
      })
      .catch(() => { /* Google SDK failed to load — button stays invisible */ });
  }, [isOpen, mode, onClose, onSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !loginPassword) { setError('Заполните все поля'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Неверный логин или пароль'); return; }
      onSuccess?.(data);
      onClose();
    } catch {
      setError('Ошибка соединения. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regUsername.trim() || !regEmail.trim() || !regPassword) {
      setError('Заполните все поля');
      return;
    }
    if (regPassword.length < 8) { setError('Пароль должен быть не короче 8 символов'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          userName: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Ошибка регистрации'); return; }
      onSuccess?.(data);
      onClose();
    } catch {
      setError('Ошибка соединения. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setShowPassword(false);
    googleInitialized.current = false;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-[460px] bg-white rounded-[32px] shadow-2xl overflow-hidden"
        >
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute right-5 top-5 p-2 text-gray-400 hover:text-gray-900 transition-colors z-10 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-7 flex flex-col items-center">
            {/* Logo */}
            <div className="mb-3">
              <img
                src="/logo.png"
                alt="AVTOTIME"
                className="h-16 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const span = document.createElement('span');
                  span.className = 'font-black text-2xl tracking-tighter italic text-gray-900';
                  span.innerText = 'AVTOTIME';
                  e.currentTarget.parentNode?.appendChild(span);
                }}
              />
            </div>

            {/* Mode tabs */}
            <div className="w-full flex rounded-2xl bg-gray-100 p-1 mb-6">
              <button
                onClick={() => switchMode('login')}
                disabled={loading}
                className={[
                  'flex-1 py-2 text-sm font-bold rounded-xl transition-all',
                  mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                Войти
              </button>
              <button
                onClick={() => switchMode('register')}
                disabled={loading}
                className={[
                  'flex-1 py-2 text-sm font-bold rounded-xl transition-all',
                  mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                Регистрация
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="w-full mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
                {error}
              </div>
            )}

            {/* ── LOGIN FORM ── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="w-full space-y-3">
                <div className="space-y-1">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Email или имя пользователя</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="username"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-60 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading}
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-60 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-600/20 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] mt-1"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Войти'}
                </button>
              </form>
            )}

            {/* ── REGISTER FORM ── */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="w-full space-y-3">
                <div className="space-y-1">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Имя</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Иван Иванов"
                      autoComplete="name"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-60 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Имя пользователя</label>
                  <div className="relative">
                    <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.replace(/\s/g, ''))}
                      placeholder="ivan_ivanov"
                      autoComplete="username"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-60 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-60 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Минимум 8 символов"
                      autoComplete="new-password"
                      disabled={loading}
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-60 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-600/20 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] mt-1"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать аккаунт'}
                </button>
              </form>
            )}

            {/* Google sign-in */}
            {GOOGLE_CLIENT_ID && (
              <>
                <div className="w-full flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">или войти через</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <div
                  ref={googleBtnRef}
                  className="w-full flex justify-center"
                  style={{ colorScheme: 'light', minHeight: 44 }}
                />
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
