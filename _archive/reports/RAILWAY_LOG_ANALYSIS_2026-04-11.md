# Railway Log Analysis — 2026-04-11

## Executive Summary
One new visitor from Nigeria registered as a merchant but **abandoned onboarding at the Wallet Setup step** after ~13 minutes of activity. No backend errors caused this — all API calls returned 200/304. The drop-off appears to be **UX friction + slow response times on mobile**. Additionally, a **PHP vulnerability scanner** attacked the site, and there's a potential **wallet reminder cron bug**.

---

## 1. User Journey: Adnan Ayaro (User 86)

**Email:** ayaroadnan0@gmail.com  
**IP:** 102.91.102.24 (Nigeria)  
**Device:** Android 10, Chrome 130 Mobile  

### Timeline

| Time (UTC) | Event | Status |
|---|---|---|
| 20:52:27 | Arrived at dynopay.com (direct traffic) | ✅ |
| 20:52:33 | Visitor tracked → Admin notified: "New Visitor — Nigeria via Direct" | ✅ |
| 20:52:33 | Navigated to /auth/register | ✅ |
| 20:53:02 | Filling registration form (password validation icons loaded) | ✅ |
| 20:55:54 | `POST /api/user/registerUser` → 200 (5.4 sec!) | ✅ Slow |
| 20:55:59 | Admin email: "New Merchant Registration — Adnan Ayaro" | ✅ |
| 20:55:59 | Verification OTP sent to ayaroadnan0@gmail.com | ✅ |
| 20:57:08 | `POST /api/user/verify-email` → 200 (2.2 sec) | ✅ |
| 20:57:10 | Welcome email sent | ✅ |
| 20:57:15 | Redirected to /dashboard | ✅ |
| 20:57:43 | Dashboard loaded — onboarding status: `complete=false, next_steps=2` | ✅ |
| 20:57:50 | `GET /api/wallet/getWallet` → 200 (1.3 sec) | ✅ Slow |
| 20:58:13 | Loaded wallet page JS chunk (navigated to /wallet) | ✅ |
| 20:59:29 | Back to dashboard, re-fetched all APIs | ✅ |
| 20:59:43 | Went back to /auth/register (why?) | ⚠️ Confusion? |
| 21:00:21 | `GET /api/user/checkEmail` (checking own email) | ⚠️ Re-login |
| 21:00:37 | `POST /api/user/generateOTP` → new login OTP sent | ✅ |
| 21:01:42 | `POST /api/user/confirmOTP` → logged in again | ✅ |
| 21:01:46 | Dashboard loaded, onboarding still `next_steps=2` | ✅ |
| 21:03:08 | `POST /api/pay/calculateFees` → 200 (exploring fees) | ✅ |
| 21:04:17 | `GET /api/user/checkEmail` again | ⚠️ |
| 21:05:09 | `POST /api/user/google-signin` → 200 (tried Google sign-in!) | ✅ |
| 21:05:12 | Dashboard loaded, onboarding STILL `next_steps=2` | ✅ |
| **21:05:56** | **LAST ACTIVITY — User abandoned** | ❌ Drop-off |

### Key Observations
1. **Zero backend errors** — every API call returned 200 or 304
2. **User never submitted wallet creation** — no `POST /api/wallet/createWallet` or `addWallet` calls logged
3. **User logged in 3 times** in 13 minutes (email+OTP, re-logged OTP, Google sign-in) — suggests confusion or session issues
4. **Slow API responses** — Registration took 5.4s, wallet fetches took 1.2-1.5s, dashboard calls took 800-1000ms. On a Nigerian mobile connection this creates a poor experience
5. **User navigated to wallet page but didn't complete** — likely confused by what crypto wallet address to enter
6. The onboarding step "Wallet Setup" requires the user to enter a crypto wallet address — a Nigerian mobile user new to crypto may not have one

### Root Cause Assessment
**Not a bug — UX friction for new users.** The user understood the registration flow but was blocked by the wallet setup step which requires a pre-existing crypto wallet address. A new merchant who doesn't yet have a USDT/BTC wallet will not be able to proceed.

### Recommendations
- Add a "Skip for now" option on wallet setup (let them explore the dashboard first)
- Add guided wallet setup with "I don't have a wallet yet" path
- Consider auto-creating a custodial wallet option
- Optimize API response times (5.4s registration is too slow for mobile)

---

## 2. Other Anomalies Found

### 🔴 PHP Vulnerability Scanner Attack
**Time:** 2026-04-10 ~22:30-22:32 UTC  
**Impact:** Hundreds of requests probing for PHP backdoors (`shell.php`, `ws60.php`, `admin-ajax.php`, `wp-content/plugins/hellopress/wp_filemanager.php`, etc.)  
**Status:** All returned 404 (no vulnerability found)  
**Recommendation:** Consider adding rate limiting for 404 responses or WAF rules to block known attack patterns

### 🟡 Wallet Reminder Cron Bug (Potential)
**Evidence:** At 21:00 UTC, the "Wallet Reminder Cron Job" ran and found "0 users without wallets to remind" — but user 86 had just registered at 20:56 and had NOT set up a wallet.  
**Possible Cause:** The reminder may have a minimum time delay (e.g., only reminds after 24h), or its query doesn't include users who registered within the same hour.  
**Recommendation:** Verify the wallet reminder query includes recent registrations

### 🟡 Merchant Webhook 404s (Company 3 — Ongoing)
**Evidence:** `lockbaypaymentfixing-production.up.railway.app/webhook/dynopay` returned 404 three times (3/5 before auto-disable)  
**Impact:** Merchant not receiving payment webhooks at their URL  
**Recommendation:** Contact Company 3 to update their webhook URL

### 🟡 Low Fee Wallet Balances
- TRX: $12.2 (threshold: $30) — CRITICAL  
- POLYGON: $0.32 (threshold: $30)  
- XRP: $13.92 (threshold: $30)  
- ETH: $26.1 (threshold: $30)  
**Recommendation:** Top up fee wallets, especially TRX which is used for USDT-TRC20 settlements

### 🟢 BinanceWS Geo-blocked
- Binance WebSocket returning 451 from this server region  
- Fallback to CoinGecko REST API is working correctly  
- Price updates continuing every 5 minutes via fallback  
**Status:** Handled gracefully, no action needed

---

## 3. Positive Findings
- ✅ Registration flow works end-to-end (email + OTP verification)
- ✅ Google sign-in works
- ✅ Dashboard loads and displays data correctly for new users
- ✅ Onboarding status tracking works (correctly shows incomplete status)
- ✅ Email notifications work (visitor alert, registration, verification, welcome, admin notification)
- ✅ BTC payment settled successfully ($1 BTC via LockBay API integration)
- ✅ All health monitors operational (API Gateway, Payment Processing, Wallet Services, Webhook Delivery, Dashboard)
- ✅ Webhook queue healthy (0 waiting, 0 failed)
