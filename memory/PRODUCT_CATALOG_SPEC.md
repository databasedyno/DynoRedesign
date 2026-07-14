# Product Catalog — Spec

> **Status**: Draft v1 · 2026-07-14 · Recreated after prior-job data loss (Emergent sandbox torn down).
> **Owner**: hostbay@moxx.co
> **Depends on**: existing Payment Link + CleanCheckoutV2 + Crowdfunding v2 (Session 44) infra.
> **Not to be confused with**: Crowdfunding reward *tiers* (`tbl_donation_tier`, Session 44 Phase 3.2), which are contribution incentives — a product is a first-class purchasable SKU.

---

## 1. Product Goals

Dynopay today sells three surfaces:
1. **Payment links** — one-off invoices
2. **Creator page** — tips + link-in-bio
3. **Crowdfunding** — goal-based campaigns

Missing: **the recurring-catalog surface** — a merchant with more than a couple of things to sell can't list them. Every product needs a fresh payment link, no photos, no variants, no cart.

**Product Catalog closes this gap** by giving each merchant a shoppable inventory that shares the same wallet + settlement stack as payment links.

### Explicit goals (MVP)
- G1. A merchant can list a **catalog of products** with photos, price, description, variants, and stock — from inside the existing dashboard (new tab under `/pay-links`).
- G2. A merchant can sell **three product types**: digital deliverables (file / license / URL), physical goods (needs shipping), and services (fixed-price bookings).
- G3. A buyer can browse a merchant's catalog at `/{handle}/shop`, open a product detail page at `/{handle}/p/{slug}`, add multiple items (with variants) to a cart, and check out **once** paying a single crypto amount for the whole cart.
- G4. Payment reuses existing **CleanCheckoutV2** flow (single crypto payment, multi-network) — no new checkout stack.
- G5. **Fulfillment automation for digital goods**: buyer receives a signed download URL (or license key / access URL) in an email + on the success page, no merchant action needed.
- G6. **Order log for merchants**: each completed cart becomes an order row visible in dashboard with buyer email, contents, shipping address (if physical), fulfillment status, and payment tx.
- G7. Multi-currency price display (reuse `useLocalPrice` hook + `usePaymentRates`).
- G8. Full i18n across 6 locales (en/es/fr/de/nl/pt) — merchant editor + shop UI + emails.

