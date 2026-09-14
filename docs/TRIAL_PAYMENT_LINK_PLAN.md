# Trial Payment Link — Complete Implementation Plan

## Document Version
- **Created**: 2026-03-20
- **Status**: Draft — Pending Approval
- **Author**: Engineering

---

## 1. Executive Summary

Implement the end-to-end "Create a Payment Link — No Account Needed" flow. When a visitor creates a trial payment link, the system auto-provisions a **provisional user + company** using their email. This allows the existing merchant pool, checkout, webhook, and settlement pipelines to work unchanged. When the creator "claims" their funds, they **activate** the existing provisional account (set password, update company name, add wallet) rather than creating a new one.

---

## 2. Current State Analysis

### What EXISTS (scaffolding):
| Component | Status | Location |
|-----------|--------|----------|
| Trial Link DB model | ✅ Complete | `models/trialPaymentLinkModel.ts` |
| Creation endpoint | ✅ Working | `POST /api/public/create-trial-link` |
| Get trial link | ✅ Working | `GET /api/public/trial/:slug` |
| Management token lookup | ✅ Working | `GET /api/public/trial/manage/:token` |
| Claim endpoint | ✅ Code exists | `POST /api/public/claim-funds` |
| Trial conversion service | ⚠️ Never called | `services/trialConversionService.ts` |
| Frontend: `/try/[slug]` | ⚠️ Display only | `pages/try/[slug]/index.tsx` |
| Frontend: `/try/manage/[token]` | ⚠️ Display only | `pages/try/manage/[token].tsx` |
| Frontend: `/try/[slug]/claim` | ⚠️ UI exists | `pages/try/[slug]/claim.tsx` |
| Expiry cron | ❌ Not scheduled | `expireStaleTrialLinks()` never called |

### What's MISSING (core payment flow):
| Component | Gap |
|-----------|-----|
| Provisional user/company creation | Not created at trial link creation time |
| Payment link + checkout URL | Not generated; no `/pay?d=...` redirect |
| API key for provisional company | Not created (required by `createPaymentLink`) |
| Pool address reservation | Cannot work without `user_id` / `company_id` |
| Webhook → `markTrialLinkPaid()` | Never called from webhook processor |
| Settlement after claim | No sweep-to-merchant logic |
| Trial expiry cron | Not wired in `server.ts` |

---

## 3. Architecture Decision: Per-Creator Provisional Account

### Approach
When a visitor creates a trial link, the system immediately creates:
1. **Provisional user** (status: `trial`, email from creator, random internal password)
2. **Provisional company** (name: email prefix, linked to user)
3. **API key** (active, linked to company — required for payment link creation)
4. **Standard payment link** (via existing `createPaymentLink` logic → generates `/pay?d={ref}` URL)

### Why This Approach
- **Zero changes to payment pipeline**: The existing `Crypto()` → pool reservation → webhook → settlement flow works as-is
- **Pool addresses are properly owned**: Each trial creator's addresses are linked to their (provisional) `user_id` + `company_id`
- **Claim = activation, not creation**: The `claimFunds` endpoint activates the existing user (sets real password, updates company name) instead of creating new records
- **No orphan data**: If the trial link expires, the provisional user/company can be cleaned up

### Provisional Account Properties
| Entity | Field | Value |
|--------|-------|-------|
| **User** | `status` | `"trial"` (cannot log in until claimed) |
| **User** | `email` | Creator's email |
| **User** | `password` | Random 64-char hex (not usable for login) |
| **User** | `login_type` | `"EMAIL"` |
| **User** | `name` | Email prefix (e.g., `john` from `john@gmail.com`) |
| **User** | `fee_tier` | `"trial"` |
| **User** | `fee_free_remaining_usd` | `500` (default $500 free trial) |
| **Company** | `company_name` | Email prefix + `"'s Business"` |
| **Company** | `email` | Creator's email |
| **API Key** | `status` | `"active"` |
| **API Key** | `environment` | `"production"` |
| **API Key** | `api_name` | `"Trial API Key"` |

---

## 4. Complete Flow — Step by Step

### Phase A: Trial Link Creation

