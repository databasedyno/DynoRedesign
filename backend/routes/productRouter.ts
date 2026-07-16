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

// ── Feature flag guard (spec §13) ─────────────────────────────────────
// When NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG=false, every catalog route returns
// 404 so the surface can be killed instantly without a code deploy. We read
// the same env var the frontend consults so both layers stay in sync.
productRouter.use((req, res, next) => {
  const enabled =
    String(process.env.NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    return res
      .status(404)
      .json({ statusCode: 404, message: "Product Catalog is not enabled." });
  }
  next();
});

// ── Merchant CRUD (authenticated) ─────────────────────────────────────
productRouter.get("/products", authMiddleware, productCtrl.listProducts);
productRouter.get("/products/categories", authMiddleware, productCtrl.listMyCategories);
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

// Merchant refund flow (spec §7.6) — POST /api/products/orders/:orderId/refund
// Two-step: body.final=false → 'refund_requested', body.final=true → 'refunded'.
// Idempotent, restocks on request, emails buyer on final.
productRouter.post("/products/orders/:orderId/refund", authMiddleware, orderCtrl.refundOrder);

// ── Public shop (rate-limited) ────────────────────────────────────────
productRouter.get("/shop/:handle", paymentRateLimiter, shopCtrl.getShopByHandle);
productRouter.get("/shop/:handle/products/:slug", paymentRateLimiter, shopCtrl.getShopProductBySlug);

// ── Cart / Checkout (public, rate-limited) ────────────────────────────
productRouter.post("/cart", paymentRateLimiter, cartCtrl.validateCartApi);
productRouter.post("/cart/quote-tax", paymentRateLimiter, cartCtrl.quoteTax);
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
