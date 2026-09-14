# DynoPay — Cryptocurrency Payment Gateway

> **Auto-Stablecoin Conversion** — One-click invoice → payment link → auto-stablecoin conversion → downloadable tax-ready report

A production-grade, multi-chain cryptocurrency payment processing platform with auto-stablecoin conversion, merchant pool management, QR codes with currency logos, and comprehensive webhook integration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Quick Start (Local Development)](#quick-start-local-development)
5. [Emergent Platform Setup](#emergent-platform-setup)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Core Features](#core-features)
8. [Payment Flow](#payment-flow)
9. [API Overview](#api-overview)
10. [Third-Party Integrations](#third-party-integrations)
11. [Cron Jobs & Background Processes](#cron-jobs--background-processes)
12. [Testing](#testing)
13. [Deployment (Railway)](#deployment-railway)
14. [Security Features](#security-features)
15. [Key Files Reference](#key-files-reference)
16. [Troubleshooting](#troubleshooting)
17. [Admin Credentials](#admin-credentials)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DynoPay Architecture                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌────────────────────────────────────────────┐   │
│  │   React 19   │    │         Python/uvicorn (port 8001)         │   │
│  │  Frontend    │───>│   Lightweight ASGI reverse proxy           │   │
│  │  (port 3000) │    │   server.py → proxies to Node.js           │   │
│  └─────────────┘    └──────────────┬─────────────────────────────┘   │
│                                     │                                │
│                                     ▼                                │
│                      ┌──────────────────────────────┐                │
│                      │   Node.js/Express (port 3300)  │                │
│                      │   server.ts — main backend     │                │
│                      │   21 route files, 20 controllers│               │
│                      │   30+ services, cron jobs      │                │
│                      └───────┬───────────┬────────────┘                │
│                              │           │                            │
│                    ┌─────────┘           └──────────┐                │
│                    ▼                                 ▼                │
│         ┌────────────────┐                ┌─────────────────┐        │
│         │  PostgreSQL     │                │  Redis           │        │
│         │  (Railway)      │                │  (Railway)       │        │
│         │  Sequelize ORM  │                │  Caching, Locks  │        │
│         └────────────────┘                │  Rate Limiting   │        │
│                                           │  Payment State   │        │
│                                           └─────────────────┘        │
│                                                                      │
│  External Services:                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Tatum    │ │ Binance  │ │ Brevo    │ │ Google   │ │ Veriff   │  │
│  │ SDK      │ │ Convert  │ │ Email    │ │ Cloud    │ │ KYC      │  │
│  │ (crypto) │ │ API + WS │ │ API      │ │ KMS      │ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Why Python + Node.js?

The backend is **pure Node.js/TypeScript**. The Python layer (`server.py`) is a **thin ASGI reverse proxy** required because the hosting infrastructure (Kubernetes/supervisor) expects a Python/uvicorn process on port 8001. The proxy adds <5ms overhead and:

1. Launches the Node.js backend on internal port 3300
2. Proxies all HTTP requests from port 8001 → port 3300
3. Monitors the Node.js process and auto-restarts on crash

**You should never need to modify `server.py`** — all business logic lives in the TypeScript codebase.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 20.x |
| **Language** | TypeScript | 5.x |
| **Web Framework** | Express | 4.18 |
| **ORM** | Sequelize | 6.32 |
| **Database** | PostgreSQL | (Railway-hosted) |
| **Cache/Queue** | Redis | 4.6.x client |
| **Job Queue** | BullMQ | 5.69 |
| **Blockchain SDK** | Tatum API Client | 2.2.x |
| **Exchange** | Binance REST + WebSocket | Custom integration |
| **Email** | Brevo (Sendinblue) API | REST |
| **QR Codes** | qrcode + sharp | 1.5.x / 0.34.x |
| **PDF** | PDFKit | 0.17 |
| **Auth** | JWT + bcrypt + TOTP (otplib) | — |
| **Logging** | Winston | 3.14 |
| **Frontend** | React 19 + Tailwind CSS | — |
| **Proxy Layer** | Python/uvicorn + httpx | 3.11 / 0.25 |
| **Process Manager** | Supervisor | — |

---

## Project Structure

```
/app/
├── backend/                        # Main backend (Node.js/TypeScript)
│   ├── server.py                   # Python ASGI proxy (DO NOT MODIFY)
│   ├── server.ts                   # Express app entry point + cron jobs
│   ├── package.json                # Node.js dependencies
│   ├── requirements.txt            # Python dependencies (for proxy)
│   ├── tsconfig.json               # TypeScript configuration
│   ├── jest.config.ts              # Jest test configuration (3 projects)
│   ├── .env                        # Environment variables (PROTECTED)
│   ├── start_backend.sh            # Startup script (installs deps → runs uvicorn)
│   │
│   ├── apis/                       # External API client wrappers
│   │   └── (Tatum, Binance client modules)
│   │
│   ├── controller/                 # Route handlers (20 controllers)
│   │   ├── paymentController.ts    # Core payment logic (~8100 lines)
│   │   ├── walletController.ts     # Wallet management
│   │   ├── userController.ts       # User auth & management
│   │   ├── adminController.ts      # Admin operations
│   │   ├── invoiceController.ts    # Invoice generation
│   │   ├── analyticsController.ts  # Business analytics
│   │   ├── sessionController.ts    # Session & refresh tokens
│   │   ├── twoFactorController.ts  # 2FA operations
│   │   ├── kycController.ts        # KYC (Veriff) integration
│   │   └── ...                     # dashboard, company, tax, etc.
│   │
│   ├── database/                   # Sequelize migrations
│   │
│   ├── helper/                     # Email templates, utilities
│   │   └── currencyConvert.ts      # Fiat ↔ crypto rate conversions
│   │
│   ├── middleware/                  # Express middleware (17 files)
│   │   ├── authMiddleware.ts       # JWT authentication
│   │   ├── adminAuthMiddleware.ts  # Admin-only routes
│   │   ├── csrfMiddleware.ts       # CSRF double-submit cookie
│   │   ├── rateLimitMiddleware.ts  # Redis-backed rate limiting
│   │   ├── sanitizeInput.ts        # XSS prevention
│   │   ├── validateRequest.ts      # Joi input validation
│   │   └── ...
│   │
│   ├── models/                     # Sequelize models
│   │   ├── index.ts                # Model exports
│   │   ├── customerModels/         # Customer/user models
│   │   ├── companyModels/          # Company (multi-tenant)
│   │   ├── merchantPoolModels/     # Merchant pool addresses
│   │   ├── apiModels/              # API key models
│   │   ├── securityModels/         # Login attempts, sessions
│   │   ├── referralModels/         # Referral system
│   │   └── ...
│   │
│   ├── routes/                     # Express route definitions (21 files)
│   │   ├── index.ts                # Main router + webhook routes + IP allowlist
│   │   ├── userRouter.ts           # /api/user/*
│   │   ├── paymentRouter.ts        # /api/payment/*
│   │   ├── walletRouter.ts         # /api/wallet/*
│   │   ├── merchantApiRouter.ts    # /api/merchant/* (external merchant API)
│   │   ├── adminRouter.ts          # /api/admin/*
│   │   ├── diagnosticsRouter.ts    # /api/diagnostics/*
│   │   └── ...
│   │
│   ├── services/                   # Business logic (30+ services)
│   │   ├── paymentStateMachine.ts  # Payment state transitions & validation
│   │   ├── webhookProcessor.ts     # BullMQ webhook processing
│   │   ├── binanceService.ts       # Binance API + proxy detection
│   │   ├── binanceWebSocketService.ts # Binance WS price feeds
│   │   ├── conversionService.ts    # Auto-stablecoin conversion
│   │   ├── reconciliation.ts       # Stuck payment recovery
│   │   ├── feeService.ts           # Dynamic fee calculation
│   │   ├── blockchainFeeService.ts # Gas/fee estimation
│   │   ├── emailService.ts         # Brevo email sending
│   │   ├── errorMonitoringService.ts # Redis-backed error buffer + alerts
│   │   ├── sseService.ts           # Server-Sent Events
│   │   ├── sessionService.ts       # User session management
│   │   ├── twoFactorService.ts     # TOTP 2FA
│   │   ├── sshTunnelManager.ts     # SSH SOCKS5 tunnel for Binance
│   │   ├── tronEnergyService.ts    # TRON energy estimation
│   │   │
│   │   ├── merchantPool/           # Merchant pool subsystem
│   │   │   ├── merchantPoolWallet.ts       # Pool address creation
│   │   │   ├── merchantPoolReservation.ts  # Address reservation
│   │   │   ├── merchantPoolSweep.ts        # Fund sweeping
│   │   │   ├── merchantPoolMonitoring.ts   # Health monitoring
│   │   │   ├── merchantPoolTransaction.ts  # Transaction tracking
│   │   │   ├── merchantPoolConfig.ts       # Per-chain configuration
│   │   │   └── directEvmTransfer.ts        # Direct EVM transfers
│   │   │
│   │   └── chains/                 # Per-chain blockchain logic
│   │
│   ├── swagger/                    # Swagger/OpenAPI documentation (225 paths)
│   │   └── paths/                  # Per-domain path definitions
│   │
│   ├── types/                      # TypeScript type definitions
│   ├── utils/                      # Shared utilities
│   │   ├── redisInstance.ts        # Redis client + locks
│   │   ├── dbInstance.ts           # Sequelize connection (keepAlive, retry)
│   │   ├── loggers.ts              # Winston loggers
│   │   ├── envValidator.ts         # Startup env var validation
│   │   ├── qrCodeWithLogo.ts       # QR + currency logo overlay
│   │   └── securityLogger.ts       # Security event logging
│   │
│   ├── webhooks/                   # Tatum webhook handlers
│   │   └── index.ts                # tatumWebHook, tatumCryptoWebHook
│   │
│   ├── __tests__/                  # Jest test suite (500+ tests)
│   │   ├── __mocks__/              # Redis, DB, model mocks
│   │   ├── api/                    # Integration tests (supertest)
│   │   ├── paymentStateMachine.test.ts
│   │   ├── webhookProcessor.test.ts
│   │   └── ...
│   │
│   └── public/                     # Static assets
│
├── frontend/                       # React frontend (minimal/placeholder)
│   ├── package.json
│   ├── .env                        # REACT_APP_BACKEND_URL (PROTECTED)
│   ├── src/
│   │   ├── App.js                  # Main React app
│   │   ├── components/ui/          # shadcn/ui components
│   │   └── lib/                    # Utility functions
│   └── tailwind.config.js
│
├── docs/                           # Documentation
│   ├── guides/                     # Setup & operational guides
│   │   ├── ENV_VARS_COMPLETE_GUIDE.md
│   │   ├── DEPLOY_AND_TEST_GUIDE.md
│   │   ├── RAILWAY_ENV_VARS.md
│   │   ├── BINANCE_PROXY_SETUP.md
│   │   ├── KYC_DOCUMENTATION.md
│   │   └── ...
│   ├── plans/                      # Architecture & refactoring plans
│   └── reports/                    # Analysis & test reports
│
├── tests/                          # Additional test scripts (Python)
├── scripts/                        # Operational scripts
├── memory/PRD.md                   # Product Requirements Document
├── incident-playbook.md            # Production incident runbook
└── test_result.md                  # Testing history & results
```

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js** 20.x+
- **Python** 3.11+ (for the proxy layer)
- **PostgreSQL** (or Railway-hosted)
- **Redis** (or Railway-hosted)
- **yarn** (not npm — npm causes breaking changes)

### Step 1: Clone & Install Dependencies

```bash
# Backend (Node.js)
cd /app/backend
yarn install

# Backend (Python proxy)
pip install -r requirements.txt
# Or with venv: /root/.venv/bin/pip install -r requirements.txt

# Frontend
cd /app/frontend
yarn install
```

### Step 2: Configure Environment Variables

```bash
cd /app/backend
cp .env.example .env   # If .env.example exists
# Or create .env manually — see "Environment Variables Reference" below
```

**Minimum required variables:**
```bash
# Database (PostgreSQL)
DB_NAME=db_bozzwallet
USER_NAME=postgres
PASSWORD=<your_db_password>
HOST=<your_db_host>
DB_PORT=5432

# Redis
REDIS_PUBLIC_URL=redis://<user>:<password>@<host>:<port>

# Security
ACCESS_TOKEN_SECRET=<random_64_char_hex>
API_SECRET=<random_48_char_hex>
CYPHER_KEY=<random_128_char_hex>

# Tatum (blockchain)
TATUM_KEY=<your_tatum_api_key>

# Server
PORT=8001
SERVER_URL=http://localhost:8001
FRONTEND_URL=http://localhost:3000
```

### Step 3: Start Services

```bash
# Option A: Via supervisor (production-like, recommended on Emergent)
sudo supervisorctl restart all

# Option B: Development mode
cd /app/backend
yarn dev     # Node.js with nodemon hot-reload

# In another terminal:
cd /app/frontend
yarn start   # React dev server on port 3000
```

### Step 4: Verify

```bash
# Backend health check
curl http://localhost:8001/health

# Expected response:
# {"status":"healthy","service":"Dynopay Backend","database":"connected","redis":"connected"}

# Swagger API docs
# Open: http://localhost:8001/api/docs
```

---

## Emergent Platform Setup

> **For AI agents working on this project inside the Emergent cloud environment.**

### How It Works on Emergent

1. **Supervisor manages all processes** — do NOT start servers manually
2. **Backend**: `uvicorn server:app` on port 8001 (proxies to Node.js on port 3300)
3. **Frontend**: `yarn start` on port 3000
4. **MongoDB**: Also runs via supervisor (used for local testing only; main DB is PostgreSQL on Railway)

### Critical Rules for Agents

```
⚠️  NEVER modify .env URLs or ports — they are production-configured
⚠️  NEVER use npm — always use yarn
⚠️  NEVER start servers with node/uvicorn directly — use supervisorctl
⚠️  ALL backend API routes MUST be prefixed with /api (Kubernetes ingress rule)
⚠️  NEVER hardcode URLs — use environment variables
```

### Restarting Services

```bash
# Restart everything
sudo supervisorctl restart all

# Restart only backend
sudo supervisorctl restart backend

# Restart only frontend
sudo supervisorctl restart frontend

# Check status
sudo supervisorctl status
```

### Checking Logs

```bash
# Backend stdout
tail -100 /var/log/supervisor/backend.out.log

# Backend errors
tail -100 /var/log/supervisor/backend.err.log

# Frontend logs
tail -100 /var/log/supervisor/frontend.out.log

# Search for specific errors
grep -i "error\|failed\|crash" /var/log/supervisor/backend.err.log | tail -20
```

### Environment Variable Access

```typescript
// Backend (TypeScript)
process.env.TATUM_KEY
process.env.REDIS_PUBLIC_URL
os.environ.get('MONGO_URL')  // Python proxy only

// Frontend (React)
process.env.REACT_APP_BACKEND_URL
// or: import.meta.env.REACT_APP_BACKEND_URL
```

### URL Configuration

| Service | Internal Port | External Access |
|---------|--------------|-----------------|
| Backend (uvicorn proxy) | 8001 | `REACT_APP_BACKEND_URL` |
| Node.js (actual backend) | 3300 | Internal only (proxied) |
| Frontend | 3000 | Direct via Kubernetes ingress |

**Frontend → Backend**: Always use `REACT_APP_BACKEND_URL` + `/api/...`
**Backend → Database**: Use `HOST`, `DB_PORT`, `DB_NAME`, `USER_NAME`, `PASSWORD`
**Backend → Redis**: Use `REDIS_PUBLIC_URL`

### Installing Dependencies

```bash
# Node.js (backend)
cd /app/backend
yarn add <package-name>
# Then add to package.json if not auto-added

# Node.js (frontend)
cd /app/frontend
yarn add <package-name>

# Python
pip install <package-name>
# Then add to /app/backend/requirements.txt
```

### TypeScript Compilation Check

```bash
cd /app/backend
npx tsc --noEmit   # Check for type errors without emitting files
```

---

## Environment Variables Reference

### Database & Cache

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_NAME` | PostgreSQL database name | `db_bozzwallet` |
| `USER_NAME` | PostgreSQL username | `postgres` |
| `PASSWORD` | PostgreSQL password | `<password>` |
| `HOST` | PostgreSQL host | `tramway.proxy.rlwy.net` |
| `DB_PORT` | PostgreSQL port | `57376` |
| `REDIS_PUBLIC_URL` | Redis connection string | `redis://default:<pass>@<host>:<port>` |
| `DB_SSL_REJECT_UNAUTHORIZED` | Disable SSL cert validation for Railway | `false` |

### Server Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `8001` |
| `API_SERVICE_PORT` | Legacy API service port (retired) | `3301` |
| `SERVER_URL` | Public backend URL | `https://your-domain.com` |
| `CHECKOUT_URL` | Payment checkout URL | `https://your-domain.com` |
| `FRONTEND_URL` | Frontend URL (for CORS) | `https://your-domain.com` |
| `INTERNAL_BACKEND_URL` | Internal proxy target | `http://localhost:3300` |

### Security & Auth

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `ACCESS_TOKEN` | Admin access token | — |
| `ACCESS_TOKEN_SECRET` | JWT signing secret (64 hex chars) | `openssl rand -hex 32` |
| `API_SECRET` | API encryption secret (48 hex chars) | `openssl rand -hex 24` |
| `CYPHER_KEY` | Encryption cipher key (128 hex chars) | `openssl rand -hex 64` |
| `TATUM_WEBHOOK_SECRET` | Webhook HMAC verification | `openssl rand -hex 32` |

### Blockchain (Tatum)

| Variable | Description |
|----------|-------------|
| `TATUM_KEY` | Tatum API key (mainnet) |
| `TATUM_SECRET_KEY` | Tatum secret key |
| `TATUM_TESTNET` | Enable testnet (`true`/`false`) |
| `TATUM_TESTNET_TYPE` | Testnet type (e.g., `bitcoin-testnet`) |
| `TATUM_TESTNET_KEY` | Tatum API key for testnet |

### Exchange (Binance)

| Variable | Description |
|----------|-------------|
| `BINANCE_API_KEY` | Binance API key |
| `BINANCE_API_SECRET` | Binance API secret |
| `BINANCE_SECRET_KEY` | Same as API secret (legacy compat) |
| `BINANCE_BASE_URL` | `https://api.binance.com` |
| `BINANCE_CONVERT_INTERVAL_MINUTES` | Auto-convert interval (default: `10`) |
| `BINANCE_PROXY_URL` | SOCKS5 proxy for geo-blocked regions | `socks5://127.0.0.1:1080` |

### SSH Tunnel (Binance Proxy for US Servers)

| Variable | Description |
|----------|-------------|
| `SSH_TUNNEL_HOST` | SSH server IP |
| `SSH_TUNNEL_USER` | SSH username |
| `SSH_TUNNEL_PASS` | SSH password |
| `SSH_TUNNEL_LOCAL_PORT` | Local SOCKS5 port (default: `1080`) |

### Email (Brevo)

| Variable | Description |
|----------|-------------|
| `BREVO_API_KEY` | Brevo (Sendinblue) API key |
| `ADMIN_EMAIL` | Admin notification email |

### Crypto Wallet Addresses (Admin/Settlement)

| Variable | Description |
|----------|-------------|
| `BTC` | Admin BTC settlement address |
| `ETH` | Admin ETH settlement address |
| `LTC` | Admin LTC settlement address |
| `DOGE` | Admin DOGE settlement address |
| `TRX` | Admin TRX settlement address |
| `BCH` | Admin BCH settlement address |
| `SOL` | Admin SOL settlement address |
| `XRP` | Admin XRP settlement address |
| `POLYGON` | Admin POLYGON settlement address |
| `USDT_TRC20` | Admin USDT (TRC20) address |
| `USDT_ERC20` | Admin USDT (ERC20) address |
| `USDC_ERC20` | Admin USDC (ERC20) address |
| `USDT_POLYGON` | Admin USDT (Polygon) address |
| `RLUSD` | Admin RLUSD (XRPL) address |
| `RLUSD_ERC20` | Admin RLUSD (ERC20) address |

### Smart Contract Addresses

| Variable | Value |
|----------|-------|
| `ETH_CONTRACT` | `0xdac17f958d2ee523a2206206994597c13d831ec7` (USDT ERC20) |
| `TRX_CONTRACT` | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (USDT TRC20) |
| `USDC_CONTRACT` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (USDC ERC20) |
| `USDT_POLYGON_CONTRACT` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| `RLUSD_ERC20_CONTRACT` | `0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD` |

### Fee Wallets

| Variable | Description |
|----------|-------------|
| `TRX_FEE_WALLET` | TRX gas fee wallet |
| `ETH_FEE_WALLET` | ETH gas fee wallet |
| `XRP_MASTER_WALLET` | XRP master wallet |
| `XRP_FEE_WALLET` | XRP fee collection wallet |
| `POLYGON_FEE_WALLET` | Polygon gas fee wallet |

### Merchant Pool Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MERCHANT_POOL_INITIAL_SIZE` | Addresses pre-created per chain | `2` |
| `RESERVATION_TIMEOUT_MINUTES` | Address reservation TTL | `120` |
| `SKIP_MERCHANT_POOL_VALIDATION` | Skip validation on startup | `true` |
| `<CHAIN>_THRESHOLD` | Pool replenish threshold per chain | `3` |
| `<CHAIN>_SWEEP` | Sweep strategy (`time:N` or `threshold:N`) | varies |

### Fee Tiers

| Variable | Description |
|----------|-------------|
| `TRANSACTION_FEE_PERCENT` | Base transaction fee (%) — `1.5` |
| `FEE_TIER_<N>_MIN` | Tier N minimum amount (USD) |
| `FEE_TIER_<N>_MAX` | Tier N maximum amount (USD) |
| `FEE_TIER_<N>_FIXED` | Tier N fixed fee (USD) |

### Other Integrations

| Variable | Description |
|----------|-------------|
| `FLW_PUBLIC_KEY` / `FLW_SECRET_KEY` | Flutterwave keys |
| `CRYPTO_PUBLIC_KEY` / `CRYPTO_SECRET_KEY` | Crypto.com keys |
| `BLOCK_BEE_API_KEY` | BlockBee API key |
| `BLOCKCHAIR_API_KEY` | Blockchair API key |
| `FAST_FOREX_KEY` / `FASTFOREX_API_KEY` | FastForex rate API |
| `INFOBIP_API_KEY` | Infobip SMS/messaging |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELNYX_API_KEY` | Telnyx voice/SMS |
| `TAX_DATA_API_URL` / `TAX_DATA_API_KEY` | Tax rate API |
| `VERIFF_API_KEY` / `VERIFF_API_SECRET` | Veriff KYC |

### Google Cloud KMS (Wallet Key Encryption)

| Variable | Description |
|----------|-------------|
| `PROJECT_ID` | GCP project ID |
| `LOCATION_ID` | KMS location |
| `KEY_RING_ID` | KMS key ring |
| `PRIVATE_KEY_ID` | KMS key for wallet private keys |
| `TEMP_KEY_ID` | KMS key for temp addresses |
| `XPUB_KEY_ID` | KMS key for xpub keys |
| `GOOGLE_CLIENT_EMAIL` | GCP service account email |
| `GOOGLE_CLIENT_KEY` | GCP service account private key (PEM) |

### XRP/RLUSD Specific

| Variable | Description |
|----------|-------------|
| `XRP_ADMIN_DESTINATION_TAG` | XRP destination tag for admin wallet |
| `RLUSD_ADMIN_WALLET` | RLUSD receiving wallet |
| `RLUSD_ISSUER` | RLUSD token issuer address |
| `RLUSD_CURRENCY_HEX` | RLUSD currency hex code |

### TRON Specific

| Variable | Description |
|----------|-------------|
| `TRON_MIN_FEE_LIMIT_TRX` | Min TRON fee limit | `5` |
| `TRON_MAX_FEE_LIMIT_TRX` | Max TRON fee limit | `30` |

---

## Core Features

### 1. Multi-Chain Payments (15 Cryptocurrencies)
- **Layer 1**: BTC, ETH, LTC, DOGE, TRX, SOL, XRP, POLYGON, BCH
- **Tokens**: USDT-ERC20, USDC-ERC20, USDT-TRC20, USDT-POLYGON, RLUSD, RLUSD-ERC20

### 2. Merchant Pool System
Pre-warmed address pools per chain. When a customer pays:
1. A fresh address is **reserved** from the pool
2. Customer sends crypto to that address
3. After confirmation, funds are **swept** to the admin settlement wallet
4. The address is released back to the pool or discarded

### 3. Auto-Stablecoin Conversion
After receiving volatile crypto (BTC, ETH, etc.), automatically converts to stablecoins via Binance Convert API. Configurable interval via `BINANCE_CONVERT_INTERVAL_MINUTES`.

### 4. QR Codes with Currency Logos
Branded QR codes for all 15 supported chains using `sharp` library for logo overlay. Error correction level H (30% recovery) ensures scannability with center logo.

### 5. Webhook Notifications
HMAC-signed merchant callbacks with BullMQ retry queue, dead letter queue, and delivery logging.

### 6. Payment State Machine
Formal state machine (`paymentStateMachine.ts`) with defined transitions:
```
pending → processing → successful → payout_complete
         ↓             ↓
       underpaid      failed
         ↓
       refunded
```

### 7. Fee Optimization
Dynamic gas estimation, chain-aware timeouts, fee caching (15-minute intervals), and tiered fee structure.

### 8. Error Monitoring
Redis-backed error buffer with:
- Immediate alerts for critical/high severity errors
- 15-minute email digests via Brevo
- Slack/Discord webhook alerts

### 9. Security
- JWT auth with refresh token rotation
- 2FA (TOTP) with backup codes
- CSRF double-submit cookie
- Redis-backed rate limiting & account lockout
- XSS input sanitization
- Webhook HMAC verification + IP allowlist

---

## Payment Flow

```
1. Merchant creates invoice/payment link
   POST /api/payment/create

2. System assigns address from merchant pool
   (or creates temp address via Tatum)

3. Customer receives payment page with QR code
   (branded QR with currency logo)

4. Customer sends crypto to assigned address

5. Tatum sends webhook notification
   POST /api/tatum-crypto-webhook

6. webhookProcessor processes via BullMQ queue:
   a. Verify transaction on blockchain
   b. Update payment status (state machine)
   c. Trigger merchant webhook callback

7. If auto-convert enabled:
   a. Sweep funds to Binance
   b. Convert to stablecoin (USDT/USDC)
   c. Update conversion status

8. Settlement:
   a. Sweep confirmed funds to admin wallet
   b. Deduct fees
   c. Send payout to merchant

9. Generate tax-ready report (PDF)
   GET /api/invoice/:id/pdf
```

---

## API Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/login` | User login |
| POST | `/api/user/registerUser` | User registration |
| POST | `/api/user/refresh-token` | Refresh JWT token |
| GET | `/api/user/sessions` | List active sessions |
| DELETE | `/api/user/sessions/:id` | Revoke session |

### 2FA
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/2fa/setup` | Initialize 2FA setup |
| POST | `/api/user/2fa/verify-setup` | Confirm 2FA setup |
| POST | `/api/user/2fa/validate` | Validate 2FA code (returns JWT) |
| POST | `/api/user/2fa/disable` | Disable 2FA |
| GET | `/api/user/2fa/status` | Check 2FA status |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/create` | Create payment |
| POST | `/api/payment/verify` | Verify payment status |
| GET | `/api/payment/:id` | Get payment details |

### Wallets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/all` | List all wallets |
| POST | `/api/wallet/create` | Create wallet |
| POST | `/api/wallet/send` | Send crypto |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/getAllUsers` | List users |
| PUT | `/api/admin/users/:id/ban` | Ban user |
| GET | `/api/admin/analytics/revenue` | Revenue analytics |
| GET | `/api/admin/tunnel/status` | Binance proxy status |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tatum-crypto-webhook` | Tatum blockchain webhook |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/status/health` | Detailed health |
| GET | `/api/csrf-token` | Get CSRF token |
| GET | `/api/events/stream` | SSE event stream |
| GET | `/api/events/stats` | SSE statistics |
| GET | `/api/docs` | Swagger UI (225 paths) |
| GET | `/api/docs.json` | OpenAPI JSON spec |
| GET | `/api/diagnostics/binance-proxy` | Binance proxy status |

### Merchant API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/merchant/transactions` | List merchant transactions |
| GET | `/api/merchant/transactions/:id` | Single transaction |

---

## Third-Party Integrations

### Tatum (Blockchain Infrastructure)
- **Purpose**: Address generation, transaction monitoring, webhook subscriptions
- **Used in**: `paymentController.ts`, `walletController.ts`, `webhooks/`
- **API Key**: `TATUM_KEY`
- **Dashboard**: https://dashboard.tatum.io/

### Binance (Exchange & Conversion)
- **Purpose**: Auto-stablecoin conversion, real-time price feeds
- **Used in**: `binanceService.ts`, `binanceWebSocketService.ts`, `conversionService.ts`
- **API Keys**: `BINANCE_API_KEY`, `BINANCE_API_SECRET`
- **Geo-blocking**: US servers need SSH SOCKS5 tunnel (see `sshTunnelManager.ts`)
- **Smart Proxy**: Auto-detects if direct access works; only uses proxy when blocked

### Brevo / Sendinblue (Email)
- **Purpose**: Transactional emails, error digest alerts
- **Used in**: `emailService.ts`, `errorMonitoringService.ts`
- **API Key**: `BREVO_API_KEY`

### Google Cloud KMS (Key Management)
- **Purpose**: Encrypt/decrypt wallet private keys at rest
- **Used in**: `apis/` (Tatum key management)
- **Credentials**: `GOOGLE_CLIENT_EMAIL`, `GOOGLE_CLIENT_KEY`

### Veriff (KYC)
- **Purpose**: Identity verification
- **Used in**: `kycController.ts`, `veriffService.ts`
- **API Keys**: `VERIFF_API_KEY`, `VERIFF_API_SECRET`

### Flutterwave (Fiat Payments)
- **Purpose**: Fiat on-ramp
- **Used in**: `routes/index.ts` (webhook), `paymentController.ts`
- **API Keys**: `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`

---

## Cron Jobs & Background Processes

All cron jobs are defined in `server.ts`:

| Schedule | Job | Description |
|----------|-----|-------------|
| `0 */2 * * *` | Background rate cache | Refresh fiat/crypto rates |
| `*/15 * * * *` | Error digest | Send buffered error alerts |
| `*/10 * * * *` | Binance convert | Auto-stablecoin conversion |
| `*/15 * * * *` | Incomplete payments | Process stuck payments |
| `0 */24 * * *` | Expired subscriptions | Clean up expired subs |
| `*/5 * * * *` | Rate cache refresh | Tatum rate cache |
| `*/5 * * * *` | Scheduled sweeps | Merchant pool fund sweeps |
| `*/15 * * * *` | Address monitor | Merchant pool health check |
| `0 */2 * * *` | Stale lock cleanup | Clean Redis stale locks |
| `*/10 * * * *` | Reconciliation | Stuck payment recovery |
| `0 * * * *` | Pool top-up | Replenish merchant pool |
| `*/15 * * * *` | Transaction fees | Cache blockchain fees |
| `*/5 * * * *` | Expired reservations | Release expired address reservations |
| `30 9 * * 1` | Weekly report | Weekly analytics email |

---

## Testing

### Test Configuration

Three Jest projects (defined in `jest.config.ts`):

1. **Unit tests** — Mock Redis, DB, models
2. **Redis tests** — Test real Redis module with mocked client
3. **Integration tests** — Hit live server via supertest

### Running Tests

```bash
cd /app/backend

# Run all tests
yarn test

# Run with verbose output
yarn test:verbose

# Run specific test file
npx jest --config jest.config.ts paymentStateMachine.test.ts

# Run only integration tests
npx jest --config jest.config.ts --selectProjects integration

# TypeScript compilation check
npx tsc --noEmit
```

### Test Files

| Test File | Tests | Description |
|-----------|-------|-------------|
| `paymentStateMachine.test.ts` | 132 | State machine transitions |
| `webhookProcessor.test.ts` | 52 | Webhook processing logic |
| `webhookHandlers.test.ts` | — | Webhook handler logic |
| `blockchainFeeService.test.ts` | — | Fee estimation |
| `feeCalculation.test.ts` | — | Fee calculation |
| `feeRateService.test.ts` | — | Rate service |
| `redisInstance.test.ts` | — | Redis operations |
| `api/*.test.ts` | 62 | Integration tests |

**Total**: 500+ tests passing

---

## Deployment (Railway)

### Railway Services

1. **Web Service** — Backend (Node.js via Python proxy)
2. **PostgreSQL** — Primary database
3. **Redis** — Caching, queues, rate limiting

### Railway Environment Variables

All environment variables from the `.env` file should be configured in Railway's Variables section. See `docs/guides/RAILWAY_ENV_VARS.md` for the complete Railway-specific setup.

### Build & Start

```bash
# Build
cd /app/backend && yarn build

# Start (production)
node dist/server.js

# Or via start.sh
./start.sh
```

### Railway-Specific Fixes

- **PostgreSQL**: `DB_SSL_REJECT_UNAUTHORIZED=false` for Railway's SSL
- **Connection stability**: `keepAlive: true` in Sequelize config
- **Retry logic**: Automatic reconnect on `Connection terminated` errors
- **Binance proxy**: SSH tunnel for US-region Railway deployments

---

## Security Features

| Feature | Implementation |
|---------|---------------|
| **JWT Authentication** | `authMiddleware.ts` — Bearer token validation |
| **Refresh Token Rotation** | `sessionController.ts` — Prevents token reuse |
| **2FA (TOTP)** | `twoFactorService.ts` — With backup codes |
| **CSRF Protection** | `csrfMiddleware.ts` — Double-submit cookie |
| **Rate Limiting** | `rateLimitMiddleware.ts` — Redis-backed, per-IP/email/endpoint |
| **Account Lockout** | `accountLockoutService.ts` — Redis-based with admin unlock |
| **XSS Prevention** | `sanitizeInput.ts` — Input sanitization middleware |
| **Input Validation** | `validateRequest.ts` — Joi schemas on all endpoints |
| **Webhook HMAC** | `routes/index.ts` — SHA-256 signature verification |
| **IP Allowlist** | `routes/index.ts` — Tatum webhook IP whitelist |
| **Helmet** | `server.ts` — Security headers |
| **CORS** | `server.ts` — Origin restriction |

---

## Key Files Reference

### Must-Know Files (Start Here)

| File | Lines | Purpose |
|------|-------|---------|
| `server.py` | 180 | Python ASGI proxy (DO NOT MODIFY) |
| `server.ts` | 997 | Express app, middleware, cron jobs |
| `routes/index.ts` | — | Main router, webhook routes, IP allowlist |
| `controller/paymentController.ts` | 8119 | Core payment logic (largest file) |
| `services/paymentStateMachine.ts` | — | Payment state transitions |
| `services/webhookProcessor.ts` | 841 | BullMQ webhook processing |
| `models/index.ts` | — | All Sequelize model exports |
| `utils/redisInstance.ts` | — | Redis client, locks, helpers |
| `utils/dbInstance.ts` | — | Sequelize connection config |

### Configuration Files

| File | Purpose |
|------|---------|
| `backend/.env` | All environment variables |
| `backend/tsconfig.json` | TypeScript compiler options |
| `backend/jest.config.ts` | Test configuration (3 projects) |
| `frontend/.env` | `REACT_APP_BACKEND_URL` |
| `supervisord.conf` | Process management (READONLY) |

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
tail -50 /var/log/supervisor/backend.err.log

# Common issues:
# 1. Missing dependencies → yarn install
# 2. TypeScript error → npx tsc --noEmit
# 3. Port already in use → check for zombie processes
# 4. Missing .env variable → check envValidator.ts output
```

### Redis connection failed

```bash
# Test Redis connectivity
redis-cli -u $REDIS_PUBLIC_URL ping
# Should return: PONG
```

### Database connection failed

```bash
# Check PostgreSQL connectivity
psql -h $HOST -p $DB_PORT -U $USER_NAME -d $DB_NAME -c "SELECT 1;"
```

### Tatum webhooks not arriving

1. Check IP allowlist in `routes/index.ts`
2. Verify `TATUM_WEBHOOK_SECRET` matches Tatum dashboard
3. Check if server URL is publicly accessible
4. Review webhook logs: `grep "webhook" /var/log/supervisor/backend.out.log`

### Binance API failing (geo-blocked)

```bash
# Check proxy status
curl http://localhost:8001/api/diagnostics/binance-proxy

# If proxy is down, restart SSH tunnel
# The system auto-detects and handles this
```

### TypeScript compilation errors

```bash
cd /app/backend
npx tsc --noEmit
# Fix reported errors before restarting
```

---

## Admin Credentials

| Field | Value |
|-------|-------|
| **Email** | `moxxcompany@gmail.com` |
| **Password** | `Katiekendra123@` |

---

## Additional Documentation

- [Environment Variables Complete Guide](docs/guides/ENV_VARS_COMPLETE_GUIDE.md)
- [Deployment & Testing Guide](docs/guides/DEPLOY_AND_TEST_GUIDE.md)
- [Railway Setup](docs/guides/RAILWAY_ENV_VARS.md)
- [Binance Proxy Setup](docs/guides/BINANCE_PROXY_SETUP.md)
- [KYC Integration](docs/guides/KYC_DOCUMENTATION.md)
- [Codebase Analysis Report](docs/reports/CODEBASE_ANALYSIS_REPORT.md)
- [Security Fixes Summary](docs/reports/SECURITY_FIXES_SUMMARY.md)
- [Controller Refactoring Plan](docs/plans/CONTROLLER_REFACTORING_PLAN.md)
- [Auto-Conversion Plan](docs/plans/AUTO_CONVERSION_PLAN.md)
- [Incident Playbook](incident-playbook.md)
- [Product Requirements Document](memory/PRD.md)

---

*Last updated: July 2025*
