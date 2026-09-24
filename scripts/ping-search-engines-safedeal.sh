#!/bin/bash
# ────────────────────────────────────
# SafeDeal (safedeal.sh) — Notify Search Engines After Deployment
#
# Google: No ping needed — submit https://safedeal.sh/sitemap.xml once in
#         Google Search Console; it re-crawls automatically thereafter.
#
# Bing/Yandex/Seznam/Naver: IndexNow. Run:
#         bash scripts/ping-search-engines-safedeal.sh
#
# The IndexNow key file (public/<key>.txt) is served from the shared public/
# dir, so it resolves at https://safedeal.sh/<key>.txt too — same key, verified
# per-host by IndexNow.
# ────────────────────────────────────

SITE_URL="https://safedeal.sh"
INDEXNOW_KEY_FILE="/app/public/indexnow-key.txt"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

if [ ! -f "$INDEXNOW_KEY_FILE" ]; then
  echo "Error: IndexNow key file not found at $INDEXNOW_KEY_FILE"
  echo "Generate one at https://www.indexnow.org/getstarted and place it in /app/public/"
  exit 1
fi

INDEXNOW_KEY=$(cat "$INDEXNOW_KEY_FILE" | tr -d '[:space:]')

echo "Notifying search engines via IndexNow (SafeDeal)..."
echo "Key: ${INDEXNOW_KEY:0:8}..."
echo ""

# Pull the FULL live URL list from the SafeDeal sitemap (host-aware page). Prefer
# the public production sitemap; fall back to the locally running server, forcing
# the SafeDeal host so it emits the safedeal.sh URL set.
SITEMAP_XML=$(curl -s --max-time 20 "${SITE_URL}/sitemap.xml")
if ! echo "$SITEMAP_XML" | grep -q "<loc>"; then
  echo "Public sitemap unavailable — falling back to http://localhost:${FRONTEND_PORT}/sitemap.xml (Host: safedeal.sh)"
  SITEMAP_XML=$(curl -s --max-time 20 -H "Host: safedeal.sh" "http://localhost:${FRONTEND_PORT}/sitemap.xml")
fi

LOCS=$(echo "$SITEMAP_XML" \
  | grep -oE "<loc>[^<]+</loc>" \
  | sed -E 's#</?loc>##g' \
  | grep "^${SITE_URL}")

if [ -z "$LOCS" ]; then
  echo "✗ Could not read any URLs from the SafeDeal sitemap. Aborting."
  exit 1
fi

URL_LIST=""
COUNT=0
while IFS= read -r loc; do
  [ -z "$loc" ] && continue
  URL_LIST="${URL_LIST}\"${loc}\","
  COUNT=$((COUNT + 1))
done <<< "$LOCS"
URL_LIST="[${URL_LIST%,}]"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"safedeal.sh\",
    \"key\": \"${INDEXNOW_KEY}\",
    \"keyLocation\": \"${SITE_URL}/${INDEXNOW_KEY}.txt\",
    \"urlList\": ${URL_LIST}
  }")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
  echo "✓ IndexNow: ${COUNT} SafeDeal URLs submitted successfully (HTTP $HTTP_CODE)"
  echo "  Bing, Yandex, Seznam, and Naver will re-crawl within minutes."
else
  echo "✗ IndexNow: Failed (HTTP $HTTP_CODE)"
  echo "  Check your key at: ${SITE_URL}/${INDEXNOW_KEY}.txt"
fi

echo ""
echo "── Google ──"
echo "✓ No ping required. Submit ${SITE_URL}/sitemap.xml once in Google Search Console."
echo ""
echo "Done."
