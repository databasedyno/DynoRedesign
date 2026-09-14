#!/bin/bash
# ─────────────────────────────────────────────────────────────
# DynoPay — Notify Search Engines After Deployment
# 
# Google: No ping needed — Google Search Console re-crawls
#         the submitted sitemap automatically. ✓
#
# Bing/Yandex/Seznam/Naver: Use IndexNow protocol.
#         Run:  bash scripts/ping-search-engines.sh
# ─────────────────────────────────────────────────────────────

SITE_URL="https://dynopay.com"
INDEXNOW_KEY_FILE="/app/public/indexnow-key.txt"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# ── Read the IndexNow key ──
if [ ! -f "$INDEXNOW_KEY_FILE" ]; then
  echo "Error: IndexNow key file not found at $INDEXNOW_KEY_FILE"
  echo "Generate one at https://www.indexnow.org/getstarted and place it in /app/public/"
  exit 1
fi

INDEXNOW_KEY=$(cat "$INDEXNOW_KEY_FILE" | tr -d '[:space:]')

echo "Notifying search engines via IndexNow..."
echo "Key: ${INDEXNOW_KEY:0:8}..."
echo ""

# ── Pull the FULL live URL list from the running sitemap ──
# The sitemap is the single source of truth (static pages + SEO landing pages +
# blog posts + help articles + creator/shop/product URLs), so this always
# submits every indexable page instead of a stale hardcoded handful.
# Prefer the public production sitemap; fall back to the locally running one.
SITEMAP_XML=$(curl -s --max-time 20 "${SITE_URL}/sitemap.xml")
if ! echo "$SITEMAP_XML" | grep -q "<loc>"; then
  echo "Public sitemap unavailable — falling back to http://localhost:${FRONTEND_PORT}/sitemap.xml"
  SITEMAP_XML=$(curl -s --max-time 20 "http://localhost:${FRONTEND_PORT}/sitemap.xml")
fi

# Extract every <loc> that belongs to our host.
LOCS=$(echo "$SITEMAP_XML" \
  | grep -oE "<loc>[^<]+</loc>" \
  | sed -E 's#</?loc>##g' \
  | grep "^${SITE_URL}")

if [ -z "$LOCS" ]; then
  echo "✗ Could not read any URLs from the sitemap. Aborting."
  exit 1
fi

# ── Build the JSON urlList from the sitemap locs ──
URL_LIST=""
COUNT=0
while IFS= read -r loc; do
  [ -z "$loc" ] && continue
  URL_LIST="${URL_LIST}\"${loc}\","
  COUNT=$((COUNT + 1))
done <<< "$LOCS"
URL_LIST="[${URL_LIST%,}]"  # Remove trailing comma, wrap in array

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"dynopay.com\",
    \"key\": \"${INDEXNOW_KEY}\",
    \"keyLocation\": \"${SITE_URL}/${INDEXNOW_KEY}.txt\",
    \"urlList\": ${URL_LIST}
  }")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
  echo "✓ IndexNow: ${COUNT} URLs submitted successfully (HTTP $HTTP_CODE)"
  echo "  Bing, Yandex, Seznam, and Naver will re-crawl within minutes."
else
  echo "✗ IndexNow: Failed (HTTP $HTTP_CODE)"
  echo "  Check your key at: ${SITE_URL}/${INDEXNOW_KEY}.txt"
fi

echo ""
echo "── Google ──"
echo "✓ No ping required. Google Search Console re-crawls your submitted sitemap automatically."
echo ""
echo "Done."
