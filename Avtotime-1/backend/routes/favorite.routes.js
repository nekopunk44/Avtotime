import express from "express";
import isAuth from "../middlewars/isAuth.js";
import {
  addToFavorites,
  checkIfFavorite,
  countFavorites,
  getFavorites,
  removeFromFavorites,
} from "../controllers/favorite.controllers.js";

const favoriteRouter = express.Router();

favoriteRouter.post("/", isAuth, addToFavorites);
favoriteRouter.delete("/", isAuth, removeFromFavorites);
favoriteRouter.get("/", isAuth, getFavorites);
favoriteRouter.get("/check", isAuth, checkIfFavorite);
favoriteRouter.get("/count", isAuth, countFavorites);

export default favoriteRouter;
