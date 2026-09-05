import User from "../models/user.model.js";
import { checkIsAdminByUser } from "../config/admin.js";

const isAdmin = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // isAdmin has to be selected: checkIsAdminByUser treats the stored flag as
    // authoritative, and without it here the field is dead weight — the column
    // exists, it is indexed, and promoting a user through it did nothing.
    // checkIsAdminByUserId already selects it, so the two paths disagreed.
    const user = await User.findById(userId).select("userName email isAdmin").lean();
    if (!checkIsAdminByUser({ ...user, _id: userId })) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Admin auth error" });
  }
};

export default isAdmin;

