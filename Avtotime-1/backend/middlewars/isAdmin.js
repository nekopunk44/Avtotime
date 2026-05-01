import User from "../models/user.model.js";
import { checkIsAdminByUser } from "../config/admin.js";

const isAdmin = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).select("userName email").lean();
    if (!checkIsAdminByUser({ ...user, _id: userId })) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Admin auth error" });
  }
};

export default isAdmin;

