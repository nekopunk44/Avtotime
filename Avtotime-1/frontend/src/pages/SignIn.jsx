import React, { useRef, useState } from "react";
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

function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setError] = useState("");
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const identifierValue = String(identifierRef.current?.value ?? "").trim();
      const passwordValue = String(passwordRef.current?.value ?? "");

      if (!identifierValue || !passwordValue) {
        setError("Please fill in all fields");
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
      setError(error.response?.data?.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col justify-center items-center">
      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
      <div className="w-[90%] lg:max-w-[60%] h-[600px] bg-white rounded-2xl flex justify-center items-center overflow-hidden border-2 border-[#1a1f23] auth-shell-reveal">
        <div className="w-full lg:w-[50%] h-full bg-white flex items-center justify-center p-[10px] auth-white-panel-reveal">
          <div className="w-full h-full flex flex-col items-center justify-center gap-[20px] auth-main-fade-in">
            <div className="flex gap-[10px] items-center text-[20px] font-semibold mt-[40px]">
              <span>Sign In</span>
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
              Username or email
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
              Password
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

          <div className="cursor-pointer justify-center" onClick={() => navigate("/forgot-password")}>
            Forgot password?
          </div>

          {err && <p className="text-red-500">{err}</p>}

          <button
            className="w-[70%] px-[20px] py-[10px] bg-black text-white font-semibold h-[50px] cursor-pointer rounded-2xl mt-[10px]"
            onClick={handleSignIn}
            disabled={loading}
          >
            {loading ? <ClipLoader size={30} color="white" /> : "Sign In"}
          </button>

          <p className="cursor-pointer text-gray-800" onClick={() => navigate("/signup")}>
            No account yet?
            <span className="border-b-2 border-b-black pb-[3px] text-black"> Sign up</span>
          </p>

          <p className="text-gray-500 text-[12px] -mt-2 text-center max-w-[90%]">
              <span
                className="font-bold text-black underline cursor-pointer"
                onClick={() => setPrivacyModalOpen(true)}
              >
                Privacy Policy
              </span>
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
