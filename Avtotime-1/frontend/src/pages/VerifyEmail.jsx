import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { serverURL } from "../App";
import { useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Неверная ссылка подтверждения.");
      return;
    }

    axios
      .post(`${serverURL}/api/auth/verify-email`, { token }, { withCredentials: true })
      .then((res) => {
        setStatus("success");
        setMessage(res.data.message);
        // Refresh session so isEmailVerified updates in Redux
        axios
          .get(`${serverURL}/api/auth/session`, { withCredentials: true })
          .then((r) => r.data && dispatch(setUserData(r.data)))
          .catch(() => {});
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "Ссылка недействительна или истекла.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {status === "loading" && (
        <div className="text-gray-500 text-[15px]">Подтверждение...</div>
      )}

      {status === "success" && (
        <>
          <div className="text-[48px] mb-4">✓</div>
          <div className="text-[22px] font-black text-gray-900">{message}</div>
          <div className="mt-2 text-[14px] text-gray-500">
            Теперь вы можете публиковать посты и создавать объявления.
          </div>
          <button
            onClick={() => navigate("/")}
            className="mt-8 rounded-2xl bg-black px-6 py-2.5 text-[14px] font-bold text-white hover:bg-gray-900"
          >
            На главную
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <div className="text-[48px] mb-4">✗</div>
          <div className="text-[22px] font-black text-gray-900">Ошибка</div>
          <div className="mt-2 text-[14px] text-gray-500 max-w-[320px]">{message}</div>
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-gray-200 px-5 py-2.5 text-[14px] font-bold text-gray-700 hover:bg-gray-50"
            >
              Назад
            </button>
            <button
              onClick={() => navigate("/")}
              className="rounded-2xl bg-black px-5 py-2.5 text-[14px] font-bold text-white hover:bg-gray-900"
            >
              На главную
            </button>
          </div>
        </>
      )}
    </div>
  );
}
