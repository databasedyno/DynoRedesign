##############################################
# Stage 1: Frontend deps
##############################################
FROM node:20-alpine AS frontend-deps

WORKDIR /app

# Copy root package.json (Next.js project)
COPY package.json yarn.lock* ./

# Install all dependencies (including devDependencies for build)
RUN yarn install --frozen-lockfile || yarn install

##############################################
# Stage 1b: Source-context guard for public/
# The workspace auto-commit machinery has TWICE deleted the top-level
# public/ directory from git (2026-07-09 commit 78bb5b03, 2026-07-10 commit
# 3567cad2). A bare `COPY public/ ./public/` then aborts the whole build
# (kaniko: "lstat /.app_platform_workspace/public: no such file or
# directory"). This stage guarantees /src/public ALWAYS exists: it prefers
# the real ./public from the repo, and falls back to the tracked mirror at
# assets/public-runtime/ (keep both in sync when adding runtime assets:
#   cp -r public/. assets/public-runtime/ ).
##############################################
FROM node:20-alpine AS srcguard

WORKDIR /src

COPY . .

RUN mkdir -p public \
 && if [ ! -f public/favicon.ico ] && [ -d assets/public-runtime ]; then \
      echo "WARNING: public/ missing from build context — restoring from assets/public-runtime mirror"; \
      cp -r assets/public-runtime/. public/; \
    fi \
 && ls public | head -5

##############################################
# Stage 2: Build Next.js frontend
##############################################
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY --from=frontend-deps /app/node_modules ./node_modules
COPY package.json yarn.lock* next.config.mjs tsconfig.json ./
COPY i18n.js axiosConfig.ts axiosAdmin.ts store.ts ./

# Copy all frontend source directories
COPY pages/ ./pages/
COPY Components/ ./Components/
COPY styles/ ./styles/
COPY Containers/ ./Containers/
COPY contexts/ ./contexts/
COPY hooks/ ./hooks/
COPY langs/ ./langs/
COPY utils/ ./utils/
COPY assets/ ./assets/
# public/ comes via the srcguard stage (mirror fallback) — see Stage 1b.
COPY --from=srcguard /src/public/ ./public/
COPY Redux/ ./Redux/
COPY helpers/ ./helpers/
# SEO landing-page content — read by getStaticPaths/getStaticProps at build
# time AND by sitemap.xml getServerSideProps at runtime. Omitting this ships
# zero /accept-crypto-payments-in/* and /for/* pages (production 404s).
COPY data/ ./data/

# NEXT_PUBLIC_* must be set at BUILD time (inlined into JS bundle)
# Default: empty = relative URLs (works when frontend+backend share the same domain)
# Override with --build-arg or DO env vars for custom domains
ARG NEXT_PUBLIC_BASE_URL=
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}

ARG NEXT_PUBLIC_API_DOCS_URL
ENV NEXT_PUBLIC_API_DOCS_URL=${NEXT_PUBLIC_API_DOCS_URL}

ARG NEXT_PUBLIC_CYPHER_KEY
ENV NEXT_PUBLIC_CYPHER_KEY=${NEXT_PUBLIC_CYPHER_KEY}

ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}

# Feature flag: shows the "Continue with Google" button on login/register.
# MUST be declared here — Docker silently drops undeclared build args, so
# without this line DO's NEXT_PUBLIC_ENABLE_GOOGLE_AUTH env never reaches
# `yarn build` and the flag is inlined as undefined (button hidden).
ARG NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=
ENV NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=${NEXT_PUBLIC_ENABLE_GOOGLE_AUTH}

# GitHub OAuth (same rule: must be declared or Docker drops the build arg)
ARG NEXT_PUBLIC_ENABLE_GITHUB_AUTH=
ENV NEXT_PUBLIC_ENABLE_GITHUB_AUTH=${NEXT_PUBLIC_ENABLE_GITHUB_AUTH}
ARG NEXT_PUBLIC_GITHUB_CLIENT_ID=
ENV NEXT_PUBLIC_GITHUB_CLIENT_ID=${NEXT_PUBLIC_GITHUB_CLIENT_ID}

# Branded creator domain (e.g. https://dynopay.me). MUST be declared so that
# client-side bundles inline the value at build time — otherwise UserMenu /
# CreatorPageCard / share dialogs fall back to NEXT_PUBLIC_BASE_URL.
ARG NEXT_PUBLIC_CREATOR_BASE_URL=
ENV NEXT_PUBLIC_CREATOR_BASE_URL=${NEXT_PUBLIC_CREATOR_BASE_URL}

ARG NEXT_PUBLIC_GOOGLE_CLIENT_SECRET
ENV NEXT_PUBLIC_GOOGLE_CLIENT_SECRET=${NEXT_PUBLIC_GOOGLE_CLIENT_SECRET}

ARG NEXTAUTH_URL=https://dynopay.com
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

ARG NEXTAUTH_SECRET
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# Build Next.js (produces .next/ with standalone output)
RUN yarn build

##############################################
# Stage 3: Build Express backend
##############################################
FROM node:20-alpine AS backend-builder

WORKDIR /app

ENV NODE_ENV=production
ENV NO_UPDATE_NOTIFIER=true

# Copy backend dependency manifests
COPY backend/package.json backend/yarn.lock* ./

# Install ALL deps (dev included for tsc build)
RUN yarn install --ignore-engines --production=false --frozen-lockfile || yarn install --ignore-engines --production=false

# Copy backend source code
COPY backend/ .

# Build TypeScript -> dist/
RUN yarn build

# Prune to production-only deps
RUN yarn install --ignore-engines --production=true && yarn cache clean

##############################################
# Stage 4: Runner — combined production image
##############################################
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl (healthcheck) and nginx (reverse proxy)
RUN apk add --no-cache curl nginx

ENV NODE_ENV=production
ENV NO_UPDATE_NOTIFIER=true
ENV NODE_OPTIONS="--no-warnings"
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_MERCHANT_POOL_VALIDATION=true

# --- Backend files ---
COPY --from=backend-builder /app/dist ./backend/dist
COPY --from=backend-builder /app/node_modules ./backend/node_modules
COPY --from=backend-builder /app/package.json ./backend/package.json
COPY --from=backend-builder /app/public ./backend/public
COPY --from=backend-builder /app/swagger ./backend/swagger
# Email/PDF i18n catalogs (read at runtime via fs; tsc does NOT emit these .json files).
# Without this, all localized emails/PDFs render raw i18n keys in production.
COPY --from=backend-builder /app/locales ./backend/locales

# --- Frontend files (Next.js standalone) ---
COPY --from=frontend-builder /app/.next/standalone ./frontend/
COPY --from=frontend-builder /app/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/public ./frontend/public
# SEO content read via fs at runtime by sitemap.xml (cwd = /app/frontend)
COPY --from=frontend-builder /app/data ./frontend/data

# --- Nginx config template ---
COPY nginx.conf /etc/nginx/nginx.conf.template

# --- Start script ---
COPY start-all.sh ./start-all.sh
RUN chmod +x ./start-all.sh

# --- IndexNow deploy pinger (fired by start-all.sh) ---
COPY scripts/indexnow-ping.mjs ./scripts/indexnow-ping.mjs

# Create required directories
RUN mkdir -p /var/log/nginx /var/lib/nginx/tmp /run/nginx backend/logs

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8001}/health || exit 1

CMD ["./start-all.sh"]