```
Creator visits DynoPay landing page
  → Fills form: email, amount, currency, description
  → POST /api/public/create-trial-link

Backend:
  1. Validate input (email, amount $5–$500, rate limit 5/IP/24h)
  2. Check if email already has a full account (status != 'trial')
     → If yes: return error "You already have an account, please log in"
  3. Check if email already has a provisional account (status == 'trial')
     → If yes: reuse that user_id + company_id (don't create duplicate)
     → If no: create provisional user → company → API key
  4. Create standard payment link (reuse createPaymentLink logic internally):
     - transaction_id: UUID
     - base_amount / base_currency: from input
     - user_id / company_id: from provisional account
     - accepted_currencies: "BTC,ETH,USDT-TRC20,USDT-ERC20"
     - fee_payer: "company" (fees deducted from merchant's received amount)
     - payment_link: "{CHECKOUT_URL}/pay?d={uniqueRef}"
     - expires_at: 24 hours
  5. Store Redis checkout data: "customer-{uniqueRef}" → payment link payload
  6. Create trial link record:
     - slug, amount, fiat_currency, description
     - user_id, company_id (from provisional account)
     - checkout_ref: uniqueRef (to link trial → payment link → checkout)
     - status: "active"
  7. Send management email with:
     - Payment link URL: /try/{slug} (shows info + redirects to checkout)
     - Management URL: /try/manage/{managementToken}
  8. Return: { slug, link_url, manage_url, checkout_url, ... }
```

### Phase B: Customer Payment (Existing Checkout)

```
Customer receives payment link from creator
  → Visits /try/{slug}

Frontend (/try/[slug]):
  1. Fetch trial link data: GET /api/public/trial/{slug}
  2. If status == "active" and has checkout_url:
     → Show payment info card + "Pay Now" button
     → On click: redirect to /pay?d={checkout_ref} (existing checkout page)
     OR: Embed existing checkout directly (with checkout_ref)
  3. If status == "paid": show "Payment received" + claim CTA
  4. If status == "expired": show expiry message

Checkout Page (/pay?d={ref}):
  1. Standard flow: loads payment data from Redis "customer-{ref}"
  2. Customer selects crypto (BTC, ETH, etc.)
  3. POST /api/pay/addPayment → Crypto() → reserveAddress() from provisional company's pool
  4. Shows QR code + deposit address + countdown timer
  5. Customer sends crypto

Webhook Processing (existing pipeline):
  1. Tatum webhook fires when crypto arrives at pool address
  2. webhookProcessor handles it (no changes needed — it's a normal payment)
  3. Payment marked as "successful" in Redis + DB
  4. Payment link status → "paid"

NEW: Trial Link Status Update
  5. After payment link is marked paid, check if it's linked to a trial link
  6. Call markTrialLinkPaid(slug, amount, currency, txHash)
  7. Send "Payment Received!" email to creator with management/claim link
```

### Phase C: Claim (Account Activation)

```
Creator clicks management link or "Claim" button
  → Visits /try/{slug}/claim (or /try/manage/{token})

Frontend:
  1. Shows claim form:
     - Password (required — to activate the account)
     - Company name (optional — defaults to email prefix)
     - Settlement wallet address (required — to receive funds)
  2. POST /api/public/claim-funds

Backend (REVISED — activation instead of creation):
  1. Validate management_token or slug
  2. Verify trial link status == "paid"
  3. Look up the provisional user_id + company_id from the trial link
  4. ACTIVATE the account:
     a. Update user: status "trial" → "active", set real password (bcrypt)
     b. Update company: set company_name (if provided)
     c. Create wallet address record (tbl_user_addresses) for paid_currency
     d. Create wallet entry (tbl_user_wallet) for dashboard display
  5. Link settlement: store wallet_address in trial link + company
  6. Trigger settlement:
     → If funds are still in the pool address (haven't been admin-swept):
       Sweep from pool temp address → merchant's settlement wallet
     → If funds already swept to admin:
       Schedule payout from admin wallet → merchant's wallet
  7. Update trial link: status → "claimed", claimed_at, user_id, company_id
  8. Return: { user_id, company_id, email, message }

Creator can now log in with email + password
  → Dashboard shows their first transaction
  → Company name is editable in settings
```

