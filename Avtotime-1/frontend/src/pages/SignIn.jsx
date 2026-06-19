import React, { useEffect, useRef, useState } from "react";
import "../index.css";
import logoDark from "../assets/лого_5.jpg";
import logoWhite from "../assets/лого_бел.jpg";
import { IoMdEye, IoMdEyeOff } from "react-icons/io";
import axios from "axios";
import { serverURL } from "../App";
import { ClipLoader } from "react-spinners";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setError] = useState("");
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const googleBtnRef = useRef(null);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    const scriptId = "google-gsi-script";
    const init = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            setError("");
            const result = await axios.post(
              `${serverURL}/api/auth/google`,
              { credential },
              { withCredentials: true }
            );
            dispatch(setUserData(result.data));
            navigate("/");
          } catch (e) {
            setError(e.response?.data?.message || "Не удалось войти через Google");
          }
        },
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: googleBtnRef.current.offsetWidth || 300,
          text: "signin_with",
          locale: "ru",
        });
      }
    };

    if (window.google?.accounts) {
      init();
    } else {
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = init;
        document.head.appendChild(script);
      } else {
        document.getElementById(scriptId).addEventListener("load", init);
      }
    }
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const identifierValue = String(identifierRef.current?.value ?? "").trim();
      const passwordValue = String(passwordRef.current?.value ?? "");

      if (!identifierValue || !passwordValue) {
        setError("Заполните все поля");
        setLoading(false);
        return;
      }

      const result = await axios.post(
        `${serverURL}/api/auth/signin`,
        { identifier: identifierValue, password: passwordValue },
        { withCredentials: true }
      );

      dispatch(setUserData(result.data));
      navigate("/");
    } catch (error) {
      console.log(error);
      setError(error.response?.data?.message || "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col justify-center items-center">
<div className="w-[90%] lg:max-w-[60%] h-auto lg:h-[600px] bg-white rounded-2xl flex justify-center items-center overflow-hidden border-2 border-[#1a1f23] auth-shell-reveal">
        <div className="w-full lg:w-[50%] h-full bg-white flex items-center justify-center p-[10px] auth-white-panel-reveal">
          <div className="w-full h-full flex flex-col items-center justify-center gap-[20px] py-8 lg:py-0 auth-main-fade-in">
            <img src={logoDark} alt="AVTOTIME" className="w-[40%] lg:hidden" />
            <div className="flex gap-[10px] items-center text-[20px] font-semibold">
              <span>Вход</span>
            </div>

          <div
            className="auth-floating-field relative flex items-center justify-start w-[90%] h-[50px] rounded-2xl border-2 border-black mt-4"
          >
            <input
              type="text"
              id="identifier"
              name="identifier"
              autoComplete="username"
              ref={identifierRef}
              className="w-[100%] h-[100%] rounded-2xl px-[20px] outline-none border-0"
              placeholder=" "
              required
              onChange={() => err && setError("")}
            />
            <label
              htmlFor="identifier"
              className="auth-floating-label text-gray-700 absolute left-[20px] bg-transparent px-[4px] pointer-events-none"
            >
              Имя пользователя или email
            </label>
          </div>

          <div
            className="auth-floating-field relative flex items-center justify-start w-[90%] h-[50px] rounded-2xl border-2 border-black mt-[14px]"
          >
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              autoComplete="current-password"
              ref={passwordRef}
              className="w-[100%] h-[100%] rounded-2xl px-[20px] outline-none border-0"
              placeholder=" "
              required
              onChange={() => err && setError("")}
            />
            <label
              htmlFor="password"
              className="auth-floating-label text-gray-700 absolute left-[20px] bg-transparent px-[4px] pointer-events-none"
            >
              Пароль
            </label>
            {!showPassword ? (
              <IoMdEye
                className="absolute cursor-pointer right-[20px] w-[25px] h-[25px]"
                onClick={() => setShowPassword(true)}
              />
            ) : (
              <IoMdEyeOff
                className="absolute cursor-pointer right-[20px] w-[25px] h-[25px]"
                onClick={() => setShowPassword(false)}
              />
            )}
          </div>

          <div className="cursor-pointer justify-center -mt-3" onClick={() => navigate("/forgot-password")}>
            Забыли пароль?
          </div>

          {err && <p className="text-red-500">{err}</p>}

          <div className="flex flex-col items-center gap-2 w-full mt-[10px]">
            <button
              className="w-[70%] px-[20px] py-[10px] bg-black text-white font-semibold h-[50px] cursor-pointer rounded-2xl"
              onClick={handleSignIn}
              disabled={loading}
            >
              {loading ? <ClipLoader size={30} color="white" /> : "Войти"}
            </button>

            {GOOGLE_CLIENT_ID && (
              <>
                <div className="flex items-center gap-3 w-[70%]">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-sm text-gray-400">или</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div ref={googleBtnRef} className="w-[70%] flex justify-center" />
              </>
            )}
          </div>

          <p className="cursor-pointer text-gray-800" onClick={() => navigate("/signup")}>
            Нет аккаунта?
            <span className="border-b-2 border-b-black pb-[3px] text-black"> Зарегистрироваться</span>
          </p>

          </div>
        </div>

        <div className="md:w-[50%] h-full hidden lg:flex justify-center items-center bg-[#000000] flex-col gap-[10px] text-white text-[16px] font-semibold rounded-l-[30px] shadow-2xl shadow-black auth-side-slide-in">
          <img src={logoWhite} alt="" className="w-[40%]" />
        </div>
      </div>
    </div>
  );
}

export default SignIn;
