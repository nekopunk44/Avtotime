import React, { useState } from "react";
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
import PrivacyPolicyModal from "../components/common/PrivacyPolicyModal";

function SignUp() {
  const [inputClicked, setInputClicked] = useState({
    name: false,
    userName: false,
    email: false,
    password: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setError] = useState("");
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const isLabelFloating = (field, value) => inputClicked[field] || value.length > 0;

  const handleSignUp = async () => {
    if (!name || !userName || !email || !password) {
      setError("Заполните все поля");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await axios.post(
        `${serverURL}/api/auth/signup`,
        { name, userName, email, password },
        { withCredentials: true }
      );

      dispatch(setUserData(result.data));
      navigate("/choose-app");
    } catch (error) {
      setError(error.response?.data?.message || "Не удалось зарегистрироваться");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col justify-center items-center">
      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
      <div className="w-[90%] lg:max-w-[60%] h-[600px] bg-white rounded-2xl flex justify-center items-center overflow-hidden border-2 border-[#1a1f23] auth-shell-reveal">
        <div className="w-full lg:w-[50%] h-full bg-white flex items-center justify-center p-[10px] auth-white-panel-reveal">
          <div className="w-full h-full flex flex-col items-center gap-[20px] auth-main-fade-in">
          <div className="flex gap-[10px] items-center text-[20px] font-semibold mt-[40px]">
            <span>Регистрация</span>
          </div>

          <div className="relative flex items-center justify-start w-[90%] h-[50px] rounded-2xl border-2 border-black mt-4">
            <label
              htmlFor="name"
              className={`text-gray-700 absolute left-[20px] bg-transparent px-[4px] transition-all duration-200 text-[15px] pointer-events-none ${
                isLabelFloating("name", name) ? "top-[-22px] text-[12px] z-10" : "top-[10px]"
              }`}
            >
              Ваше имя
            </label>
            <input
              type="text"
              id="name"
              className="w-[100%] h-[100%] rounded-2xl px-[20px] outline-none border-0"
              onFocus={() => setInputClicked({ ...inputClicked, name: true })}
              onBlur={() => setInputClicked({ ...inputClicked, name: false })}
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
          </div>

          <div className="relative flex items-center justify-start w-[90%] h-[50px] rounded-2xl border-2 border-black mt-2">
            <label
              htmlFor="userName"
              className={`text-gray-700 absolute left-[20px] bg-transparent px-[4px] transition-all duration-200 text-[15px] pointer-events-none ${
                isLabelFloating("userName", userName) ? "top-[-22px] text-[12px] z-10" : "top-[10px]"
              }`}
            >
              Имя пользователя
            </label>
            <input
              type="text"
              id="userName"
              className="w-[100%] h-[100%] rounded-2xl px-[20px] outline-none border-0"
              onFocus={() => setInputClicked({ ...inputClicked, userName: true })}
              onBlur={() => setInputClicked({ ...inputClicked, userName: false })}
              onChange={(e) => setUserName(e.target.value)}
              value={userName}
            />
          </div>

          <div className="relative flex items-center justify-start w-[90%] h-[50px] rounded-2xl border-2 border-black mt-2">
            <label
              htmlFor="email"
              className={`text-gray-700 absolute left-[20px] bg-transparent px-[4px] transition-all duration-200 text-[15px] pointer-events-none ${
                isLabelFloating("email", email) ? "top-[-22px] text-[12px] z-10" : "top-[10px]"
              }`}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              className="w-[100%] h-[100%] rounded-2xl px-[20px] outline-none border-0"
              onFocus={() => setInputClicked({ ...inputClicked, email: true })}
              onBlur={() => setInputClicked({ ...inputClicked, email: false })}
              onChange={(e) => setEmail(e.target.value)}
              value={email}
            />
          </div>

          <div className="relative flex items-center justify-start w-[90%] h-[50px] rounded-2xl border-2 border-black mt-2">
            <label
              htmlFor="password"
              className={`text-gray-700 absolute left-[20px] bg-transparent px-[4px] transition-all duration-200 text-[15px] pointer-events-none ${
                isLabelFloating("password", password) ? "top-[-22px] text-[12px] z-10" : "top-[10px]"
              }`}
            >
              Пароль
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              className="w-[100%] h-[100%] rounded-2xl px-[20px] outline-none border-0"
              onFocus={() => setInputClicked({ ...inputClicked, password: true })}
              onBlur={() => setInputClicked({ ...inputClicked, password: false })}
              onChange={(e) => setPassword(e.target.value)}
              value={password}
            />
            <div className="absolute right-[20px] cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <IoMdEyeOff size={25} /> : <IoMdEye size={25} />}
            </div>
          </div>

          {err && <p className="text-red-500 text-sm">{err}</p>}

          <button
            className="w-[70%] px-[20px] py-[10px] bg-black text-white font-semibold h-[50px] cursor-pointer rounded-2xl mt-[10px] flex justify-center items-center"
            onClick={handleSignUp}
            disabled={loading}
          >
            {loading ? <ClipLoader size={25} color="white" /> : "Зарегистрироваться"}
          </button>

          <p className="text-gray-800 text-sm mt-2">
            Уже есть аккаунт?
            <span
              className="ml-1 border-b-2 border-b-black pb-[3px] text-black cursor-pointer font-bold"
              onClick={() => navigate("/signin")}
            >
              Войти
            </span>
          </p>

          <p className="text-gray-500 text-[12px] mt-2 text-center max-w-[90%]">
            Нажимая <span className="font-bold text-gray-700">Зарегистрироваться</span>, вы соглашаетесь с{" "}
            <span
              className="font-bold text-black underline cursor-pointer"
              onClick={() => setPrivacyModalOpen(true)}
            >
              Политикой конфиденциальности
            </span>
            .
          </p>
          </div>
        </div>

        <div className="md:w-[50%] h-full hidden lg:flex justify-center items-center bg-[#000000] flex-col gap-[10px] text-white text-[16px] font-semibold rounded-l-[30px] shadow-2xl auth-side-slide-in">
          <img src={logoWhite} alt="Logo White" className="w-[40%]" />
        </div>
      </div>
    </div>
  );
}

export default SignUp;
