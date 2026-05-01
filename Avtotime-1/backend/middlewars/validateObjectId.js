import mongoose from "mongoose";

const validateObjectId = (...paramNames) => (req, res, next) => {
  const names = paramNames.length ? paramNames : ["id"];
  for (const name of names) {
    const value = req.params[name];
    if (value && !mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ message: `Некорректный идентификатор: ${name}` });
    }
  }
  next();
};

export default validateObjectId;