### Phase D: Expiry & Cleanup

```
Cron (every hour):
  1. expireStaleTrialLinks():
     - Active links past expires_at → status "expired"
     - Release any reserved pool addresses
     - Paid but unclaimed links past claim_expires_at → status "refunded"
       → Sweep funds back to admin wallet or flag for refund
  2. Cleanup provisional accounts:
     - Users with status "trial" and no active trial links → soft delete or keep for 30 days
```

---

## 5. Database Changes

### Modify: `tbl_trial_payment_links`
Add columns:
```sql
-- Link to provisional account (populated at creation)
user_id        INTEGER REFERENCES tbl_user(user_id)      -- already exists
company_id     INTEGER REFERENCES tbl_company(company_id) -- already exists

-- Link to standard payment link for checkout
checkout_ref       VARCHAR(255)  -- Redis key ref for "customer-{ref}" checkout data
payment_link_id    INTEGER       -- FK to tbl_payment_link.link_id
checkout_url       TEXT          -- Full checkout URL: /pay?d={ref}
```

### No changes needed to:
- `tbl_user` — `status: "trial"` uses existing field
- `tbl_company` — standard creation
- `tbl_api` — standard creation
- `tbl_payment_link` — standard creation
- `tbl_merchant_temp_address` — pool works via `owner_user_id`

---

## 6. API Contract Changes

### Modified: `POST /api/public/create-trial-link`

**Request** (unchanged):
```json
{
  "email": "john@example.com",
  "amount": 50,
  "currency": "USD",
  "description": "Invoice #123"
}
```

**Response** (enhanced):
```json
{
  "status": 201,
  "message": "Payment link created! Check your email.",
  "data": {
    "id": "uuid",
    "slug": "xK4m2pQz",
    "link_url": "https://dynopay.com/try/xK4m2pQz",
    "manage_url": "https://dynopay.com/try/manage/{token}",
    "checkout_url": "https://dynopay.com/pay?d={ref}",
    "amount": 50,
    "currency": "USD",
    "description": "Invoice #123",
    "expires_at": "2026-03-21T17:00:00.000Z",
    "accepted_currencies": ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20"],
    "status": "active"
  }
}
```

### Modified: `GET /api/public/trial/:slug`

**Response** (enhanced):
```json
{
  "data": {
    "slug": "xK4m2pQz",
    "amount": "50.00",
    "fiat_currency": "USD",
    "description": "Invoice #123",
    "status": "active",
    "checkout_url": "https://dynopay.com/pay?d={ref}",
    "accepted_currencies": ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20"],
    "expires_at": "...",
    "is_expired": false,
    "is_paid": false,
    "is_claimed": false
  }
}
```

### Modified: `POST /api/public/claim-funds`

**Request** (simplified — no user/company creation):
```json
{
  "management_token": "abc123...",
  "password": "MySecurePass123!",
  "company_name": "John's Coffee Shop",
  "wallet_address": "TXyz...abc"
}
```

**Response**:
```json
{
  "status": 200,
  "message": "Account activated! Funds are being settled to your wallet.",
  "data": {
    "user_id": 42,
    "company_id": 18,
    "email": "john@example.com",
    "paid_currency": "BTC",
    "wallet_address": "TXyz...abc",
    "settlement_status": "pending"
  }
}
```

---

## 7. Frontend Changes

### `/try/[slug]` — Trial Payment Page
**Current**: Shows crypto list with non-functional buttons  
**New**: 
- Shows payment info card with amount, description, expiry countdown
- **"Pay Now" button** → redirects to `checkout_url` (existing `/pay?d=...` page)
- OR: If status == "paid" → shows "Payment Received!" + "Claim Your Funds" CTA
- Auto-polls status every 15s (existing)

### `/try/[slug]/claim` — Claim Page
**Current**: Creates new user + company from scratch  
**New**:
- Form: password + company name (optional) + wallet address (required)
- Calls modified `POST /api/public/claim-funds` which **activates** the provisional account
- On success: redirect to login page or auto-login

### `/try/manage/[token]` — Management Page
**Current**: Shows status info  
**New**: Add "Share Checkout Link" copy button, show checkout URL prominently

