#!/usr/bin/env bash
# =============================================================================
# i18n audit — the single "way to check" for untranslated / hardcoded English.
#
# Run:  bash scripts/i18n_audit.sh            # report only (CI-friendly, exits 1 on gaps)
#       bash scripts/i18n_audit.sh --fix      # build manifest + machine-translate the gaps
#
# It layers three complementary checks (source of truth = langs/locales/en):
#   1. check-i18n.mjs            keys present in EN but MISSING in de/es/fr/pt/nl
#                                (these render the English fallback for that language).
#   2. qa/i18n_missing_keys.py   t(key,{defaultValue}) calls whose key is in NO en/*.json
#                                (these render English for EVERY language, incl. EN).
#   3. scan_hardcoded_i18n.py    heuristic: raw JSX/label strings never wrapped in t()
#                                (noisy — treat as leads, not gospel).
#
# EXCLUDED BY DESIGN (kept English on purpose):
#   - pages/documentation.tsx  (public developer DOCUMENTATION page — technical, English).
#   - Marketing/blog/landing/checkout-public dirs are skipped by i18n_build_manifest.py's
#     SKIP list (edit that list to widen the net).
#
# FIX FLOW (what --fix runs):
#   python3 scripts/qa/i18n_build_manifest.py   # -> scripts/i18n_manifest.json
#   python3 scripts/translate_missing_i18n.py   # backfill EN + translate 5 locales (OpenAI)
#   ...then re-run this audit to confirm 0 gaps.
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

FIX=0
[ "${1:-}" = "--fix" ] && FIX=1

if [ "$FIX" = "1" ]; then
  echo "== Building manifest of code keys missing from en/*.json =="
  python3 scripts/qa/i18n_build_manifest.py || true
  echo "== Backfilling EN + machine-translating de/es/fr/pt/nl (OpenAI) =="
  python3 scripts/translate_missing_i18n.py
  echo "== Re-checking =="
fi

fail=0

echo
echo "1) Locale completeness vs en (check-i18n.mjs)"
if node scripts/check-i18n.mjs; then :; else fail=1; fi

echo
echo "2) t()-with-defaultValue keys missing from en/*.json (qa/i18n_missing_keys.py)"
missing_calls=$(python3 scripts/qa/i18n_missing_keys.py 2>&1 1>/dev/null | tail -1)
python3 scripts/qa/i18n_missing_keys.py 2>/dev/null | sed 's/^/   /'
echo "   ${missing_calls}"
echo "${missing_calls}" | grep -qE "^-- 0 calls" || fail=1

echo
echo "3) Heuristic raw-string scan (scan_hardcoded_i18n.py) — leads only, NOT a gate"
python3 scripts/scan_hardcoded_i18n.py 2>/dev/null | tail -3

echo
if [ "$fail" = "0" ]; then
  echo "✅ i18n audit clean: every locale complete + no English-only t() defaults."
else
  echo "❌ i18n gaps found above. Fix with:  bash scripts/i18n_audit.sh --fix"
fi
exit $fail
