import { useEffect } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { serverURL } from "../config/serverUrl";
import {
  clearNotifications,
  setNotifications,
  setUnreadCount,
} from "../redux/notificationSlice";

export default function useNotifications() {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.userData?._id);

  useEffect(() => {
    if (!userId) {
      dispatch(clearNotifications());
      return undefined;
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
  }, [dispatch, userId]);
}