### Non-goals (MVP — explicitly out)
- ❌ Multi-vendor marketplace / multiple merchants per cart
- ❌ Subscription products / recurring billing (deferred to a later feature — see `docs/plans/AUTO_CONVERSION_PLAN.md` for related work)
- ❌ Coupons / discount codes (Phase 2)
- ❌ Real-time shipping rate integration (merchants set a flat/tiered rate manually in MVP)
- ❌ On-chain smart-contract escrow (funds settle to merchant wallet immediately as with all Dynopay payments)
- ❌ Tax calculation per jurisdiction (uses existing `TAX_DATA_API_URL` if merchant opts in; otherwise flat 0)
- ❌ Refund flow (manual — merchant refunds off-chain; a `refund_requested` order status just flags it)
- ❌ Product reviews / ratings
- ❌ Wishlists / favourites
- ❌ Search / filter beyond category (Phase 2)
- ❌ Inventory reservation timeouts (cart items don't hold stock — race resolved atomically at checkout, see §7.5)

---

## 2. Personas

| Persona | Needs |
|---|---|
| **Digital-only creator** (existing tip/crowdfund user) | Sell an ebook, template pack, or Notion doc alongside tips. Zero-touch delivery. |
| **Physical merchant** (e.g. print-on-demand shop) | Sell t-shirts w/ size + colour variants. Collect shipping address. Track fulfillment status. |
| **Service seller** (consultant / coach / freelance) | Sell fixed-price 30-min consultation. Attach a Calendly URL post-payment. |
| **Buyer** | Browse without login, add to cart, pay in crypto once, get everything delivered. |

---

## 3. Positioning in the app

### 3.1 Merchant dashboard
- **New tab under `/pay-links`** (existing route). Tab bar becomes:
  ```
  [ Payment Links ]  [ Products ]  [ Campaigns ]     ← Campaigns already exists as filter today; formalise
  ```
- Route: `/pay-links?tab=products` (deep-linkable) — or migrate to `/pay-links/products` sub-route if cleaner
- Sub-pages:
  - `/pay-links/products` — grid list of products (search, filter by type, filter by status draft/live/archived)
  - `/pay-links/products/new` — create wizard (`product_type` picker → common fields → type-specific fields → variants → images → review)
  - `/pay-links/products/{id}/edit` — same wizard, prefilled
  - `/pay-links/products/{id}/orders` — order list for that single product (also aggregated on `/transactions?filter=orders`)

### 3.2 Buyer public routes
- `/{handle}/shop` — grid of live products (published + in-stock). SSR-friendly for SEO.
- `/{handle}/p/{slug}` — product detail page. Gallery, description (Markdown-rendered like campaign story), variant picker, add-to-cart, price.
- `/{handle}/cart` — cart summary with per-item quantity control, remove, subtotal (in merchant's display currency, converted from crypto rate at render). Persistent per-device via `localStorage['dynopay_cart_v1']` (see §6).
- `/{handle}/checkout` — buyer collects contact + shipping address (if any physical item in cart) → creates a **CartOrder** payment link server-side → redirects to CleanCheckoutV2 QR/pay page (`/pay?d=<order_ref>`).

### 3.3 Order surface
- Merchant: existing `/transactions` gets a new **"Orders"** view — every completed cart is one order row (expand to see line items).
- Buyer: `/order/{public_ref}` — no-auth read-only success page (kept as bookmarkable URL) showing paid line items + download links + shipping status. Also linked from email.

---

## 4. Data Model

All tables `id BIGSERIAL PRIMARY KEY` unless noted. Timestamps `created_at`/`updated_at` `TIMESTAMPTZ DEFAULT NOW()` implied on every table. Ownership via `user_id` (FK → `tbl_user.user_id`) unless noted.

### 4.1 `tbl_product` — one row per product
| Column | Type | Notes |
|---|---|---|
| `product_id` | BIGSERIAL PK | |
| `merchant_user_id` | BIGINT NOT NULL | FK `tbl_user.user_id` |
| `product_type` | VARCHAR(16) NOT NULL | `digital` \| `physical` \| `service` |
| `title` | VARCHAR(160) NOT NULL | |
| `slug` | VARCHAR(180) NOT NULL | URL slug, unique per merchant (`UNIQUE(merchant_user_id, slug)`) |
| `subtitle` | VARCHAR(240) | short one-liner shown in grid cards |
| `description_md` | TEXT | Markdown, rendered w/ existing safe renderer from `donationCampaign.tsx` |
| `base_price_cents` | BIGINT NOT NULL | integer minor units in `currency` |
| `currency` | VARCHAR(3) NOT NULL | ISO 4217, default merchant's `display_currency` |
| `cover_image_url` | TEXT | primary image (also first in gallery) |
| `gallery_images` | JSONB DEFAULT '[]' | array of `{url, alt}` |
| `category` | VARCHAR(64) | free-text (later enum) |
| `status` | VARCHAR(16) NOT NULL | `draft` \| `live` \| `archived` |
| `has_variants` | BOOLEAN NOT NULL DEFAULT false | if true, price+stock live on variants; base_price is min-of-variants |
| `base_stock` | INT | nullable — only used when `has_variants=false`. `NULL` = infinite stock. Digital defaults `NULL`. |
| `digital_delivery_type` | VARCHAR(16) | `file` \| `license_key` \| `url` \| NULL (physical/service). |
| `digital_delivery_payload` | JSONB | shape depends on delivery type — see §4.4. Not exposed to buyer until paid. |
| `physical_shipping_flat_cents` | BIGINT | flat shipping cost added at checkout when cart contains this item. `NULL` = free shipping. |
| `physical_weight_grams` | INT | optional, for future rate calc |
| `service_duration_minutes` | INT | optional for service type |
| `service_calendar_url` | TEXT | e.g. Calendly link, sent post-payment |
| `sold_count` | INT NOT NULL DEFAULT 0 | denormalized for perf; incremented on order completion |
| `deleted_at` | TIMESTAMPTZ | soft delete |

**Indexes**:
- `idx_product_merchant_status (merchant_user_id, status)` — merchant dashboard listing
- `idx_product_slug (merchant_user_id, slug)` UNIQUE — public URL lookup
- `idx_product_type (product_type)` — filtering
- `idx_product_created (created_at DESC)` — sort

### 4.2 `tbl_product_variant` — variant SKUs (only rows exist when `product.has_variants=true`)
| Column | Type | Notes |
|---|---|---|
| `variant_id` | BIGSERIAL PK | |
| `product_id` | BIGINT NOT NULL | FK `tbl_product.product_id` ON DELETE CASCADE |
| `sku` | VARCHAR(80) | merchant-set, optional |
| `attributes` | JSONB NOT NULL | e.g. `{"size":"L","color":"Black"}` |
| `price_cents` | BIGINT NOT NULL | in product's `currency` |
| `stock_count` | INT | `NULL`=infinite (digital) |
| `image_url` | TEXT | variant-specific image, falls back to product cover |
| `sort_order` | INT DEFAULT 0 | |
| `is_active` | BOOLEAN NOT NULL DEFAULT true | soft-hide without delete |

**Indexes**: `idx_variant_product (product_id, is_active, sort_order)`.

### 4.3 `tbl_product_order` — one row per completed cart
Reuses `tbl_payment_link` for the crypto payment side (we create a synthetic payment link with `link_type='cart'`) but keeps its own order semantics separate. This preserves settlement/webhook/receipt code without changes.

| Column | Type | Notes |
|---|---|---|
| `order_id` | BIGSERIAL PK | |
| `public_ref` | VARCHAR(48) UNIQUE NOT NULL | random 24-hex → user-facing `/order/<ref>` |
| `merchant_user_id` | BIGINT NOT NULL | FK `tbl_user.user_id` |
| `payment_link_id` | BIGINT NOT NULL | FK `tbl_payment_link.link_id`, uniquely one-to-one for tracking payment |
| `buyer_email` | VARCHAR(255) NOT NULL | collected on `/checkout` |
| `buyer_name` | VARCHAR(160) | optional |
| `buyer_phone` | VARCHAR(32) | optional |
| `shipping_address` | JSONB | `{line1,line2,city,region,postal_code,country_code,notes}` — only for physical items |
| `subtotal_cents` | BIGINT NOT NULL | sum of line-item price × qty (in `currency`) |
| `shipping_cents` | BIGINT NOT NULL DEFAULT 0 | |
| `tax_cents` | BIGINT NOT NULL DEFAULT 0 | 0 in MVP; Phase 2 uses TAX_DATA_API |
| `total_cents` | BIGINT NOT NULL | subtotal + shipping + tax |
| `currency` | VARCHAR(3) NOT NULL | |
| `crypto_currency` | VARCHAR(16) | filled at payment (BTC / ETH / USDT-TRC20 / …) |
| `crypto_network` | VARCHAR(24) | tron / ethereum / bitcoin / polygon / xrp / … |
| `crypto_amount` | DECIMAL(28,8) | filled at payment |
| `payment_status` | VARCHAR(24) NOT NULL DEFAULT 'pending' | `pending` \| `paid` \| `expired` \| `underpaid` \| `refund_requested` \| `refunded` |
| `fulfillment_status` | VARCHAR(24) NOT NULL DEFAULT 'unfulfilled' | `unfulfilled` \| `partial` \| `fulfilled` (digital auto → `fulfilled` on `paid`) |
| `paid_at` | TIMESTAMPTZ | |
| `locale` | VARCHAR(6) | for emails / receipt |

**Indexes**:
- `idx_order_merchant_status (merchant_user_id, payment_status, created_at DESC)`
- `idx_order_public_ref (public_ref)` UNIQUE
- `idx_order_payment_link (payment_link_id)` UNIQUE

### 4.4 `tbl_product_order_item` — line items
| Column | Type | Notes |
|---|---|---|
| `order_item_id` | BIGSERIAL PK | |
| `order_id` | BIGINT NOT NULL | FK `tbl_product_order.order_id` ON DELETE CASCADE |
| `product_id` | BIGINT NOT NULL | FK `tbl_product.product_id` (RESTRICT — never lose historical link) |
| `variant_id` | BIGINT | nullable |
| `product_snapshot` | JSONB NOT NULL | frozen `{title, slug, cover_image_url, digital_delivery_type, product_type}` at time of purchase (so history survives product edits) |
| `variant_snapshot` | JSONB | frozen variant attrs/price |
| `quantity` | INT NOT NULL CHECK (quantity > 0) | |
| `unit_price_cents` | BIGINT NOT NULL | |
| `line_total_cents` | BIGINT NOT NULL | `unit_price_cents * quantity` |
| `fulfillment_status` | VARCHAR(24) NOT NULL DEFAULT 'unfulfilled' | line-level, allows partial fulfillment when order mixes types |
| `delivered_payload` | JSONB | filled after fulfillment — for digital: `{signed_url, expires_at, download_count}`. For service: `{calendar_url}`. For physical: `{tracking_number, carrier, shipped_at}`. |

**Indexes**: `idx_order_item_order (order_id)`, `idx_order_item_product (product_id)` (for sold-count tallies).

### 4.5 `tbl_product_asset` — uploaded digital deliverables
Separate table so we can store binary in Google Cloud Storage (via existing GCP secrets in `.env`) and reference by signed URL.

| Column | Type | Notes |
|---|---|---|
| `asset_id` | BIGSERIAL PK | |
| `product_id` | BIGINT NOT NULL | FK `tbl_product` ON DELETE CASCADE |
| `merchant_user_id` | BIGINT NOT NULL | denormalized for ACL |
| `filename` | VARCHAR(255) NOT NULL | |
| `mime_type` | VARCHAR(100) | |
| `size_bytes` | BIGINT | |
| `storage_bucket` | VARCHAR(120) | GCS bucket name |
| `storage_object` | VARCHAR(500) | GCS object key `products/{merchant_id}/{product_id}/{filename}` |
| `sha256` | CHAR(64) | integrity |
| `is_active` | BOOLEAN NOT NULL DEFAULT true | |

For `digital_delivery_type='file'`, `tbl_product.digital_delivery_payload` stores `{asset_ids: [123, 456]}`. On purchase, backend generates a signed URL (24-hour expiry by default) for each and stores in `tbl_product_order_item.delivered_payload`.

For `digital_delivery_type='license_key'`, `digital_delivery_payload` = `{pool_source: 'static'|'api', keys: [...]}` or an external key-vending API URL.

For `digital_delivery_type='url'`, `digital_delivery_payload` = `{access_url: 'https://...'}` — sent as-is post-payment.

---

## 5. API Contracts

All routes prefixed `/api`. Auth conventions match existing code: `authMiddleware` (merchant JWT), `customerAuthMiddleware` (buyer JWT — optional for browse, required for cart persistence server-side), or no auth (public shop routes).

### 5.1 Merchant CRUD (authenticated)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/products` | ?type=&status=&q=&limit=&offset= | `{items, total, limit, offset}` |
| POST | `/api/products` | full product body | `201 {product}` |
| GET | `/api/products/:productId` | — | `{product, variants, assets}` |
| PATCH | `/api/products/:productId` | partial | `200 {product}` |
| DELETE | `/api/products/:productId` | — | `204` (soft-delete → `deleted_at`) |
| POST | `/api/products/:productId/publish` | — | flips `status`→`live`, validates required fields |
| POST | `/api/products/:productId/archive` | — | `status`→`archived` |
| POST | `/api/products/:productId/variants` | variant body | `201` |
| PATCH | `/api/products/:productId/variants/:variantId` | | `200` |
| DELETE | `/api/products/:productId/variants/:variantId` | | `204` |
| POST | `/api/products/:productId/assets` | multipart file | uploads to GCS, returns `{asset_id, url}` |
| DELETE | `/api/products/:productId/assets/:assetId` | | `204` |
| GET | `/api/products/:productId/orders` | ?status=&limit=&offset= | order list |

### 5.2 Buyer / public

| Method | Path | Notes |
|---|---|---|
| GET | `/api/shop/:handle` | Returns `{merchant:{handle,name,avatar}, products:[…]}` — live products only, includes variants + gallery. |
| GET | `/api/shop/:handle/products/:slug` | Full product detail incl. Markdown, variants, gallery |
| POST | `/api/cart` | Body: `{merchant_handle, items:[{product_id, variant_id?, quantity}]}` — validates stock, prices; returns normalized cart with subtotal in `currency` |
| POST | `/api/checkout` | Body: `{cart, buyer:{email,name?,phone?}, shipping_address?}` — creates a `tbl_product_order` row + a `tbl_payment_link` (with `link_type='cart'`) + returns `{order_public_ref, payment_ref}` so the frontend can redirect to `/pay?d=<payment_ref>` |
| GET | `/api/order/:publicRef` | Returns order + line items + payment status. Digital line items include signed URLs **only if** `payment_status='paid'`. |
| POST | `/api/order/:publicRef/resend-download` | Regenerate signed URLs, re-email — rate-limited (max 5/order/day) |

### 5.3 Webhooks / internal

- The existing crypto-payment settlement webhook (in `cryptoCheckout.ts`) already sets `tbl_payment_link.status` to `paid` on confirmations. Extend it: **when the link's `link_type='cart'`, also flip the linked `tbl_product_order.payment_status='paid'`, decrement stock (§7.5), trigger fulfillment fan-out (§7.4), and send emails.**

---

## 6. Frontend Components (Next.js)

### 6.1 Merchant editor
- `pages/pay-links/products/index.tsx` — list page with tab bar sharing state with `pages/pay-links/index.tsx`. Table columns: image, title, type, price/from, stock, status, orders, edit.
- `pages/pay-links/products/new.tsx` and `pages/pay-links/products/[productId]/edit.tsx` — reuse `Components/Page/CreatePaymentLink/*` scaffold. Extract `ProductEditorForm.tsx`.
- Sub-components under `Components/UI/product-editor/`:
  - `ProductTypePicker.tsx` — 3 cards (digital / physical / service) with icons + short description
  - `ProductBasicFields.tsx` — title, subtitle, slug (autogen from title), category, currency, base price
  - `ProductDescriptionEditor.tsx` — Markdown textarea (reuse story renderer from `donationCampaign.tsx`)
  - `ProductGalleryUploader.tsx` — drag-drop, up to 10 images, primary/reorder
  - `ProductVariantsEditor.tsx` — table view; row-add w/ attributes (size/color/…), per-variant price + stock + image
  - `ProductDigitalDeliverySection.tsx` — file uploader / license-key input / URL input, depending on `digital_delivery_type`
  - `ProductShippingSection.tsx` — flat rate cents input + weight (optional)
  - `ProductServiceSection.tsx` — duration + calendar URL
  - `ProductPublishBar.tsx` — sticky footer with Save Draft / Publish + validation summary

### 6.2 Public shop
- `pages/[handle]/shop.tsx` — SSR grid. Reuse existing `pages/[handle].tsx` (creator page) layout for merchant header. Card component `Components/Page/Shop/ProductCard.tsx`.
- `pages/[handle]/p/[slug].tsx` — product detail. Gallery (`ProductGallery.tsx`), variant picker (`VariantPicker.tsx`), quantity input, "Add to cart" button, Markdown description.
- `pages/[handle]/cart.tsx` — cart view (reads localStorage → posts to `/api/cart` for validation → renders normalized cart). Buttons: continue shopping / checkout.
- `pages/[handle]/checkout.tsx` — collects email + name + shipping address (only if cart has a physical item). Posts to `/api/checkout` → redirects to `/pay?d=<payment_ref>` (uses **CleanCheckoutV2** already deployed in Session 44 Phase 1). No new checkout stack.
- `pages/order/[publicRef].tsx` — success/status page. Downloads for digital, tracking for physical, service links.

### 6.3 State
- **Cart state** — `contexts/CartContext.tsx`: keyed by `merchant_handle`, stored in `localStorage['dynopay_cart_v1']` as `{ [handle]: {items:[{product_id, variant_id, quantity, added_at}], last_synced_at}}`. Hydrates on mount; validates prices/stock against `/api/cart` on `/cart` and `/checkout` load. Never trust localStorage prices at checkout — always re-read from server.
- No server-side cart persistence in MVP (buyers are anonymous). Phase 2 can add server carts for logged-in buyers.

### 6.4 i18n
- New locale namespaces per language (6 langs): `product.json`, `shop.json`, `cart.json`, `checkout.json` (product-checkout copy — distinct from existing `checkout.*` in `common.json`), `orderEmail.json`.
- Copy audit and PR-style key list is TBD before Phase 1; blocked-key naming convention: `product.{editor|shop|detail|cart|checkout|order}.{key}`.

---

## 7. Flows

### 7.1 Merchant creates a product
1. `/pay-links/products/new` → picks type (digital/physical/service).
2. Enters title, slug (auto), description, cover image.
3. If **digital** + `delivery_type=file`: uploads file(s) → POST `/api/products/:id/assets` → returns `asset_id`.
4. If **has_variants**: opens variants panel, adds rows.
5. Saves Draft (POST `/api/products`) → previews at `/{handle}/p/{slug}?preview=1` (owner-only preview mode, bypasses `status=live` check when `res.locals.user.user_id === product.merchant_user_id`).
6. Hits Publish → POST `/api/products/:id/publish` → status flips to `live`, product appears in shop.

### 7.2 Buyer browses + adds to cart
1. Visits `/{handle}/shop`. SSR fetches `/api/shop/{handle}`.
2. Clicks product → `/{handle}/p/{slug}` — client-side navigation for smooth transitions.
3. Picks variant + qty → "Add to cart" → `CartContext.add({product_id, variant_id, quantity})` → localStorage updated + toast "Added to cart".
4. Continue browsing OR go to `/{handle}/cart`.

### 7.3 Checkout
1. `/checkout` posts current localStorage cart to `POST /api/cart` for revalidation (server checks: all products live + variant active + `stock_count > 0`; server returns authoritative unit prices and subtotal in merchant `currency`).
2. Any changed price / removed / out-of-stock → server returns `warnings[]` + updated cart snapshot → UI shows "The price of X changed" or "Y sold out" → buyer confirms.
3. Buyer enters email (required) + name (optional) + shipping address (required only if cart has any `product_type=physical` item).
4. Submits → `POST /api/checkout`:
   - Server re-runs cart validation (same code path).
   - Creates `tbl_product_order` row with status `pending`.
   - Creates a synthetic `tbl_payment_link` with:
     - `link_type='cart'`
     - `amount=total_cents/100`
     - `currency=order.currency`
     - `title=Order #{order.public_ref[:8]}`
     - `custom_fields.order_public_ref = order.public_ref`
   - Links: `order.payment_link_id = link.link_id` and returns `payment_ref` (the `link.ref`).
5. Frontend redirects to `/pay?d=<payment_ref>` — CleanCheckoutV2 handles crypto selection, QR, awaiting confirmations. Uses existing `link_type=cart` special-case (add to allow-list in `pages/pay/index.tsx` around L1000 where link-type gating lives).
6. On confirmation, the settlement webhook in `cryptoCheckout.ts` sees `link_type='cart'` → dispatches to a new `handleCartPaymentSettled(order_id)`.

### 7.4 Fulfillment (post-payment)
`handleCartPaymentSettled(order_id)`:
1. Marks `tbl_product_order.payment_status='paid'`, `paid_at=NOW()`.
2. For every `tbl_product_order_item`:
   - Look up product via `product_snapshot.product_type` (snapshot to survive post-hoc product edits).
   - **Digital-file**: generate signed GCS URLs (24h expiry) for each asset in `digital_delivery_payload.asset_ids`. Store in `item.delivered_payload.{signed_urls, expires_at}`. Mark `item.fulfillment_status='fulfilled'`.
   - **Digital-license-key**: pop a key from `digital_delivery_payload.keys` (atomic UPDATE ... RETURNING). Store in `item.delivered_payload.license_key`. Mark fulfilled.
   - **Digital-url**: copy `digital_delivery_payload.access_url` into `item.delivered_payload.access_url`. Mark fulfilled.
   - **Physical**: leave unfulfilled (merchant will manually mark shipped from dashboard, entering tracking number).
   - **Service**: attach `product.service_calendar_url` to `item.delivered_payload.calendar_url`. Mark fulfilled (delivery = link).
3. Recompute `order.fulfillment_status` = `fulfilled` if all items fulfilled, else `partial` if some are, else `unfulfilled`.
4. Increment `tbl_product.sold_count += quantity` per line item (used for social proof: "234 sold").
5. Decrement stock (**already reserved atomically at step 7.5** — this is just a sanity re-check).
6. Send emails (§8).

### 7.5 Stock atomicity
Stock is decremented **at order creation** (step 7.3.4), inside the same DB transaction that creates the order row:

```sql
BEGIN;
-- For every non-null-stock line item:
UPDATE tbl_product_variant
SET stock_count = stock_count - :qty
WHERE variant_id = :vid AND stock_count >= :qty
RETURNING variant_id;
-- (or tbl_product.base_stock when no variant)

-- If any UPDATE returns 0 rows → ROLLBACK, return 409 { code: 'OUT_OF_STOCK', line: … }.
INSERT INTO tbl_product_order …;
INSERT INTO tbl_product_order_item …;
COMMIT;
```

If the buyer never pays (payment expires or link_type='cart' abandoned), a scheduled job (`backend/scripts/cron_expire_cart_orders.ts`, runs every 5 min) finds `payment_status='pending'` orders older than `link.expires_at + 5min`, marks them `expired`, and re-increments stock.

### 7.6 Refund (manual)
Merchant clicks "Refund" on an order → `POST /api/products/orders/:orderId/refund { reason, restock:true|false }`:
- Marks `payment_status='refund_requested'` (crypto refunds are manual, merchant refunds off-chain — no on-chain interaction).
- If `restock:true`, re-increments stock.
- Sends refund-notice email to buyer (new template).
- Merchant marks `payment_status='refunded'` after they've actually sent crypto back.

---

## 8. Emails (Brevo — reuse existing `emailService.ts`)

Six new templates, all with i18n keys under `orderEmail.*` in `backend/locales/{lang}/emails.json`:

| Template | Trigger | To | Content |
|---|---|---|---|
| `sendOrderReceiptEmail` | order paid | buyer | Line items, prices, digital download links (or "shipping in 24h"), order public link `/order/{ref}` |
| `sendOrderReceiptMerchantEmail` | order paid | merchant | New sale notice, buyer info, shipping address (if physical), $ amount received |
| `sendOrderShippedEmail` | merchant marks shipped | buyer | Tracking number, carrier, ETA |
| `sendOrderRefundedEmail` | refund status → refunded | buyer | Refund confirmation |
| `sendDigitalDownloadReminderEmail` | scheduled 6h before signed URL expires | buyer | Renewed download link |
| `sendOrderExpiredEmail` | cart order expires unpaid | buyer | Optional — "you left items in your cart", cart restore link |

All templates use existing `t()` i18n helper (`utils/emailI18n.ts`) and `common.*` locale block for greeting/regards/team.

---

## 9. Storage (GCS)

Reuse existing GCP config (`PROJECT_ID=newdyno`, `GOOGLE_CLIENT_KEY` in `.env`). Provision one bucket:
- `dynopay-product-assets` (private, region: matches existing bucket if we have one)
- Object key pattern: `products/{merchant_user_id}/{product_id}/{asset_id}_{original_filename}`
- Access: **signed URLs only**, 24h expiry, no public read
- Optional Phase 2: object versioning + lifecycle rules to expire old versions

Uploads go through backend (`POST /api/products/:productId/assets` accepts multipart) — do NOT use direct-to-GCS pre-signed uploads in MVP (simpler; buyer-side upload doesn't apply here since only merchants upload).

Max upload size in MVP: **500 MB** per file (configurable via `.env` `PRODUCT_ASSET_MAX_MB=500`). Enforce at multer + at K8s ingress if possible.

---

## 10. Security & Access Control

- **Merchant CRUD**: `authMiddleware` + `ensureOwner(product.merchant_user_id === res.locals.user.user_id)`. Reuse Session 44 pattern.
- **Public shop routes**: no auth. Rate-limit by IP: 60 req/min on `/api/shop/*`, 20 req/min on `/api/cart` + `/api/checkout`.
- **Signed URLs**: 24h expiry, single-object read only. Buyer's ability to regenerate is rate-limited (5/day per order).
- **Slug collisions**: `UNIQUE(merchant_user_id, slug)` enforced at DB; frontend appends `-2`, `-3`, … on conflict.
- **Anti-enumeration**: `public_ref` is 24 hex chars (~96 bits) — unguessable without login.
- **XSS**: product Markdown rendered via existing safe renderer (h1-h3, bold, italic, lists, links, images with URL scheme allow-list, blockquote — from `donationCampaign.tsx`).
- **Cart tampering**: never trust client-supplied prices; server always recomputes from DB.
- **Stock race**: DB-level atomic decrement (§7.5).
- **File-type validation**: MIME + magic-byte sniff on upload. Disallow executables in MVP unless merchant confirms.
- **Refund abuse**: only merchant-of-record can trigger; audit-logged.

---

## 11. Analytics & Metrics

Track on the existing analytics pipeline (whatever powers `/dashboard`):
- `product_created`, `product_published`, `product_view`, `product_added_to_cart`, `cart_view`, `checkout_started`, `checkout_completed`, `order_paid`, `order_refunded`
- Aggregate on dashboard: total sales (7d/30d/90d), top products, conversion rate `cart_view → order_paid`.

---

## 12. Phased Rollout

Given multi-week scope, three phases:

### **Phase 1 — Digital-only MVP** (~4-6 days)
- Product model + variants (schema only) — full migration file
- Merchant editor: **digital products only** (no physical shipping fields wired, no service duration)
- Variants supported (size/color/tier) with per-variant price + stock
- Shop grid + product detail + cart + checkout
- Digital fulfillment (file signed URLs) — GCS integration
- Email: `sendOrderReceiptEmail` + `sendOrderReceiptMerchantEmail`
- i18n: English only for MVP shipping, other 5 langs stubbed with EN fallback
- **Success criterion**: hostbay@moxx.co can list a $5 ebook w/ 3 variants, buyer can purchase in USDT-TRC20, gets signed download link that expires 24h later

### **Phase 2 — Physical goods** (~3-4 days)
- Physical product fields (shipping flat rate, weight, address collection on checkout)
- Cart validates shipping cost per merchant
- Fulfillment UI (merchant marks shipped w/ tracking + carrier)
- Email: `sendOrderShippedEmail`
- Success criterion: hostbay can list a t-shirt with size variants, buyer completes purchase with shipping address, merchant marks shipped

### **Phase 3 — Services + polish + full i18n** (~2-3 days)
- Service product type (duration, calendar URL)
- Full 6-lang translation for editor + shop + emails
- Refund flow (manual)
- Signed-URL renewal / reminder email
- Analytics wiring
- Dashboard "Orders" view — filter by product + status
- Search on shop page (Phase 2 candidate; can defer to Phase 4)

### **Phase 4 — deferred (post-MVP)**
- Coupons / discount codes
- Product reviews
- Wishlists
- Real-time shipping rates
- Full tax by jurisdiction (via `TAX_DATA_API_URL`)
- Subscription products / recurring
- Multi-vendor marketplace

---

## 13. Migration + rollout risk

- All new tables — zero risk to existing data.
- Additive column changes on `tbl_payment_link` only if we need `link_type='cart'` (check current enum). If `link_type` is a free-text VARCHAR, no schema change. If it's an enum, migration required — write idempotent script following Session 44 pattern (`backend/scripts/add_crowdfunding_v2_cols.js`).
- Rollback plan: `DROP TABLE tbl_product_*` — zero coupling with payment link tables except the FK on `tbl_product_order.payment_link_id`, which is safe to leave.
- Feature flag: `NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG=true|false` in `.env`. When false, hides the merchant tab and the buyer `/shop` route.

---

## 14. Open questions (need PM decision)

- **Q1**: Which merchants get the tab in Phase 1? All merchants, or only opt-in via a settings toggle?
- **Q2**: For digital-license-key delivery, is key vending only via a static pool (merchant pastes 500 keys, we pop one on each sale), or do we also support "call this external URL to get a key"?
- **Q3**: For physical shipping, do we need international address support (state/region validation per country) or start with US/EU-only address forms?
- **Q4**: Currency: does the buyer see products in **merchant's `display_currency`** always, or does `useLocalPrice` convert to buyer's geo-detected currency (as it does today on payment link amount)?
- **Q5**: Should the merchant's existing `/{handle}` creator page auto-link to `/{handle}/shop` when they publish their first product, or is Shop a totally separate identity?
- **Q6**: Order numbers — should we surface a friendly human number (`ORD-2026-000123`) alongside the `public_ref` hex? Merchants + support teams prefer these.
- **Q7**: Underpaid crypto handling on multi-item carts — does CleanCheckoutV2's existing underpaid flow (partial credit) map cleanly to a cart, or do we require full-amount only? (Underpaid on a $50 cart is weird — you can't half-deliver an ebook and a t-shirt.)

---

## 15. Files that will be created (implementation preview)

**Backend**:
- `backend/scripts/add_product_catalog_tables.js` — DDL for 5 new tables
- `backend/models/userModels/productModel.ts`
- `backend/models/userModels/productVariantModel.ts`
- `backend/models/userModels/productAssetModel.ts`
- `backend/models/userModels/productOrderModel.ts`
- `backend/models/userModels/productOrderItemModel.ts`
- `backend/controller/product/productController.ts` — merchant CRUD
- `backend/controller/product/shopController.ts` — public browse
- `backend/controller/product/cartController.ts` — cart validate + checkout
- `backend/controller/product/orderController.ts` — order status + resend downloads
- `backend/controller/product/fulfillmentController.ts` — merchant marks shipped
- `backend/routes/productRouter.ts` — mount all above
- `backend/services/gcsAssetService.ts` — GCS signed-URL wrapper (reuse existing `@google-cloud/kms` deps + `@google-cloud/storage` if not already in `package.json`)
- Extend `backend/controller/payment/cryptoCheckout.ts` webhook handler to branch on `link_type='cart'`
- `backend/services/orderFulfillmentService.ts` — the post-paid fan-out
- Extend `backend/services/emailService.ts` — 6 new templates

**Frontend**:
- `pages/pay-links/products/index.tsx`, `new.tsx`, `[productId]/edit.tsx`, `[productId]/orders.tsx`
- `pages/[handle]/shop.tsx`, `[handle]/p/[slug].tsx`, `[handle]/cart.tsx`, `[handle]/checkout.tsx`
- `pages/order/[publicRef].tsx`
- `Components/UI/product-editor/*` (per §6.1)
- `Components/Page/Shop/{ProductCard,ProductGallery,VariantPicker,CartSummary}.tsx`
- `contexts/CartContext.tsx`
- Redux/Actions + Reducers + Sagas for products (mirror payment-link redux pattern)

**i18n**:
- `langs/locales/{en,es,fr,de,nl,pt}/product.json`, `shop.json`, `cart.json`, `checkoutProduct.json`
- `backend/locales/{lang}/emails.json` — new `orderEmail.*` block

**Docs**:
- This file (`memory/PRODUCT_CATALOG_SPEC.md`)
- Update `memory/UX_ROADMAP.md` — add Products as new phase after Phase 3.3 crowdfunding wraps
- Update `memory/CHANGELOG.md` — one entry per shipped phase
- Update `memory/PRD.md` — add Products section under "What's Been Implemented"

---

## 16. Approval / next step

Once this spec is approved:
1. I create the DB migration + models (~2 hrs).
2. I create the merchant editor UI for **digital products only** (~4-6 hrs).
3. I wire the shop page + cart + checkout redirect into CleanCheckoutV2 (~4 hrs).
4. I test end-to-end with `hostbay@moxx.co` selling one $5 test product to `qa.onboard.*@dynopaytest.com` via USDT-TRC20 (live Railway DB).

That's Phase 1. We stop, you validate, then Phase 2 (physical) + Phase 3 (services + i18n).

**Estimated total to MVP (Phase 1)**: 4–6 working days of build + testing.
