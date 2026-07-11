/**
 * Buy Button routes — Phase 2D
 *
 *  DASHBOARD (JWT):
 *    POST   /api/buy-buttons
 *    GET    /api/buy-buttons?company_id=…
 *    GET    /api/buy-buttons/:button_id
 *    PATCH  /api/buy-buttons/:button_id
 *    DELETE /api/buy-buttons/:button_id      (soft-delete = archive)
 */

import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  createBuyButton,
  listBuyButtons,
  getBuyButton,
  updateBuyButton,
  deleteBuyButton,
} from "../controller/buyButtonController";

export const buyButtonRouter = express.Router();

buyButtonRouter.post("/", authMiddleware, createBuyButton);
buyButtonRouter.get("/", authMiddleware, listBuyButtons);
buyButtonRouter.get("/:button_id", authMiddleware, getBuyButton);
buyButtonRouter.patch("/:button_id", authMiddleware, updateBuyButton);
buyButtonRouter.delete("/:button_id", authMiddleware, deleteBuyButton);
