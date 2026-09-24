#!/bin/bash
# One-off audit: hit each public marketing page once (dev compile), record HTTP
# status, byte size, and any leaked dotted i18n keys visible as text nodes.
PAGES="about aml-policy brands company creator customers documentation fees get-started how-to press privacy-policy products quality referral-program system-status terms-conditions wallet-security for/ecommerce for/saas for/creators for/freelancers"
OUT=/tmp/audit_pages.txt
: > "$OUT"
for p in $PAGES; do
  H=$(curl -s -m60 -w "|HTTP=%{http_code}" "http://127.0.0.1:3000/$p")
  CODE=$(echo "$H" | grep -oE "\|HTTP=[0-9]+" | tail -1 | cut -d= -f2)
  BODY=$(echo "$H" | sed 's/|HTTP=[0-9]*$//')
  LEAK=$(echo "$BODY" | grep -oE ">[a-z0-9]+\.[a-z0-9._]{2,}<" | sort -u | head -5 | tr '\n' ' ')
  BYTES=$(echo -n "$BODY" | wc -c)
  printf "%-24s code=%s bytes=%-8s leak:%s\n" "$p" "${CODE:-ERR}" "$BYTES" "${LEAK:-none}" >> "$OUT"
done
echo "AUDIT_DONE" >> "$OUT"
