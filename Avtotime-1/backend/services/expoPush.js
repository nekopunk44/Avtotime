import User from "../models/user.model.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export const isExpoPushToken = (token) =>
  typeof token === "string" && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);

// Fire-and-forget push to all of a user's registered devices.
// Stale tokens (DeviceNotRegistered) are pruned from the user document.
export const sendExpoPushToUser = async (userId, { title, body, data }) => {
  try {
    const user = await User.findById(userId).select("expoPushTokens").lean();
    const tokens = (user?.expoPushTokens || []).filter(isExpoPushToken);
    if (!tokens.length) return;

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data: data || {},
    }));

    const staleTokens = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      const result = await response.json().catch(() => null);
      const tickets = Array.isArray(result?.data) ? result.data : [];
      tickets.forEach((ticket, index) => {
        if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
          staleTokens.push(batch[index].to);
        }
      });
    }

    if (staleTokens.length) {
      await User.updateOne(
        { _id: userId },
        { $pull: { expoPushTokens: { $in: staleTokens } } }
      );
    }
  } catch (error) {
    console.error("Expo push error:", error);
  }
};
