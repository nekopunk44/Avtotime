import { useEffect } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { serverURL } from "../App";
import {
  clearNotifications,
  setNotifications,
  setUnreadCount,
} from "../redux/notificationSlice";

export default function useNotifications() {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);

  useEffect(() => {
    if (!userData) {
      dispatch(clearNotifications());
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [listRes, countRes] = await Promise.all([
          axios.get(`${serverURL}/api/notifications`, { withCredentials: true }),
          axios.get(`${serverURL}/api/notifications/count/unread`, { withCredentials: true }),
        ]);

        if (cancelled) return;
        dispatch(setNotifications(listRes.data));
        dispatch(setUnreadCount(countRes.data?.unreadCount || 0));
      } catch (error) {
        if (!cancelled) console.log(error);
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [dispatch, userData]);
}

