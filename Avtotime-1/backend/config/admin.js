import User from "../models/user.model.js";

const parseCsvSet = (value) =>
  new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

let _warnedDevDefault = false;
let _warnedNoAdmins = false;

const getAdminSets = () => {
  const usernames = parseCsvSet(process.env.ADMIN_USERNAMES);
  const emails = parseCsvSet(process.env.ADMIN_EMAILS);
  const ids = parseCsvSet(process.env.ADMIN_USER_IDS);

  if (usernames.size || emails.size || ids.size) {
    return { usernames, emails, ids };
  }

  if (process.env.NODE_ENV !== "production") {
    if (!_warnedDevDefault) {
      // eslint-disable-next-line no-console
      console.warn(
        '[admin] No ADMIN_* env vars configured — using dev default username "neko_punk". ' +
        'Set ADMIN_USERNAMES, ADMIN_EMAILS, or ADMIN_USER_IDS before deploying to production.',
      );
      _warnedDevDefault = true;
    }
    return { usernames: new Set(["neko_punk"]), emails: new Set(), ids: new Set() };
  }

  if (!_warnedNoAdmins) {
    // eslint-disable-next-line no-console
    console.warn(
      '[admin] WARNING: No ADMIN_USERNAMES, ADMIN_EMAILS, or ADMIN_USER_IDS set. ' +
      'No user will have admin access until these are configured.',
    );
    _warnedNoAdmins = true;
  }

  return { usernames, emails, ids };
};

export const checkIsAdminByUser = (user) => {
  if (!user) return false;
  if (user.isAdmin === true) return true;

  const { usernames, emails, ids } = getAdminSets();
  const id = user?._id ? String(user._id) : "";
  const userName = typeof user?.userName === "string" ? user.userName.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";

  return Boolean((id && ids.has(id)) || (userName && usernames.has(userName)) || (email && emails.has(email)));
};

export const checkIsAdminByUserId = async (userId) => {
  if (!userId) return false;
  const user = await User.findById(userId).select("userName email isAdmin").lean();
  return checkIsAdminByUser({ ...user, _id: userId });
};

export const getAdminUsers = async () => {
  const { usernames, emails, ids } = getAdminSets();
  const query = [];
  if (usernames.size) query.push({ userName: { $in: [...usernames] } });
  if (emails.size) query.push({ email: { $in: [...emails] } });
  if (ids.size) query.push({ _id: { $in: [...ids] } });
  if (!query.length) return [];
  return User.find({ $or: query }).select("_id userName email").lean();
};

