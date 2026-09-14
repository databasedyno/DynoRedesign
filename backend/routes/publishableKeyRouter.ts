/**
 * Publishable Key routes — Phase 2 (Buy Button) + Phase 3 (Elements)
 *
 *  DASHBOARD (JWT):
 *    POST   /api/publishable-keys
 *    GET    /api/publishable-keys?company_id=…
 *    GET    /api/publishable-keys/:id
 *    PATCH  /api/publishable-keys/:id
 *    DELETE /api/publishable-keys/:id
 *
 *  PUBLIC (browser, pk + Origin):
 *    POST   /api/embed/public/session                     — Buy Button
 *    POST   /api/embed/public/elements/intent             — Elements (b): create intent
 *    POST   /api/embed/public/elements/select-currency    — Elements (b): pick currency
 *    GET    /api/embed/public/elements/status             — Elements (b): poll status
 */

import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  createPublishableKey,
  listPublishableKeys,
  getPublishableKey,
  updatePublishableKey,
  deletePublishableKey,
  createPublicEmbedSession,
} from "../controller/publishableKeyController";
import {
  createElementsIntent,
  selectElementsCurrency,
  getElementsStatus,
} from "../controller/elementsController";
import {
  publishablePublicCors,
  validatePublishableKey,
} from "../middleware/publishableKeyMiddleware";

/* Dashboard CRUD router (mounted at /api/publishable-keys) */
export const publishableKeyRouter = express.Router();
publishableKeyRouter.post("/", authMiddleware, createPublishableKey);
publishableKeyRouter.get("/", authMiddleware, listPublishableKeys);
publishableKeyRouter.get("/:id", authMiddleware, getPublishableKey);
publishableKeyRouter.patch("/:id", authMiddleware, updatePublishableKey);
publishableKeyRouter.delete("/:id", authMiddleware, deletePublishableKey);

/* Public embed router (mounted at /api/embed/public)
 *
 * CORS is per-request:
 *   - publishablePublicCors reflects the Origin on preflight (OPTIONS)
 *   - validatePublishableKey re-validates the Origin against the pk's
 *     allow-list on the actual POST/GET and re-sets the ACAO header.
 * This keeps the browser happy while still refusing origins that aren't
 * on the merchant's allow-list. */
export const embedPublicRouter = express.Router();
embedPublicRouter.use(publishablePublicCors);
// Buy Button (Phase 2c)
embedPublicRouter.post("/session", validatePublishableKey, createPublicEmbedSession);
// Elements inline widget (Phase 3b)
embedPublicRouter.post("/elements/intent", validatePublishableKey, createElementsIntent);
embedPublicRouter.post("/elements/select-currency", validatePublishableKey, selectElementsCurrency);
embedPublicRouter.get("/elements/status", validatePublishableKey, getElementsStatus);