---

## 8. Implementation Phases

### Phase 1: Backend — Provisional Account + Payment Link (Core)
**Files**: `controller/publicTrialController.ts`, `models/trialPaymentLinkModel.ts`
- [ ] Add `checkout_ref`, `payment_link_id`, `checkout_url` columns to trial model
- [ ] Modify `createTrialLink`: create provisional user → company → API key → payment link
- [ ] Handle "email already exists" edge cases (reuse provisional, reject full accounts)
- [ ] Generate and store checkout URL
- **Test**: Create trial link → verify user/company/API key in DB → verify Redis checkout data

### Phase 2: Backend — Webhook Integration
**Files**: `services/webhookProcessor.ts` or `controller/paymentController.ts`
- [ ] After payment link marked "paid", check if linked to a trial link
- [ ] Call `markTrialLinkPaid()` from conversion service
- [ ] Send "Payment Received" email to creator
- [ ] Wire `expireStaleTrialLinks()` into server.ts cron (every hour)
- **Test**: Simulate webhook → verify trial link status changes to "paid"

### Phase 3: Backend — Claim = Activate Account
**Files**: `controller/publicTrialController.ts`
- [ ] Rewrite `claimFunds` to **activate** provisional account instead of creating new one
- [ ] Update user status: `trial` → `active`, set real password
- [ ] Create wallet records, update company name
- [ ] Trigger settlement (sweep funds from pool address → merchant wallet)
- **Test**: Call claim endpoint → verify user status changed, wallet created, settlement queued

### Phase 4: Frontend — Trial Payment Page + Claim Page
**Files**: `pages/try/[slug]/index.tsx`, `pages/try/[slug]/claim.tsx`, `pages/try/manage/[token].tsx`
- [ ] Add "Pay Now" button that redirects to checkout_url
- [ ] Update claim form: password + company name + wallet address
- [ ] Update management page: show checkout URL, copy button
- **Test**: Full E2E via Playwright

### Phase 5: Login Guard for Trial Users
**Files**: `controller/userController.ts` (login endpoint)
- [ ] If user status == `trial`, reject login with message: "Please claim your funds first to activate your account"
- **Test**: Attempt login with trial-status email → verify rejection

---

## 9. Edge Cases & Guards

| Scenario | Handling |
|----------|----------|
| Creator email already has full account | Reject: "You already have an account. Log in to create payment links." |
| Creator email already has provisional trial account | Reuse: same user_id/company_id, create new trial link under it |
| Trial link expires before payment | Mark expired, release pool address (if any reserved), keep provisional account for 30 days |
| Payment received but never claimed (72h) | Mark refunded, sweep funds back to admin, keep provisional account |
| Creator tries to log in before claiming | Block login: "Activate your account by claiming your payment first" |
| Same customer pays twice on same link | Standard checkout handles this (payment link becomes "paid" on first success) |
| Creator creates multiple trial links | All links share the same provisional user/company (up to rate limit) |
| Pool has no available addresses for provisional company | Lazy pool initialization creates addresses on-demand (existing behavior) |

---

## 10. Security Considerations

- Provisional users **cannot log in** (status: `trial`, password is random hex)
- Trial links expire in **24 hours** (configurable)
- Unclaimed funds expire in **72 hours** after payment
- Rate limit: **5 trial links per IP per 24h**
- Amount limit: **$5–$500** (KYC-free threshold)
- Management token is **SHA-256 hashed** in DB (only emailed to creator)
- Provisional API keys have restricted permissions

---

## 11. Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Pool initialization delay on first payment | Lazy init adds ~2-5s on first crypto selection. Acceptable for trial flow. |
| Provisional account cleanup | Cron job to expire + optionally soft-delete after 30 days |
| Email deliverability | Management URL also returned in API response as fallback |
| Webhook not calling markTrialLinkPaid | Add trial link check in the payment_link status update handler (not in webhookProcessor directly) |

---

## 12. Success Metrics

- Trial link creation → checkout → payment → claim: **< 10 min** average
- Creator account activation rate: Target **> 40%** of paid trial links
- Zero manual intervention needed for the standard flow
