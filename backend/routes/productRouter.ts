/**
 * productRouter — mounts all catalog / shop / cart / order routes.
 *
 * Mounted under `/api` from routes/index.ts.
 *
 * Endpoint groups:
 *   - Merchant CRUD          /api/products/*                (authMiddleware)
 *   - Public shop reads      /api/shop/:handle*             (paymentRateLimiter)
 *   - Cart / Checkout        /api/cart, /api/checkout       (paymentRateLimiter)
 *   - Order status + download/api/order/:publicRef*         (paymentRateLimiter)
 */
import express, { RequestHandler } from "express";
import { authMiddleware } from "../middleware";
import { paymentRateLimiter } from "../middleware/rateLimitMiddleware";
import uploadProductAsset from "../middleware/uploadProductAsset";
import * as productCtrl from "../controller/product/productController";
import * as shopCtrl from "../controller/product/shopController";
import * as cartCtrl from "../controller/product/cartController";
import * as orderCtrl from "../controller/product/orderController";

const productRouter = express.Router();

// ── Merchant CRUD (authenticated) ─────────────────────────────────────
productRouter.get("/products", authMiddleware, productCtrl.listProducts);
productRouter.post("/products", authMiddleware, productCtrl.createProduct);
productRouter.get("/products/orders/all", authMiddleware, productCtrl.listAllOrders);
productRouter.get("/products/:productId", authMiddleware, productCtrl.getProduct);
productRouter.patch("/products/:productId", authMiddleware, productCtrl.updateProduct);
productRouter.delete("/products/:productId", authMiddleware, productCtrl.deleteProduct);
productRouter.post("/products/:productId/publish", authMiddleware, productCtrl.publishProduct);
productRouter.post("/products/:productId/archive", authMiddleware, productCtrl.archiveProduct);

// Variants
productRouter.post("/products/:productId/variants", authMiddleware, productCtrl.createVariant);
productRouter.patch("/products/:productId/variants/:variantId", authMiddleware, productCtrl.updateVariant);
productRouter.delete("/products/:productId/variants/:variantId", authMiddleware, productCtrl.deleteVariant);

// Assets — multipart upload; the middleware order matters (auth first!)
productRouter.post(
  "/products/:productId/assets",
  authMiddleware,
  uploadProductAsset.single("file") as unknown as RequestHandler,
  productCtrl.uploadAsset
);
productRouter.delete("/products/:productId/assets/:assetId", authMiddleware, productCtrl.deleteAsset);

// Orders for one product
productRouter.get("/products/:productId/orders", authMiddleware, productCtrl.listProductOrders);

// ── Public shop (rate-limited) ────────────────────────────────────────
productRouter.get("/shop/:handle", paymentRateLimiter, shopCtrl.getShopByHandle);
productRouter.get("/shop/:handle/products/:slug", paymentRateLimiter, shopCtrl.getShopProductBySlug);

// ── Cart / Checkout (public, rate-limited) ────────────────────────────
productRouter.post("/cart", paymentRateLimiter, cartCtrl.validateCartApi);
productRouter.post("/checkout", paymentRateLimiter, cartCtrl.startCheckout);

// ── Order status + digital download (public, rate-limited) ────────────
productRouter.get("/order/:publicRef", paymentRateLimiter, orderCtrl.getOrderByPublicRef);
productRouter.get(
  "/order/:publicRef/download/:assetId",
  paymentRateLimiter,
  orderCtrl.downloadAsset
);
productRouter.post(
  "/order/:publicRef/resend-download",
  paymentRateLimiter,
  orderCtrl.resendDownloadLinks
);

// ── Test helper (disabled in production) ──────────────────────────────
productRouter.post("/order/:publicRef/_test/mark-paid", orderCtrl.testMarkPaid);

export default productRouter;
