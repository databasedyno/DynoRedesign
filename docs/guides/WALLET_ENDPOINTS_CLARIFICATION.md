# Wallet Endpoints Clarification

## Current Issue:
All wallet endpoints are under a single "Wallet Management" tag, making it confusing because they serve two distinct purposes.

## Two Categories of Wallet Endpoints:

### Category 1: Wallet Address Management
**Purpose:** Managing cryptocurrency wallet addresses (where funds are stored/received)

**Endpoints:**
- `POST /api/wallet/validateWalletAddress` - Add wallet address (Step 1 - Send OTP)
- `POST /api/wallet/verifyOtp` - Add wallet address (Step 2 - Verify OTP)
- `POST /api/wallet/deleteWalletAddress` - Remove saved wallet address
- `GET /api/wallet/getWallet` - Get user's wallet addresses
- `GET /api/wallet/getWalletAddresses` - List all wallet addresses
- `POST /api/wallet/address/send-otp` - Send OTP to edit wallet address
- `PUT /api/wallet/address/:id` - Update wallet address

**What they do:**
- Add cryptocurrency addresses to your account
- Edit/delete saved addresses
- View your saved addresses
- Secure with OTP verification

---

### Category 2: Wallet Operations & Transactions
**Purpose:** Performing financial operations (deposits, withdrawals, exchanges, transactions)

**Endpoints:**

**Deposits:**
- `POST /api/wallet/addFunds` - Add funds to wallet

**Withdrawals:**
- `POST /api/wallet/sendConfirmationOTP` - Send OTP for withdrawal
- `POST /api/wallet/withdrawAssets` - Withdraw cryptocurrency

**Exchanges:**
- `POST /api/wallet/exchangeCreate` - Create crypto exchange
- `POST /api/wallet/confirmExchange` - Confirm exchange with OTP
- `GET /api/wallet/getExchange` - Get exchange details

**Transactions:**
- `GET /api/wallet/getWalletTransactions/{id}` - View transaction history
- `POST /api/wallet/getAllTransactions` - Get all transactions
- `GET /api/wallet/transaction/:id` - Get specific transaction
- `POST /api/wallet/transactions/export` - Export transaction history

**Payment Verification:**
- `POST /api/wallet/verifyCode` - Verify payment code
- `POST /api/wallet/authStep` - Authentication step
- `POST /api/wallet/verifyPayment` - Verify payment
- `POST /api/wallet/confirmPayment` - Confirm payment
- `POST /api/wallet/verifyCryptoPayment` - Verify crypto payment

**Utilities:**
- `POST /api/wallet/getCurrencyRates` - Get exchange rates
- `POST /api/wallet/estimateFees` - Calculate transaction fees
- `GET /api/wallet/network-fees` - Get network fees
- `POST /api/wallet/calculate-payment` - Calculate payment amount
- `POST /api/wallet/getUserAnalytics` - Get wallet analytics
- `GET /api/wallet/configured-currencies` - Get supported currencies

**What they do:**
- Manage funds (deposit, withdraw)
- Exchange cryptocurrencies
- View transaction history
- Calculate fees and rates
- Verify payments

---

## Recommended Solution:

### Rename Tags for Clarity:

**Tag 1:** "Wallet Addresses" 
- For managing crypto addresses

**Tag 2:** "Wallet Operations"
- For transactions, deposits, withdrawals, exchanges

This will make it immediately clear which endpoints are for:
- Setting up/managing your addresses (Wallet Addresses)
- Using your wallet for transactions (Wallet Operations)
