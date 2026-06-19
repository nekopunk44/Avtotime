import React, { useMemo, useState } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { serverURL } from "../App";
import { markAllAsReadLocal, markAsReadLocal, setUnreadCount } from "../redux/notificationSlice";
import { setUserData } from "../redux/userSlice";
import profile from "../assets/profile.png";
import { IoChevronBack, IoCheckmarkDoneOutline } from "react-icons/io5";

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

function EmailVerifyCard() {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!userData || userData.isEmailVerified) return null;

  const handleResend = async () => {
    setLoading(true);
    try {
      await axios.post(`${serverURL}/api/auth/resend-verification`, {}, { withCredentials: true });
      setSent(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex gap-[12px] p-[14px] rounded-[14px] border border-amber-700 bg-amber-950/40">
      <div className="w-[46px] h-[46px] rounded-full bg-amber-900/60 flex items-center justify-center shrink-0 text-[22px]">
        ✉
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-amber-300 font-semibold text-[15px]">Подтвердите email</div>
        <div className="text-amber-200/70 text-[13px] mt-[2px]">
          Письмо отправлено на <span className="font-semibold">{userData.email}</span>. Подтвердите адрес, чтобы публиковать посты и создавать объявления.
        </div>
        <div className="mt-[8px]">
          {sent ? (
            <span className="text-green-400 text-[13px] font-semibold">Письмо отправлено!</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-amber-300 text-[13px] font-semibold underline hover:text-amber-200 disabled:opacity-50"
            >
              {loading ? "Отправка..." : "Отправить письмо повторно"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, unreadCount } = useSelector((state) => state.notification);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : [];
    list.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
    return list;
  }, [items]);

  const handleMarkAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.patch(`${serverURL}/api/notifications/mark-all-read`, null, { withCredentials: true });
      dispatch(markAllAsReadLocal());
      dispatch(setUnreadCount(0));
    } catch (error) {
      console.log(error);
    } finally {
      setBusy(false);
    }
  };

  const handleMarkOne = async (id) => {
    if (!id || busy) return;
    setBusy(true);
    try {
      await axios.patch(`${serverURL}/api/notifications/${id}/read`, null, { withCredentials: true });
      dispatch(markAsReadLocal(id));
    } catch (error) {
      console.log(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex justify-center items-start">
      <div className="w-full max-w-[900px] px-[16px] py-[20px]">
        <div className="relative flex items-center h-[52px] mb-[16px]">
          {/* Назад */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-[36px] h-[36px] rounded-full text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="Назад"
          >
            <IoChevronBack className="w-[22px] h-[22px]" />
          </button>

          {/* Заголовок по центру */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <div className="text-white text-[20px] font-semibold leading-tight">Уведомления</div>
            <div className="text-gray-500 text-[12px]">
              Непрочитанных: <span className="text-white font-semibold">{unreadCount}</span>
            </div>
          </div>

          {/* Кнопка: текст на десктопе, иконка на мобильном */}
          <button
            disabled={busy || unreadCount === 0}
            onClick={handleMarkAll}
            className="ml-auto flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
            aria-label="Отметить все как прочитанные"
            title="Отметить все как прочитанные"
          >
            <span className="hidden sm:block px-[12px] py-[8px] rounded-[10px] bg-gray-900 text-white text-[13px]">
              Отметить все как прочитанные
            </span>
            <span className="sm:hidden flex items-center justify-center w-[36px] h-[36px] rounded-full bg-white/8 text-white">
              <IoCheckmarkDoneOutline className="w-[20px] h-[20px]" />
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-[10px]">
          <EmailVerifyCard />
          {sorted.length === 0 ? (
            <div className="text-gray-400">Пока нет уведомлений.</div>
          ) : (
            sorted.map((n) => {
              const id = n?._id || n?.notificationId;
              const actor = n?.actor;
              const avatar = actor?.profileImage || n?.image || profile;
              const title = n?.title || "Уведомление";
              const description = n?.description || "";
              const isRead = Boolean(n?.isRead);

              return (
                <button
                  key={String(id)}
                  onClick={() => handleMarkOne(id)}
                  className={[
                    "w-full text-left flex gap-[12px] p-[12px] rounded-[14px] border",
                    isRead ? "border-gray-900 bg-black" : "border-blue-900 bg-[#050b18]",
                  ].join(" ")}
                >
                  <div className="w-[46px] h-[46px] rounded-full overflow-hidden border border-gray-800 shrink-0">
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-[10px]">
                      <div className="text-white font-semibold truncate">{title}</div>
                      <div className="text-gray-500 text-[12px] shrink-0">{formatDate(n?.createdAt)}</div>
                    </div>
                    {description ? (
                      <div className="text-gray-300 text-[14px] mt-[2px] break-words">{description}</div>
                    ) : null}
                    {!isRead ? (
                      <div className="text-blue-400 text-[12px] mt-[6px]">Нажмите, чтобы отметить как прочитанное</div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

